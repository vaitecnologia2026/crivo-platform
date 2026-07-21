import { describe, expect, it } from 'vitest';
import { dossierBlockers, factorRisk, type FactorItem } from './documents.service';

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
    const baixo = { ...base, severity: 'Baixa', probability: 'Baixa', responsible: null, dueDate: null, expectedEvidence: null };
    expect(dossierBlockers([baixo as FactorItem])).toEqual([]);
  });

  it('acumula os dois bloqueios quando ambos ocorrem', () => {
    const b = dossierBlockers([{ ...base, status: 'SUGERIDA' }, { ...base, responsible: null }]);
    expect(b).toHaveLength(2);
  });
});
