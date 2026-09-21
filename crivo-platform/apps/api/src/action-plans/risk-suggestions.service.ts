import { Injectable } from '@nestjs/common';
import {
  PSYCHOSOCIAL_RISK_CLASS_LABEL,
  actionTermDays,
  type PsychosocialRiskMatrixRow,
  type RiskActionSuggestion,
  type RiskActionSuggestions,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { PsychosocialService } from '../psychosocial/psychosocial.service';
import { AiSettingsService } from '../admin/ai-settings.service';
import {
  AI_PLANS_TIMEOUT_LISTAGEM_MS,
  planEntryFor,
  resolveActionPlans,
} from './psychosocial-action-plans';
import { resolveTenantInstrument } from '../admin/methodology.service';

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
 * `bloqueiosDoPlano` continua barrando a emissão do dossiê final: é a regra
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
   * Gera o plano automaticamente a partir da matriz de risco.
   *
   * Decisão do cliente em 2026-09-08: relatório, dossiê e plano saem sem
   * depender de alguém apertar um botão. As ações nascem com o status PADRÃO
   * (SUGERIDA) de propósito — o mesmo cliente pediu que o plano "também deve
   * ser validado e ajustado". Marcá-las como APROVADA seria registrar no banco
   * uma validação humana que não aconteceu, e o dossiê sairia afirmando que a
   * organização aprovou o que a IA escreveu.
   *
   * O que muda em relação a antes é o GATILHO, não a regra: as ações passam a
   * existir sozinhas no Plano de Evolução, onde a organização valida, ajusta,
   * acrescenta ou substitui. O que trava a emissão do dossiê é que deixou de
   * existir (ver `bloqueiosDoPlano`).
   *
   * Idempotente por `@@unique([planId, suggestionKey])`: pré-visualizar o
   * dossiê várias vezes não duplica ação nenhuma.
   */
  async gerarPlanoAutomatico(tenantId: string): Promise<number> {
    const { suggestions } = await this.list(tenantId);
    const novas = suggestions.filter((s) => !s.alreadyInPlan);
    if (!novas.length) return 0;
    // MESMO instrumento que produziu a matriz em list() (psychosocial.results
    // resolve pelo contrato do tenant) — fixo no Organizacional aqui, o plano
    // automático de uma empresa Essencial carimbava a proveniência com o
    // diagnóstico de outra empresa.
    const { slug: instrumento } = await resolveTenantInstrument(this.prisma, tenantId);

    return this.prisma.forTenant(tenantId, async (tx) => {
      // Ciclo de diagnóstico aberto no momento — é o que amarra a ação ao ciclo
      // que a originou. Sem ciclo aberto a ação nasce sem carimbo, e o rastro
      // vai até o fator; melhor isso do que inventar um vínculo.
      const cicloAberto = await tx.diagnosticCycle.findFirst({
        where: { status: 'ABERTO' },
        select: { id: true },
      });
      const plano =
        (await tx.actionPlan.findFirst({ orderBy: { createdAt: 'asc' } })) ??
        (await tx.actionPlan.create({
          data: {
            tenantId,
            title: 'Plano de Evolução — gerado pelo diagnóstico',
            source: 'questionário',
            sourceInstrumentSlug: instrumento,
          },
        }));

      let criadas = 0;
      for (const x of novas) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + actionTermDays(x.prazo));
        const item = await tx.actionItem.create({
          data: {
            tenantId,
            planId: plano.id,
            point: x.factorLabel,
            action: `${x.title} — ${x.etapas}`.slice(0, 600),
            origin: 'questionário',
            sourceInstrumentSlug: instrumento,
            dueDate,
            indicator: x.indicadores,
            // A sugestão já traz o objetivo escrito pela IA. Este caminho (o que
            // gera as ações ao abrir o Plano) o descartava, e a coluna
            // "Objetivo" do Dossiê saía "—" em toda ação — item dos Ajustes
            // Finais de Homologação. O outro caminho (aceitar sugestão) já gravava.
            objective: x.objetivo,
            // severity/probability (a matriz 3x3 em texto) ficam VAZIOS: as duas
            // réguas não derivam uma da outra e a classificação técnica do
            // dossiê é decisão da empresa.
            riskFactorSlug: x.factorSlug,
            riskProbability: x.probability,
            riskSeverity: x.severity,
            suggestionKey: x.key,
            cycleId: cicloAberto?.id ?? null,
          },
        });
        await tx.actionItemHistory.create({
          data: {
            tenantId,
            actionItemId: item.id,
            change: `Ação gerada automaticamente a partir da matriz de risco (${riskOriginLabel(x)}) — pendente de validação e ajuste pela organização`,
            changedBy: null,
          },
        });
        criadas += 1;
      }
      return criadas;
    });
  }

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

    // A IA so e consultada se houver o que sugerir. Antes ela era chamada ANTES
    // de olhar o plano, entao toda abertura da tela pagava a chamada — mesmo com
    // todos os fatores ja cobertos, que e o caso normal depois da primeira vez.
    const fatoresCobertos = await this.fatoresComAcao(tenantId, planId);
    // So os fatores SEM acao ativa recebem sugestao. Antes, bastava um fator
    // descoberto para a IA rodar sobre TODOS os obrigatorios e cada titulo novo
    // (a IA varia a cada chamada) virar mais uma sugestao nos fatores que ja
    // tinham a sua — visto em producao 21/09: descartar 3 de um fator gerou 4
    // novas, uma em cada fator.
    const pendentes = required.filter((r) => !fatoresCobertos.has(r.slug));
    if (!pendentes.length) {
      return {
        origin: 'biblioteca',
        suggestions: [],
        reason:
          'Todos os fatores com plano obrigatório já têm ação no Plano de Evolução. ' +
          'Novas sugestões aparecem quando um novo fator atingir risco 10 ou mais.',
      };
    }

    const { plans, origin } = await resolveActionPlans(
      { prisma: this.prisma, aiSettings: this.aiSettings },
      tenantId,
      pendentes,
      // Mesmo instrumento que produziu a matriz (psychosocial.results resolve
      // pelo CONTRATO do tenant) — é por ele que o prompt personalizado da IA da
      // Plataforma e a rede de segurança `factor_action_plans` são resolvidos.
      // Fixo no Organizacional, o Essencial recebia o prompt de outro diagnóstico.
      (await resolveTenantInstrument(this.prisma, tenantId)).slug,
      // Esta lista é pedida ao ABRIR o Plano de Evolução, e o portal desiste em
      // 15s. Com o orçamento antigo (22s) a tela morria em "Não foi possível
      // carregar" toda vez que a IA demorava — e o fallback da biblioteca, que
      // é instantâneo, nunca chegava a aparecer. Medido em produção depois dos
      // lotes: 10,9s para 14 fatores, com folga dentro dos 12s.
      AI_PLANS_TIMEOUT_LISTAGEM_MS,
    );
    const jaNoPlano = await this.acceptedKeys(tenantId, planId);

    // A matriz vem ordenada por risco desc, então o fator de MAIOR risco de cada
    // dimensão reivindica as ações dela: sem isto, três fatores da mesma dimensão
    // repetiriam as mesmas ações três vezes.
    const vistas = new Set<string>();
    const suggestions: RiskActionSuggestion[] = [];
    for (const r of pendentes) {
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
  /**
   * Fatores que JA tem acao no plano. Checagem barata (uma consulta) que evita a
   * chamada de IA quando nao ha nada novo a sugerir.
   */
  private async fatoresComAcao(tenantId: string, planId?: string): Promise<Set<string>> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.actionItem.findMany({
        // Descartada (NAO_ADOTADA) nao conta como cobertura: se a empresa
        // descartou TODAS as sugestoes de um fator obrigatorio, ele fica sem
        // acao e sem saida — a IA nunca mais era consultada para ele
        // (homologacao 21/09). As chaves ja descartadas nao voltam
        // (`acceptedKeys` -> alreadyInPlan), so entram sugestoes NOVAS.
        where: {
          riskFactorSlug: { not: null },
          status: { not: 'NAO_ADOTADA' },
          ...(planId ? { planId } : {}),
        },
        select: { riskFactorSlug: true },
      });
      return new Set(rows.map((r) => r.riskFactorSlug).filter((k): k is string => !!k));
    });
  }

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
