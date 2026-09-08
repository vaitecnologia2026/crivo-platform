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

describe('dossierBlockers — deixou de bloquear (decisão do cliente 2026-09-08)', () => {
  // Relatórios, dossiê e plano passaram a sair automaticamente, gerados pela IA.
  // A função continua existindo e sendo chamada, mas não devolve mais bloqueio.
  //
  // Isto CONTRARIA a Orientação Funcional §9 e o critério de aceite §12, que
  // exigiam plano aprovado e evidência aprovada para liberar o dossiê. Está
  // assim por decisão explícita do cliente, não por descuido: se a regra voltar
  // a valer, é aqui que ela renasce.
  //
  // O que sobreviveu da regra: as ações geradas nascem SUGERIDA, não aprovadas,
  // e a seção 8 do dossiê mostra o status real de cada uma — o documento não
  // afirma validação que não houve.
  it('não bloqueia com ação SUGERIDA', () => {
    expect(dossierBlockers([{ ...base, status: 'SUGERIDA' }])).toEqual([]);
  });

  it('não bloqueia com ação EM_REVISAO', () => {
    expect(dossierBlockers([{ ...base, status: 'EM_REVISAO' }])).toEqual([]);
  });

  it('não bloqueia fator Alto sem responsável, prazo ou evidência esperada', () => {
    expect(
      dossierBlockers([{ ...base, responsible: null, dueDate: null, expectedEvidence: null }]),
    ).toEqual([]);
  });

  it('não bloqueia fator Alto sem evidência aprovada', () => {
    expect(dossierBlockers([{ ...base, evidences: [] }])).toEqual([]);
  });

  it('plano vazio segue sem bloqueio', () => {
    expect(dossierBlockers([])).toEqual([]);
  });
});
