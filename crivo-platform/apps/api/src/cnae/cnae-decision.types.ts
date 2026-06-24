// Tipos do Motor de Decisão CNAE/NR-1. Desacoplados do Prisma para manter as
// funções puras testáveis sem banco.

export type CnaeRiskLevel = 'BAIXO' | 'BAIXO_MEDIO' | 'MEDIO' | 'MEDIO_ALTO' | 'ALTO';
export type CnaeMethod = 'ESSENCIAL' | 'ORGANIZACIONAL';

/** Estrutura mínima de uma regra de divisão usada pela lógica de decisão. */
export interface DivisionRuleLike {
  divisionCode: string;
  officialName: string;
  preliminaryRiskLevel: CnaeRiskLevel;
  defaultMethod: CnaeMethod | 'INICIAL';
  defaultTechnicalOutput?: string | null;
  pgrRequired: boolean;
  riskInventoryRequired: boolean;
  aepRequired: boolean;
  evidenceRequired: boolean;
  executiveReportRequired: boolean;
  actionPlanRequired: boolean;
  isActive?: boolean;
}

/** CNAE secundário já resolvido para sua divisão/risco (lookup feito fora). */
export interface SecondaryDivision {
  cnaeCode: string;
  divisionCode: string;
  officialName: string;
  preliminaryRiskLevel: CnaeRiskLevel;
}

/** Entrada do motor (dados da empresa + sinais operacionais do consultor). */
export interface CnaeEvaluationInput {
  companyId?: string | null;
  cnpj?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnaePrincipalCodigo?: string | null;
  cnaePrincipalDescricao?: string | null;
  cnaesSecundarios?: string[] | null; // códigos CNAE (com ou sem máscara)
  situacaoCadastral?: string | null;
  porte?: string | null;
  numeroColaboradores?: number | null;
  possuiMultiplasUnidades?: boolean;
  possuiEquipeOperacional?: boolean;
  possuiTurnos?: boolean;
  possuiAtendimentoPublico?: boolean;
  possuiTrabalhoExterno?: boolean;
  possuiMetasComerciaisIntensas?: boolean;
  possuiHistoricoAfastamentos?: boolean;
  demandaNr1Completa?: boolean;
  observacoesDoConsultor?: string | null;
}

/** Saída do motor — recomendação preliminar técnica. */
export interface CnaeDecisionResult {
  empresa: string | null;
  cnpj: string | null;
  cnaePrincipalCodigo: string | null;
  cnaePrincipalDescricao: string | null;
  divisionCode: string | null;
  divisionName: string | null;
  preliminaryRiskLevel: CnaeRiskLevel | null;
  recommendedMethod: CnaeMethod | null;
  technicalOutputs: string[];
  requiredDocuments: string[];
  requiredEvidences: string[];
  decisionScore: number; // 0–100, força do sinal pró-Organizacional (transparência)
  decisionReason: string;
  manualReviewRequired: boolean;
  warnings: string[];
  nextSteps: string[];
  criteriaConsidered: string[]; // fatores usados — alimenta "Base Técnica da Recomendação"
  isPreliminary: true;
}

export const RISK_LABEL: Record<CnaeRiskLevel, string> = {
  BAIXO: 'Baixo',
  BAIXO_MEDIO: 'Baixo/Médio',
  MEDIO: 'Médio',
  MEDIO_ALTO: 'Médio/Alto',
  ALTO: 'Alto',
};

export const METHOD_LABEL: Record<CnaeMethod, string> = {
  ESSENCIAL: 'Diagnóstico Essencial',
  ORGANIZACIONAL: 'Diagnóstico Organizacional',
};

/** Aviso obrigatório de não-vinculação jurídica (compliance/UX). */
export const PRELIMINARY_DISCLAIMER =
  'Classificação preliminar técnica. Não substitui laudo, parecer jurídico ou análise técnica presencial. ' +
  'Validar atividade real da empresa, número de colaboradores, ambiente de trabalho e exigências aplicáveis. ' +
  'A recomendação pode ser revisada por especialista conforme a realidade operacional.';
