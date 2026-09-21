import { describe, expect, it } from 'vitest';
import { bloqueiosDoPlano, dossierScopeSection, factorRisk, type FactorItem, type PlanoParaGates } from './documents.service';

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

describe('bloqueiosDoPlano — gates mínimos da emissão oficial (matriz de aceite 21/09)', () => {
  // Desligados em 2026-09-08 (junto com o gate editorial da equipe CRIVO, que
  // NÃO volta) e religados a pedido da homologação: todos dependem só do
  // cliente, no Plano de Evolução. A pré-visualização não passa por aqui.
  const sobrecarga = { slug: 'fator-1', label: 'Sobrecarga de trabalho' };
  type Item = PlanoParaGates['items'][number];
  const ok: Item = {
    status: 'APROVADA',
    point: base.point,
    riskFactorSlug: 'fator-1',
    responsible: 'RH',
    dueDate: new Date('2026-10-21'),
    expectedEvidence: 'Ata',
  };
  const validado = (items: Item[]): PlanoParaGates => ({ validatedAt: new Date('2026-09-21'), items });

  it('1. sugestão pendente ou em revisão bloqueia', () => {
    expect(bloqueiosDoPlano(validado([ok, { ...ok, status: 'SUGERIDA' }]), [sobrecarga])[0]).toMatch(/1 sugestão\(ões\) aguardando decisão/);
    expect(bloqueiosDoPlano(validado([ok, { ...ok, status: 'EM_REVISAO' }]), [sobrecarga])).toHaveLength(1);
  });

  it('2. fator obrigatório sem ação aprovada bloqueia e nomeia o fator; descartada não conta', () => {
    const r = bloqueiosDoPlano(validado([{ ...ok, status: 'NAO_ADOTADA' }]), [sobrecarga]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatch(/sem ação aprovada: Sobrecarga de trabalho/);
  });

  it('2b. ação manual sem slug cobre o fator pelo nome', () => {
    expect(bloqueiosDoPlano(validado([{ ...ok, riskFactorSlug: null, point: 'sobrecarga de trabalho' }]), [sobrecarga])).toEqual([]);
  });

  it('3. aprovada sem prazo (ou responsável/evidência) bloqueia', () => {
    expect(bloqueiosDoPlano(validado([{ ...ok, dueDate: null }]), [sobrecarga])[0]).toMatch(/sem responsável, prazo ou evidência esperada/);
    expect(bloqueiosDoPlano(validado([{ ...ok, responsible: '  ' }]), [sobrecarga])).toHaveLength(1);
    expect(bloqueiosDoPlano(validado([{ ...ok, expectedEvidence: null }]), [sobrecarga])).toHaveLength(1);
  });

  it('7. plano não validado bloqueia', () => {
    expect(bloqueiosDoPlano({ validatedAt: null, items: [ok] }, [sobrecarga])).toEqual([
      'Plano de Evolução ainda não validado — valide no Plano de Evolução.',
    ]);
  });

  it('tudo em ordem libera; sem plano e sem fator obrigatório também', () => {
    expect(bloqueiosDoPlano(validado([ok]), [sobrecarga])).toEqual([]);
    expect(bloqueiosDoPlano(undefined, [])).toEqual([]);
  });

  it('sem matriz (suprimida) o gate 2 não avalia, os outros seguem', () => {
    expect(bloqueiosDoPlano({ validatedAt: null, items: [{ ...ok, status: 'SUGERIDA' }] }, [])).toHaveLength(2);
  });
});
