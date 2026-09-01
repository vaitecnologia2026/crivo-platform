import { describe, expect, it } from 'vitest';
import { dossierBlockers, dossierScopeSection, factorRisk, type FactorItem } from './documents.service';

// Matriz de risco do dossiê (doc 09 §6) + bloqueios de emissão (§9).
// Regra estrutural: o risco técnico é DERIVADO de Severidade x Probabilidade,
// nunca digitado; e o dossiê final não sai com ação pendente ou fator Alto
// incompleto.

const base: FactorItem = {
  point: 'Sobrecarga no Turno B',
  origin: 'Questionário',
  action: 'Redistribuir escala',
  responsible: 'Ana',
  dueDate: new Date('2026-08-30T00:00:00Z'),
  status: 'APROVADA',
  expectedEvidence: 'Nova escala publicada',
  exposedGroup: 'Turno B',
  severity: 'Alta',
  probability: 'Alta',
  riskLevel: null,
  // A3: fator Alto exige evidência REAL e aprovada no Motor de Evidências.
  evidences: [{ status: 'APROVADA' }],
};

describe('factorRisk — risco derivado da matriz', () => {
  it('deriva Alto de Severidade Alta x Probabilidade Alta', () => {
    const r = factorRisk(base);
    expect(r).toEqual({ label: 'Alto', derived: true, isHigh: true });
  });

  it('deriva Moderado de Moderada x Moderada', () => {
    const r = factorRisk({ ...base, severity: 'Moderada', probability: 'Moderada' });
    expect(r.label).toBe('Moderado');
    expect(r.isHigh).toBe(false);
  });

  it('deriva Baixo de Baixa x Baixa', () => {
    expect(factorRisk({ ...base, severity: 'Baixa', probability: 'Baixa' }).label).toBe('Baixo');
  });

  it('cai no valor legado quando falta um dos eixos (derived=false)', () => {
    const r = factorRisk({ ...base, severity: null, probability: null, riskLevel: 'ALTO' });
    expect(r.derived).toBe(false);
    expect(r.isHigh).toBe(true); // legado ALTO ainda bloqueia
  });

  it('não inventa risco quando não há eixo nem legado', () => {
    const r = factorRisk({ ...base, severity: null, probability: null, riskLevel: null });
    expect(r.label).toBe('—');
    expect(r.derived).toBe(false);
  });
});

describe('dossierBlockers — bloqueios de emissão (§9)', () => {
  it('libera quando tudo está aprovado e completo', () => {
    expect(dossierBlockers([base])).toEqual([]);
  });

  // Ponto cego CONHECIDO desta função, documentado aqui para não ser "corrigido"
  // por engano: os três filtros rodam SOBRE a lista de ações, então lista vazia
  // não dispara nenhum e o resultado é []. Um plano validado e sem nenhuma ação
  // passaria batido pelo §9 — por isso o bloqueio de plano vazio vive em emit()
  // (documents.service.ts), e não aqui. Se este teste quebrar, o gate mudou de
  // lugar e emit() precisa ser revisto junto.
  it('NÃO barra plano vazio — por desenho; quem barra é o gate de emit()', () => {
    expect(dossierBlockers([])).toEqual([]);
  });

  it('bloqueia com ação SUGERIDA', () => {
    const b = dossierBlockers([{ ...base, status: 'SUGERIDA' }]);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatch(/sugerida|revisão/i);
  });

  it('bloqueia com ação EM_REVISAO', () => {
    expect(dossierBlockers([{ ...base, status: 'EM_REVISAO' }])).toHaveLength(1);
  });

  it('bloqueia fator Alto sem responsável', () => {
    const b = dossierBlockers([{ ...base, responsible: null }]);
    expect(b[0]).toMatch(/Alto sem responsável/i);
  });

  it('bloqueia fator Alto sem prazo', () => {
    expect(dossierBlockers([{ ...base, dueDate: null }])).toHaveLength(1);
  });

  it('bloqueia fator Alto sem evidência esperada', () => {
    expect(dossierBlockers([{ ...base, expectedEvidence: null }])).toHaveLength(1);
  });

  it('NÃO bloqueia fator de risco baixo incompleto (a exigência é só para Alto)', () => {
    const baixo = { ...base, severity: 'Baixa', probability: 'Baixa', responsible: null, dueDate: null, expectedEvidence: null, evidences: [] };
    expect(dossierBlockers([baixo as FactorItem])).toEqual([]);
  });

  // A3 (residual do plano do Motor): o TEXTO "evidência esperada" não basta —
  // dossiê final com fator Alto exige evidência REAL aprovada pela CRIVO.
  it('bloqueia fator Alto sem evidência APROVADA no Motor de Evidências', () => {
    const b = dossierBlockers([{ ...base, evidences: [] }]);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatch(/evidência APROVADA/i);
  });

  it('evidência pendente/rejeitada NÃO conta como aprovada', () => {
    expect(dossierBlockers([{ ...base, evidences: [{ status: 'PENDENTE' }, { status: 'REJEITADA' }] }])).toHaveLength(1);
  });

  it('fator Alto com evidência aprovada libera normalmente', () => {
    expect(dossierBlockers([{ ...base, evidences: [{ status: 'REJEITADA' }, { status: 'APROVADA' }] }])).toEqual([]);
  });

  it('acumula os dois bloqueios quando ambos ocorrem', () => {
    const b = dossierBlockers([{ ...base, status: 'SUGERIDA' }, { ...base, responsible: null }]);
    expect(b).toHaveLength(2);
  });
});

// Mapeamento das 6 regras do Pacote Final §5 (BLOQUEIOS) ao código.
// 1 e 2 são função pura (testadas acima e aqui pelos nomes do pacote); 3–6 são
// gates de integração (available/generate/emit) provados no E2E de produção.
describe('Pacote §5 — Bloqueios de emissão do Dossiê', () => {
  const alto: FactorItem = {
    point: 'Sobrecarga', origin: 'Metas', action: 'Redistribuir', responsible: 'RH',
    dueDate: new Date('2026-08-01'), status: 'APROVADA', expectedEvidence: 'Ata',
    exposedGroup: 'Comercial', severity: 'Alta', probability: 'Alta', riskLevel: null,
    evidences: [{ status: 'APROVADA' }],
  };

  it('§5.1 — não emitir com ação Sugerida ou Em revisão', () => {
    expect(dossierBlockers([{ ...alto, status: 'SUGERIDA' }])).toHaveLength(1);
    expect(dossierBlockers([{ ...alto, status: 'EM_REVISAO' }])).toHaveLength(1);
  });

  it('§5.2 — não emitir com fator Alto sem responsável, prazo e evidência', () => {
    expect(dossierBlockers([{ ...alto, responsible: null }])).toHaveLength(1);
    expect(dossierBlockers([{ ...alto, dueDate: null }])).toHaveLength(1);
    expect(dossierBlockers([{ ...alto, expectedEvidence: null }])).toHaveLength(1);
  });

  it('§5 — plano completo e aprovado não gera bloqueio', () => {
    expect(dossierBlockers([alto])).toEqual([]);
  });
});

describe('dossierScopeSection — o título declara só o que o contrato sustenta', () => {
  it('AEP: declaração de subsídio à AEP', () => {
    const s = dossierScopeSection('AEP');
    expect(s.heading).toBe('Declaração de subsídio à AEP');
    expect(s.body).toContain('subsidiar a Avaliação Ergonômica');
    expect(s.body).not.toContain('GRO/PGR.');
  });

  it('AEP_PGR: declara também a integração ao GRO/PGR', () => {
    const s = dossierScopeSection('AEP_PGR');
    expect(s.heading).toBe('Declaração de escopo — Integração à AEP + GRO/PGR');
    expect(s.body).toContain('integração ao GRO/PGR');
  });

  it('sem saída no contrato: o dossiê SAI, mas sem se vender como subsídio contratado à AEP', () => {
    // Decisão do cliente (01/09): o diagnóstico realizado licencia o dossiê —
    // a saída técnica em branco (caso do contrato criado na liberação do CRM)
    // não pode mais barrar a geração. O que muda é a declaração.
    const s = dossierScopeSection('SEM_INTEGRACAO');
    expect(s.heading).toBe('Declaração de escopo — documento técnico e gerencial');
    expect(s.heading).not.toContain('AEP');
    expect(s.body).toContain('não prevê integração formal');
    // A ressalva de sempre continua: não substitui AEP/PGR nem validação humana.
    expect(s.body).toContain('Não substitui a AEP, o PGR');
  });

  it('valor desconhecido cai no texto neutro (mesmo caminho do sem integração)', () => {
    expect(dossierScopeSection('QUALQUER_COISA').heading).toBe(
      'Declaração de escopo — documento técnico e gerencial',
    );
  });
});
