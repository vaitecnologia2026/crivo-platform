import { Injectable } from '@nestjs/common';
import {
  PSYCHOSOCIAL_RISK_CLASS_LABEL,
  type PsychosocialRiskMatrixRow,
  type RiskActionSuggestion,
  type RiskActionSuggestions,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { PsychosocialService } from '../psychosocial/psychosocial.service';
import { AiSettingsService } from '../admin/ai-settings.service';
import { planEntryFor, resolveActionPlans } from './psychosocial-action-plans';
import { resolvePsychosocialInstrument } from '../admin/methodology.service';

/**
 * Ações SUGERIDAS a partir do cálculo da matriz 5×5.
 *
 * A matriz já diz quais fatores exigem plano (Risco = P × S ≥ 10, NR-1 §8.4);
 * o que faltava era transformar isso em ação concreta. Este serviço faz a ponte:
 * lê a matriz do diagnóstico, mantém só os fatores com plano OBRIGATÓRIO e
 * resolve o conteúdo das ações pela IA (quando ligada) ou pela biblioteca fixa.
 *
 * NÃO persiste nada. A organização é quem aceita — e é o aceite que cria a ação
 * no Plano de Evolução, com status SUGERIDA. Enquanto a empresa não aprovar,
 * `dossierBlockers` continua barrando a emissão do dossiê final: é a regra
 * "somente ações aceitas, editadas ou inseridas pela organização são
 * incorporadas ao Plano de Evolução".
 */
@Injectable()
export class RiskSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly psychosocial: PsychosocialService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  /**
   * Sugestões para o plano informado (ou para o tenant, quando nenhum plano é
   * dado). `reason` explica uma lista vazia — a tela mostra o motivo em vez de
   * um painel em branco.
   */
  async list(tenantId: string, planId?: string): Promise<RiskActionSuggestions> {
    const vazio = (reason: string): RiskActionSuggestions => ({
      origin: 'biblioteca',
      suggestions: [],
      reason,
    });

    let res: Awaited<ReturnType<PsychosocialService['results']>> | null = null;
    try {
      res = await this.psychosocial.results(tenantId);
    } catch {
      return vazio('Não foi possível ler o resultado do diagnóstico organizacional.');
    }
    if (!res) return vazio('Nenhum diagnóstico organizacional respondido até o momento.');
    if (res.totalRespondents < res.minRespondents) {
      return vazio(
        `O diagnóstico tem ${res.totalRespondents} resposta(s) e o mínimo para exibir resultados é ` +
          `${res.minRespondents}. As sugestões aparecem quando o volume for suficiente.`,
      );
    }

    const overall = res.overall.suppressed ? null : res.overall;
    const matrix: PsychosocialRiskMatrixRow[] =
      overall && 'riskMatrix' in overall ? overall.riskMatrix : [];
    if (!matrix.length) {
      return vazio(
        'A matriz de risco ainda não pode ser calculada. Cadastre os fatores com severidade no Motor ' +
          'de Diagnósticos e vincule as perguntas a eles.',
      );
    }

    // Régua da NR-1 §8.4: plano obrigatório a partir de risco 10 (Alto para cima).
    const required = matrix.filter((r) => r.planRequired);
    if (!required.length) {
      return vazio(
        'Nenhum fator atingiu risco 10 ou mais — pela régua da NR-1, nenhum plano de ação é ' +
          'obrigatório neste ciclo. Os fatores de risco menor seguem em monitoramento.',
      );
    }

    const { plans, origin } = await resolveActionPlans(
      { prisma: this.prisma, aiSettings: this.aiSettings },
      tenantId,
      required,
      // Mesmo instrumento que produziu a matriz (psychosocial.results) — é por
      // ele que o prompt personalizado da IA da Plataforma é resolvido.
      await resolvePsychosocialInstrument(this.prisma),
    );
    const jaNoPlano = await this.acceptedKeys(tenantId, planId);

    // A matriz vem ordenada por risco desc, então o fator de MAIOR risco de cada
    // dimensão reivindica as ações dela: sem isto, três fatores da mesma dimensão
    // repetiriam as mesmas ações três vezes.
    const vistas = new Set<string>();
    const suggestions: RiskActionSuggestion[] = [];
    for (const r of required) {
      const entry = planEntryFor(plans, r);
      if (!entry) continue;
      const dimensionSlug = r.sourceSlug ?? r.slug;
      for (const a of entry.acoes) {
        const key = suggestionKeyOf(dimensionSlug, a.titulo);
        if (vistas.has(key)) continue;
        vistas.add(key);
        suggestions.push({
          key,
          factorSlug: r.slug,
          factorLabel: r.label,
          dimensionSlug,
          probability: r.probability,
          severity: r.severity,
          risk: r.risk,
          riskClass: r.riskClass,
          title: a.titulo,
          prazo: a.prazo,
          objetivo: a.objetivo,
          etapas: a.etapas,
          indicadores: a.indicadores,
          alreadyInPlan: jaNoPlano.has(key),
        });
      }
    }

    if (!suggestions.length) {
      return vazio(
        'Os fatores com plano obrigatório não têm ações na biblioteca da dimensão correspondente. ' +
          'Vincule o fator a uma dimensão no Motor de Diagnósticos ou cadastre a ação manualmente.',
      );
    }
    return { origin, suggestions };
  }

  /** Chaves já aceitas — evita oferecer de novo o que já está no plano. */
  private async acceptedKeys(tenantId: string, planId?: string): Promise<Set<string>> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.actionItem.findMany({
        where: { suggestionKey: { not: null }, ...(planId ? { planId } : {}) },
        select: { suggestionKey: true },
      });
      return new Set(rows.map((r) => r.suggestionKey).filter((k): k is string => !!k));
    });
  }
}

/** `<dimensão>|<título>` — a mesma chave grava em `action_items.suggestion_key`. */
export function suggestionKeyOf(dimensionSlug: string, titulo: string): string {
  return `${dimensionSlug}|${titulo}`.slice(0, 240);
}

/** Texto da origem do cálculo, para a trilha e para a tela. */
export function riskOriginLabel(s: RiskActionSuggestion): string {
  return (
    `${s.factorLabel} · P${s.probability} × S${s.severity} = ${s.risk} · ` +
    PSYCHOSOCIAL_RISK_CLASS_LABEL[s.riskClass]
  );
}
