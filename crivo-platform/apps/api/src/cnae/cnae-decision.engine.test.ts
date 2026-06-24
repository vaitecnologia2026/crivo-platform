import { describe, it, expect } from 'vitest';
import { divisionFromCnae, evaluateDecision, riskRank } from './cnae-decision.engine';
import { CnaeEvaluationInput, DivisionRuleLike, SecondaryDivision } from './cnae-decision.types';

function mkRule(over: Partial<DivisionRuleLike> = {}): DivisionRuleLike {
  return {
    divisionCode: '62',
    officialName: 'Tecnologia da informação',
    preliminaryRiskLevel: 'BAIXO',
    defaultMethod: 'ESSENCIAL',
    pgrRequired: false,
    riskInventoryRequired: false,
    aepRequired: false,
    evidenceRequired: false,
    executiveReportRequired: true,
    actionPlanRequired: true,
    isActive: true,
    ...over,
  };
}

const ALTO = mkRule({
  divisionCode: '86',
  officialName: 'Atividades de atenção à saúde humana',
  preliminaryRiskLevel: 'ALTO',
  defaultMethod: 'ORGANIZACIONAL',
  pgrRequired: true,
  riskInventoryRequired: true,
  aepRequired: true,
  evidenceRequired: true,
});

describe('divisionFromCnae', () => {
  it('extrai os 2 primeiros dígitos de um CNAE mascarado', () => {
    expect(divisionFromCnae('8610-1/01')).toBe('86');
  });
  it('aceita código só com dígitos', () => {
    expect(divisionFromCnae('6201500')).toBe('62');
  });
  it('retorna null para vazio/ausente', () => {
    expect(divisionFromCnae('')).toBeNull();
    expect(divisionFromCnae(null)).toBeNull();
    expect(divisionFromCnae('1')).toBeNull();
  });
});

describe('riskRank', () => {
  it('ordena os níveis de risco', () => {
    expect(riskRank('BAIXO')).toBeLessThan(riskRank('MEDIO'));
    expect(riskRank('MEDIO')).toBeLessThan(riskRank('ALTO'));
  });
});

describe('evaluateDecision — CNAE de alto risco', () => {
  const r = evaluateDecision({
    input: { cnaePrincipalCodigo: '8610-1/01', razaoSocial: 'Hospital Exemplo' },
    rule: ALTO,
  });
  it('recomenda Organizacional', () => expect(r.recommendedMethod).toBe('ORGANIZACIONAL'));
  it('inclui PGR, Inventário, AEP, Relatório e Plano de Ação', () => {
    expect(r.technicalOutputs).toEqual(
      expect.arrayContaining(['PGR', 'Inventário de Riscos', 'AEP', 'Relatório Executivo', 'Plano de Ação']),
    );
  });
  it('exige revisão manual e é preliminar', () => {
    expect(r.manualReviewRequired).toBe(true);
    expect(r.isPreliminary).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('classifica risco ALTO', () => expect(r.preliminaryRiskLevel).toBe('ALTO'));
});

describe('evaluateDecision — CNAE de baixo risco', () => {
  const r = evaluateDecision({
    input: { cnaePrincipalCodigo: '6201-5/00', razaoSocial: 'Software Ltda', numeroColaboradores: 4 },
    rule: mkRule(),
  });
  it('recomenda Essencial', () => expect(r.recommendedMethod).toBe('ESSENCIAL'));
  it('não força revisão manual', () => expect(r.manualReviewRequired).toBe(false));
  it('não inclui PGR', () => expect(r.technicalOutputs).not.toContain('PGR'));
});

describe('evaluateDecision — principal baixo + secundário de risco maior', () => {
  const secondary: SecondaryDivision[] = [
    { cnaeCode: '33', divisionCode: '33', officialName: 'Manutenção de máquinas', preliminaryRiskLevel: 'ALTO' },
  ];
  const r = evaluateDecision({
    input: { cnaePrincipalCodigo: '6201-5/00', razaoSocial: 'Tech + Manutenção', cnaesSecundarios: ['3314-7/10'] },
    rule: mkRule(),
    secondaryDivisions: secondary,
  });
  it('mantém o CNAE principal como referência (divisão 62)', () => expect(r.divisionCode).toBe('62'));
  it('exige revisão manual', () => expect(r.manualReviewRequired).toBe(true));
  it('alerta sobre o CNAE secundário de risco superior', () => {
    expect(r.warnings.some((w) => /secundário com risco superior/i.test(w))).toBe(true);
  });
});

describe('evaluateDecision — porte eleva para Organizacional', () => {
  it('mais de 200 colaboradores → Organizacional mesmo em risco baixo', () => {
    const r = evaluateDecision({
      input: { cnaePrincipalCodigo: '6201-5/00', numeroColaboradores: 250 },
      rule: mkRule(),
    });
    expect(r.recommendedMethod).toBe('ORGANIZACIONAL');
    expect(r.decisionScore).toBeGreaterThanOrEqual(60);
  });
});

describe('evaluateDecision — elevação por gatilho operacional (risco médio)', () => {
  it('médio + atendimento ao público → Organizacional', () => {
    const r = evaluateDecision({
      input: { cnaePrincipalCodigo: '4711-3/01', numeroColaboradores: 10, possuiAtendimentoPublico: true },
      rule: mkRule({ divisionCode: '47', officialName: 'Comércio varejista', preliminaryRiskLevel: 'MEDIO', riskInventoryRequired: true, evidenceRequired: true }),
    });
    expect(r.recommendedMethod).toBe('ORGANIZACIONAL');
  });
  it('médio sem gatilho e com porte pequeno → Essencial', () => {
    const r = evaluateDecision({
      input: { cnaePrincipalCodigo: '4711-3/01', numeroColaboradores: 3 },
      rule: mkRule({ divisionCode: '47', officialName: 'Comércio varejista', preliminaryRiskLevel: 'MEDIO' }),
    });
    expect(r.recommendedMethod).toBe('ESSENCIAL');
  });
});

describe('evaluateDecision — baixo/médio elevado por porte', () => {
  it('baixo_medio + mais de 20 colaboradores → Organizacional', () => {
    const r = evaluateDecision({
      input: { cnaePrincipalCodigo: '6822-6/00', numeroColaboradores: 25 },
      rule: mkRule({ divisionCode: '68', officialName: 'Atividades imobiliárias', preliminaryRiskLevel: 'BAIXO_MEDIO', evidenceRequired: true }),
    });
    expect(r.recommendedMethod).toBe('ORGANIZACIONAL');
  });
});

describe('evaluateDecision — validações', () => {
  it('sem CNAE → revisão manual e método nulo', () => {
    const r = evaluateDecision({ input: { razaoSocial: 'Sem CNAE' } as CnaeEvaluationInput, rule: mkRule() });
    expect(r.recommendedMethod).toBeNull();
    expect(r.manualReviewRequired).toBe(true);
  });
  it('divisão sem regra cadastrada → revisão manual', () => {
    const r = evaluateDecision({ input: { cnaePrincipalCodigo: '6201-5/00' }, rule: null });
    expect(r.recommendedMethod).toBeNull();
    expect(r.manualReviewRequired).toBe(true);
    expect(r.warnings.some((w) => /não encontrada na tabela/i.test(w))).toBe(true);
  });
});

describe('Enquadramento NR-1 — corte em 9 funcionários + dispensa', () => {
  it('0 funcionários → dispensa documental (método nulo, sem saídas)', () => {
    const r = evaluateDecision({
      input: { cnaePrincipalCodigo: '4711-3/01', numeroColaboradores: 0 },
      rule: mkRule({ divisionCode: '47', officialName: 'Comércio varejista', preliminaryRiskLevel: 'MEDIO' }),
    });
    expect(r.recommendedMethod).toBeNull();
    expect(r.technicalOutputs).toEqual([]);
    expect(r.warnings.some((w) => /dispensa/i.test(w))).toBe(true);
  });
  it('REGRA 1 — Baixo + até 9 → Essencial (Leitura Preliminar, sem PGR)', () => {
    const r = evaluateDecision({ input: { cnaePrincipalCodigo: '6201-5/00', numeroColaboradores: 5 }, rule: mkRule() });
    expect(r.recommendedMethod).toBe('ESSENCIAL');
    expect(r.technicalOutputs).toContain('Leitura Preliminar');
    expect(r.technicalOutputs).not.toContain('PGR');
  });
  it('REGRA 2 — Baixo + mais de 9 → Organizacional (com Dashboard + Plano, sem PGR)', () => {
    const r = evaluateDecision({ input: { cnaePrincipalCodigo: '6201-5/00', numeroColaboradores: 10 }, rule: mkRule() });
    expect(r.recommendedMethod).toBe('ORGANIZACIONAL');
    expect(r.technicalOutputs).toEqual(expect.arrayContaining(['Dashboard Executivo', 'Plano de Ação']));
    expect(r.technicalOutputs).not.toContain('PGR');
  });
  it('REGRA 3 — Médio/Alto ou Alto + até 9 → Essencial com PGR + Inventário', () => {
    const r = evaluateDecision({ input: { cnaePrincipalCodigo: '8610-1/01', numeroColaboradores: 5 }, rule: ALTO });
    expect(r.recommendedMethod).toBe('ESSENCIAL');
    expect(r.technicalOutputs).toEqual(
      expect.arrayContaining(['AEP', 'PGR', 'Inventário de Riscos', 'Plano de Ação', 'Evidências']),
    );
    expect(r.technicalOutputs).not.toContain('Dashboard Executivo');
  });
  it('REGRA 4 — Médio/Alto ou Alto + mais de 9 → Organizacional completo', () => {
    const r = evaluateDecision({ input: { cnaePrincipalCodigo: '8610-1/01', numeroColaboradores: 50 }, rule: ALTO });
    expect(r.recommendedMethod).toBe('ORGANIZACIONAL');
    expect(r.technicalOutputs).toEqual(
      expect.arrayContaining(['AEP', 'PGR', 'Inventário de Riscos', 'Plano de Ação', 'Dashboard Executivo', 'Relatório Executivo']),
    );
  });
});
