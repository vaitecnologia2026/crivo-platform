import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CnaeDecisionResult,
  CnaeEvaluationInput,
  CnaeMethod,
  CnaeRiskLevel,
  DivisionRuleLike,
  METHOD_LABEL,
  PRELIMINARY_DISCLAIMER,
  RISK_LABEL,
  SecondaryDivision,
} from './cnae-decision.types';

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÕES PURAS — sem NestJS, sem banco. 100% testáveis isoladamente.
// ─────────────────────────────────────────────────────────────────────────────

/** Extrai a divisão CNAE (2 primeiros dígitos) de um código CNAE. */
export function divisionFromCnae(cnae?: string | null): string | null {
  const digits = (cnae ?? '').replace(/\D/g, '');
  if (digits.length < 2) return null;
  return digits.slice(0, 2);
}

const RISK_RANK: Record<CnaeRiskLevel, number> = {
  BAIXO: 0,
  BAIXO_MEDIO: 1,
  MEDIO: 2,
  MEDIO_ALTO: 3,
  ALTO: 4,
};

export function riskRank(level: CnaeRiskLevel): number {
  return RISK_RANK[level] ?? 0;
}

export interface MethodDecision {
  method: CnaeMethod | null; // null = dispensa documental da NR-1 (0 funcionários)
  dispensa: boolean;
  headcountUnknown: boolean;
  altoRisco: boolean; // grupo de risco: MEDIO_ALTO/ALTO = true; baixo/baixo_médio/médio = false
  reasons: string[];
  criteria: string[];
  score: number;
}

/** Grupo de risco do enquadramento NR-1: "Médio/Alto ou Alto" (true) vs "Baixo" (false). */
export function isAltoRisco(level: CnaeRiskLevel): boolean {
  return riskRank(level) >= 3; // MEDIO_ALTO ou ALTO
}

/**
 * Enquadramento NR-1 (regra de negócio do cliente). Cruza o GRUPO de risco da
 * divisão CNAE com o número de funcionários (corte em 9):
 *   • 0 funcionários            → dispensa documental da NR-1.
 *   • Baixo + até 9             → Diagnóstico Essencial.
 *   • Baixo + mais de 9         → Diagnóstico Organizacional.
 *   • Médio/Alto/Alto + até 9   → Diagnóstico Essencial (com PGR/Inventário).
 *   • Médio/Alto/Alto + mais 9  → Diagnóstico Organizacional (completo).
 * Grupo "Baixo" = BAIXO/BAIXO_MEDIO/MEDIO; "Médio/Alto ou Alto" = MEDIO_ALTO/ALTO.
 */
export function recommendMethod(input: CnaeEvaluationInput, rule: DivisionRuleLike): MethodDecision {
  const risk = rule.preliminaryRiskLevel;
  const altoRisco = isAltoRisco(risk);
  const grupo = altoRisco ? 'Médio/Alto ou Alto' : 'Baixo';
  const hcRaw = input.numeroColaboradores;
  const hc = hcRaw != null ? Math.max(0, Math.floor(hcRaw)) : null;
  const criteria: string[] = [`Divisão CNAE ${rule.divisionCode} — risco ${RISK_LABEL[risk]} (grupo ${grupo}).`];
  const reasons: string[] = [];

  // ETAPA 1 — 0 funcionários: dispensa documental.
  if (hc === 0) {
    criteria.push('Funcionários: 0.');
    reasons.push('Empresa com 0 funcionários: dispensa documental da NR-1.');
    return { method: null, dispensa: true, headcountUnknown: false, altoRisco, reasons, criteria, score: 0 };
  }

  // Número de funcionários não informado — recomendação provisória pelo risco.
  if (hc == null) {
    criteria.push('Funcionários: não informado.');
    reasons.push('Número de funcionários não informado — confirme para o enquadramento definitivo (corte em 9).');
    const method: CnaeMethod = altoRisco ? 'ORGANIZACIONAL' : 'ESSENCIAL';
    return { method, dispensa: false, headcountUnknown: true, altoRisco, reasons, criteria, score: altoRisco ? 60 : 35 };
  }

  // ETAPA 2 — corte em 9 funcionários.
  criteria.push(`Funcionários: ${hc}.`);
  const method: CnaeMethod = hc > 9 ? 'ORGANIZACIONAL' : 'ESSENCIAL';
  reasons.push(`Risco ${grupo} com ${hc > 9 ? 'mais de 9' : 'até 9'} funcionário(s) → ${METHOD_LABEL[method]}.`);
  const score = method === 'ORGANIZACIONAL' ? (altoRisco ? 100 : 75) : altoRisco ? 60 : 35;
  return { method, dispensa: false, headcountUnknown: false, altoRisco, reasons, criteria, score };
}

/** Saídas técnicas conforme as 4 regras de enquadramento NR-1. */
export function buildTechnicalOutputs(
  input: CnaeEvaluationInput,
  rule: DivisionRuleLike,
  md: MethodDecision,
): { outputs: string[]; documents: string[]; evidences: string[] } {
  if (md.dispensa || !md.method) return { outputs: [], documents: [], evidences: [] };
  const org = md.method === 'ORGANIZACIONAL';
  // AEP "quando aplicável" na REGRA 1 (Baixo, ≤9): só com esforço físico/turno/campo.
  const aepAplicavel = !!(
    input.possuiEquipeOperacional ||
    input.possuiTurnos ||
    input.possuiTrabalhoExterno ||
    rule.aepRequired
  );

  let saidas: string[];
  if (!md.altoRisco) {
    saidas = org
      ? ['AEP', 'Relatório Executivo', 'Evidências', 'Dashboard Executivo', 'Plano de Ação'] // REGRA 2
      : ['Leitura Preliminar', ...(aepAplicavel ? ['AEP'] : []), 'Relatório Executivo', 'Evidências']; // REGRA 1
  } else {
    saidas = org
      ? ['AEP', 'PGR', 'Inventário de Riscos', 'Plano de Ação', 'Evidências', 'Dashboard Executivo', 'Relatório Executivo'] // REGRA 4
      : ['AEP', 'PGR', 'Inventário de Riscos', 'Plano de Ação', 'Evidências']; // REGRA 3
  }

  const outputs = [METHOD_LABEL[md.method], ...saidas];
  const docSet = new Set([
    'PGR',
    'Inventário de Riscos',
    'AEP',
    'Relatório Executivo',
    'Plano de Ação',
    'Dashboard Executivo',
  ]);
  const documents = saidas.filter((s) => docSet.has(s));
  const evidences = saidas.includes('Evidências')
    ? ['Evidências documentais das ações, controles e comunicações']
    : [];
  return { outputs, documents, evidences };
}

export function buildDecisionReason(
  input: CnaeEvaluationInput,
  rule: DivisionRuleLike,
  md: MethodDecision,
): string {
  const empresa = input.razaoSocial || input.nomeFantasia || 'A empresa';
  const grupo = md.altoRisco ? 'Médio/Alto ou Alto' : 'Baixo';
  const base =
    `${empresa} — divisão CNAE ${rule.divisionCode} (${rule.officialName}), risco ${RISK_LABEL[rule.preliminaryRiskLevel]} ` +
    `(grupo ${grupo}). ${md.reasons.join(' ')}`;
  if (md.dispensa) return `${base} Não se aplica AEP, PGR, Inventário de Riscos ou Plano de Ação.`;
  return `${base} Recomenda-se ${md.method ? METHOD_LABEL[md.method] : '—'}.`;
}

function buildNextSteps(method: CnaeMethod, documents: string[]): string[] {
  if (method === 'ORGANIZACIONAL') {
    const steps = [
      'Validar dados operacionais',
      'Confirmar número de colaboradores',
      'Selecionar questionário organizacional',
    ];
    if (documents.length) steps.push(`Preparar documentação: ${documents.join(', ')}`);
    steps.push('Gerar plano de ação inicial');
    return steps;
  }
  return [
    'Validar dados operacionais e número de colaboradores',
    'Aplicar o Diagnóstico Essencial',
    'Gerar relatório executivo e orientações de plano de ação',
  ];
}

function emptyOutputs(): Pick<
  CnaeDecisionResult,
  'technicalOutputs' | 'requiredDocuments' | 'requiredEvidences'
> {
  return { technicalOutputs: [], requiredDocuments: [], requiredEvidences: [] };
}

/**
 * Orquestrador PURO da decisão: recebe a empresa + a regra da divisão principal
 * + as divisões dos CNAEs secundários (já resolvidas) e devolve a recomendação.
 * Toda persistência fica fora (CnaeDecisionEngine.evaluate).
 */
export function evaluateDecision(params: {
  input: CnaeEvaluationInput;
  rule: DivisionRuleLike | null;
  secondaryDivisions?: SecondaryDivision[];
}): CnaeDecisionResult {
  const { input } = params;
  const empresa = input.razaoSocial || input.nomeFantasia || null;
  const warnings: string[] = [PRELIMINARY_DISCLAIMER];
  const divisionCode = divisionFromCnae(input.cnaePrincipalCodigo);

  // Validação: CNAE ausente/inválido → revisão manual.
  if (!input.cnaePrincipalCodigo || !divisionCode) {
    warnings.unshift('CNAE principal ausente ou inválido — recomendação não pôde ser calculada automaticamente.');
    return {
      empresa,
      cnpj: input.cnpj ?? null,
      cnaePrincipalCodigo: input.cnaePrincipalCodigo ?? null,
      cnaePrincipalDescricao: input.cnaePrincipalDescricao ?? null,
      divisionCode: null,
      divisionName: null,
      preliminaryRiskLevel: null,
      recommendedMethod: null,
      ...emptyOutputs(),
      decisionScore: 0,
      decisionReason: 'CNAE principal ausente. Revisão manual necessária.',
      manualReviewRequired: true,
      warnings,
      nextSteps: ['Informar o CNAE principal da empresa', 'Revisar manualmente com especialista'],
      criteriaConsidered: [],
      isPreliminary: true,
    };
  }

  // Validação: divisão sem regra cadastrada → revisão manual.
  if (!params.rule) {
    warnings.unshift(`Divisão CNAE ${divisionCode} não encontrada na tabela de regras — revisão manual necessária.`);
    return {
      empresa,
      cnpj: input.cnpj ?? null,
      cnaePrincipalCodigo: input.cnaePrincipalCodigo ?? null,
      cnaePrincipalDescricao: input.cnaePrincipalDescricao ?? null,
      divisionCode,
      divisionName: null,
      preliminaryRiskLevel: null,
      recommendedMethod: null,
      ...emptyOutputs(),
      decisionScore: 0,
      decisionReason: `Divisão CNAE ${divisionCode} sem regra cadastrada. Revisão manual necessária.`,
      manualReviewRequired: true,
      warnings,
      nextSteps: ['Cadastrar a regra da divisão CNAE', 'Revisar manualmente com especialista'],
      criteriaConsidered: [],
      isPreliminary: true,
    };
  }

  const rule = params.rule;
  let manualReviewRequired = false;
  if (rule.isActive === false) {
    warnings.push(`A regra da divisão ${divisionCode} está inativa; usada apenas como referência.`);
    manualReviewRequired = true;
  }

  // Situação cadastral não-ativa → alerta + revisão.
  if (input.situacaoCadastral && !/ativ/i.test(input.situacaoCadastral)) {
    warnings.push(`Situação cadastral informada: "${input.situacaoCadastral}". Confirmar antes de gerar diagnóstico.`);
    manualReviewRequired = true;
  }

  const md = recommendMethod(input, rule);
  const method = md.method;

  // Alto e médio-alto sempre passam por validação de especialista (alto risco).
  const principalRank = riskRank(rule.preliminaryRiskLevel);
  if (principalRank >= 3) manualReviewRequired = true;

  // CNAE secundário com risco maior que o principal → mantém principal + revisão.
  const higherSecondary = (params.secondaryDivisions ?? []).filter(
    (s) => riskRank(s.preliminaryRiskLevel) > principalRank,
  );
  if (higherSecondary.length) {
    manualReviewRequired = true;
    const list = higherSecondary
      .map((s) => `${s.divisionCode} ${s.officialName} (${RISK_LABEL[s.preliminaryRiskLevel]})`)
      .join('; ');
    warnings.push(
      `Existe CNAE secundário com risco superior ao CNAE principal: ${list}. ` +
        'O CNAE principal foi mantido como referência oficial; o especialista deve revisar e escolher o CNAE considerado para o diagnóstico.',
    );
  }

  // Número de funcionários não informado → confirmar (o corte do enquadramento é em 9).
  if (md.headcountUnknown) {
    manualReviewRequired = true;
    warnings.push('Número de funcionários não informado — confirme para o enquadramento NR-1 definitivo (corte em 9).');
  }
  // 0 funcionários → dispensa documental da NR-1.
  if (md.dispensa) {
    warnings.unshift('Dispensa documental da NR-1 — empresa com 0 funcionários.');
  }

  const { outputs, documents, evidences } = buildTechnicalOutputs(input, rule, md);
  const decisionReason = buildDecisionReason(input, rule, md);
  const nextSteps = md.dispensa
    ? ['Reavaliar o enquadramento quando a empresa tiver funcionários']
    : method
      ? buildNextSteps(method, documents)
      : ['Confirmar o número de funcionários para o enquadramento'];

  return {
    empresa,
    cnpj: input.cnpj ?? null,
    cnaePrincipalCodigo: input.cnaePrincipalCodigo ?? null,
    cnaePrincipalDescricao: input.cnaePrincipalDescricao ?? null,
    divisionCode,
    divisionName: rule.officialName,
    preliminaryRiskLevel: rule.preliminaryRiskLevel,
    recommendedMethod: method,
    technicalOutputs: outputs,
    requiredDocuments: documents,
    requiredEvidences: evidences,
    decisionScore: md.score,
    decisionReason,
    manualReviewRequired,
    warnings,
    nextSteps,
    criteriaConsidered: md.criteria,
    isPreliminary: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVIÇO INJETÁVEL — orquestra os lookups no banco + persiste o histórico.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable()
export class CnaeDecisionEngine {
  private readonly log = new Logger('CnaeDecisionEngine');

  constructor(private readonly prisma: PrismaService) {}

  getDivisionFromCnae(cnae?: string | null): string | null {
    return divisionFromCnae(cnae);
  }

  async getDivisionRule(divisionCode: string) {
    return this.prisma.admin.cnaeDivisionRule.findUnique({ where: { divisionCode } });
  }

  /** Avalia a empresa, persiste o histórico e devolve a recomendação preliminar. */
  async evaluate(
    input: CnaeEvaluationInput,
    actor?: { id?: string; email?: string },
  ): Promise<CnaeDecisionResult> {
    const divisionCode = divisionFromCnae(input.cnaePrincipalCodigo);
    const rule = divisionCode ? await this.getDivisionRule(divisionCode) : null;

    // Resolve as divisões dos CNAEs secundários (para a regra de risco superior).
    const secCodes = Array.from(
      new Set(
        (input.cnaesSecundarios ?? [])
          .map((c) => divisionFromCnae(c))
          .filter((d): d is string => !!d),
      ),
    );
    const secRules = secCodes.length
      ? await this.prisma.admin.cnaeDivisionRule.findMany({ where: { divisionCode: { in: secCodes } } })
      : [];
    const secondaryDivisions: SecondaryDivision[] = secRules.map((r) => ({
      cnaeCode: r.divisionCode,
      divisionCode: r.divisionCode,
      officialName: r.officialName,
      preliminaryRiskLevel: r.preliminaryRiskLevel as CnaeRiskLevel,
    }));

    const result = evaluateDecision({
      input,
      rule: rule as DivisionRuleLike | null,
      secondaryDivisions,
    });
    await this.saveDecisionHistory(input, rule, result, actor);
    return result;
  }

  /** Salva uma cópia imutável da decisão (auditoria). Best-effort: nunca trava. */
  async saveDecisionHistory(
    input: CnaeEvaluationInput,
    rule: unknown,
    result: CnaeDecisionResult,
    actor?: { id?: string; email?: string },
  ): Promise<void> {
    try {
      await this.prisma.admin.cnaeDecisionHistory.create({
        data: {
          companyId: input.companyId ?? null,
          cnpj: result.cnpj,
          cnaeCode: input.cnaePrincipalCodigo ?? null,
          divisionCode: result.divisionCode,
          inputData: input as object,
          divisionRule: (rule as object) ?? undefined,
          decisionResult: result as unknown as object,
          recommendedMethod: result.recommendedMethod,
          riskLevel: result.preliminaryRiskLevel,
          manualReviewRequired: result.manualReviewRequired,
          reviewedBy: actor?.email ?? null,
        },
      });
    } catch (e) {
      this.log.warn(`Falha ao salvar histórico CNAE: ${e instanceof Error ? e.message : e}`);
    }
  }
}
