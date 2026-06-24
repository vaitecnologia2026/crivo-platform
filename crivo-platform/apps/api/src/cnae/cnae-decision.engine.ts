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
  method: CnaeMethod;
  reasons: string[];
  criteria: string[];
  score: number;
  activeTriggers: string[];
}

/**
 * Aplica as regras 1–5 (por nível de risco) + pesos complementares por porte.
 * Elevação MONOTÔNICA: gatilhos só empurram para Organizacional, nunca rebaixam.
 */
export function recommendMethod(input: CnaeEvaluationInput, rule: DivisionRuleLike): MethodDecision {
  const risk = rule.preliminaryRiskLevel;
  const rank = riskRank(risk);
  const hc = Math.max(0, Math.floor(input.numeroColaboradores ?? 0));
  const reasons: string[] = [];
  const criteria: string[] = [`Divisão CNAE ${rule.divisionCode} — risco preliminar ${RISK_LABEL[risk]}.`];

  const triggerDefs: [string, boolean | undefined][] = [
    ['múltiplas unidades', input.possuiMultiplasUnidades],
    ['equipe operacional', input.possuiEquipeOperacional],
    ['turnos', input.possuiTurnos],
    ['atendimento ao público', input.possuiAtendimentoPublico],
    ['trabalho externo/campo', input.possuiTrabalhoExterno],
    ['metas comerciais intensas', input.possuiMetasComerciaisIntensas],
    ['histórico de afastamentos', input.possuiHistoricoAfastamentos],
    ['demanda por NR-1 completa', input.demandaNr1Completa],
  ];
  const activeTriggers = triggerDefs.filter(([, v]) => v).map(([k]) => k);
  if (activeTriggers.length) criteria.push(`Gatilhos operacionais: ${activeTriggers.join(', ')}.`);
  if (hc > 0) criteria.push(`Número de colaboradores informado: ${hc}.`);

  let method: CnaeMethod = rule.defaultMethod === 'ORGANIZACIONAL' ? 'ORGANIZACIONAL' : 'ESSENCIAL';
  let score = rank * 12; // 0..48 do risco
  score += activeTriggers.length * 6;

  // Regras 1–5 (por nível de risco)
  if (rank >= 3) {
    method = 'ORGANIZACIONAL';
    reasons.push(
      risk === 'ALTO' ? 'Divisão CNAE de alto risco ocupacional.' : 'Divisão CNAE de risco médio-alto.',
    );
  } else if (risk === 'MEDIO') {
    if (activeTriggers.length > 0) {
      method = 'ORGANIZACIONAL';
      reasons.push('Risco médio com gatilho(s) operacional(is) relevante(s).');
    } else {
      reasons.push('Risco médio sem gatilho operacional relevante — Essencial como base.');
    }
  } else if (risk === 'BAIXO_MEDIO') {
    if (hc > 20 || activeTriggers.length > 0) {
      method = 'ORGANIZACIONAL';
      reasons.push('Risco baixo-médio elevado por porte (>20 colaboradores) e/ou gatilho operacional.');
    }
  } else {
    // BAIXO
    if (hc > 50 || input.possuiMultiplasUnidades || input.demandaNr1Completa) {
      method = 'ORGANIZACIONAL';
      reasons.push('Risco baixo elevado por porte (>50), múltiplas unidades ou demanda formal de NR-1.');
    }
  }

  // Pesos complementares por porte (elevação monotônica)
  if (hc >= 200) {
    method = 'ORGANIZACIONAL';
    score += 30;
    reasons.push('Mais de 200 colaboradores: Organizacional como recomendação padrão.');
  } else if (hc >= 51) {
    method = 'ORGANIZACIONAL';
    score += 20;
    reasons.push('51 a 200 colaboradores: prioriza Organizacional.');
  } else if (hc >= 21) {
    const presencial = !!(
      input.possuiEquipeOperacional ||
      input.possuiAtendimentoPublico ||
      input.possuiTurnos ||
      input.possuiTrabalhoExterno ||
      input.possuiMultiplasUnidades
    );
    if (presencial) {
      method = 'ORGANIZACIONAL';
      score += 12;
      reasons.push('21 a 50 colaboradores com operação presencial/estruturada.');
    }
  } else if (hc >= 6) {
    if (rank >= 2) {
      method = 'ORGANIZACIONAL';
      score += 8;
      reasons.push('6 a 20 colaboradores em divisão de risco médio ou maior.');
    }
  }
  // 1–5 colaboradores: mantém Essencial, exceto alto/médio-alto (já forçado acima).

  if (method === 'ORGANIZACIONAL') score = Math.max(score, 60);
  score = Math.min(100, Math.max(0, Math.round(score)));
  return { method, reasons, criteria, score, activeTriggers };
}

/** Monta saídas técnicas / documentos / evidências a partir das flags da regra. */
export function buildTechnicalOutputs(
  input: CnaeEvaluationInput,
  rule: DivisionRuleLike,
  method: CnaeMethod,
): { outputs: string[]; documents: string[]; evidences: string[] } {
  const outputs: string[] = [METHOD_LABEL[method]];
  // AEP: pela regra OU por operação com esforço físico/turno/campo.
  const aep =
    rule.aepRequired ||
    !!(input.possuiEquipeOperacional || input.possuiTurnos || input.possuiTrabalhoExterno);
  if (rule.pgrRequired) outputs.push('PGR');
  if (rule.riskInventoryRequired) outputs.push('Inventário de Riscos');
  if (aep) outputs.push('AEP');
  if (rule.evidenceRequired) outputs.push('Evidências');
  if (rule.executiveReportRequired) outputs.push('Relatório Executivo');
  if (rule.actionPlanRequired) outputs.push('Plano de Ação');

  const docSet = new Set(['PGR', 'Inventário de Riscos', 'AEP', 'Relatório Executivo', 'Plano de Ação']);
  const documents = outputs.filter((o) => docSet.has(o));
  const evidences = rule.evidenceRequired
    ? ['Evidências documentais das ações, controles e comunicações']
    : [];
  return { outputs, documents, evidences };
}

export function buildDecisionReason(
  input: CnaeEvaluationInput,
  rule: DivisionRuleLike,
  method: CnaeMethod,
  reasons: string[],
): string {
  const empresa = input.razaoSocial || input.nomeFantasia || 'A empresa';
  return (
    `${empresa} foi classificada na divisão CNAE ${rule.divisionCode} (${rule.officialName}), ` +
    `com risco preliminar ${RISK_LABEL[rule.preliminaryRiskLevel]}. ${reasons.join(' ')} ` +
    `Recomenda-se ${METHOD_LABEL[method]}${method === 'ORGANIZACIONAL' ? ' com documentação técnica ampliada' : ''}.`
  );
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

  // Risco médio sem porte informado → confirmar antes de fechar.
  if (rule.preliminaryRiskLevel === 'MEDIO' && input.numeroColaboradores == null) {
    manualReviewRequired = true;
    warnings.push('Risco médio sem número de colaboradores informado — confirmar porte para a decisão definitiva.');
  }

  const { outputs, documents, evidences } = buildTechnicalOutputs(input, rule, method);
  const decisionReason = buildDecisionReason(input, rule, method, md.reasons);
  const nextSteps = buildNextSteps(method, documents);

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
