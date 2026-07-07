import { describe, it, expect } from 'vitest';
import { contractAccessState, type ContractAccessInput } from './contract-access';

const NOW = new Date('2026-07-05T12:00:00Z');
const base: ContractAccessInput = { status: 'ATIVO', startDate: null, endDate: null, accessDays: null };

describe('contractAccessState (CT1 — prazo do contrato)', () => {
  it('libera quando não há contrato', () => {
    expect(contractAccessState(null, NOW)).toEqual({ allowed: true });
    expect(contractAccessState(undefined, NOW)).toEqual({ allowed: true });
  });

  it('libera contrato ATIVO sem prazo definido', () => {
    expect(contractAccessState(base, NOW)).toEqual({ allowed: true });
  });

  it('NÃO bloqueia contrato não-ATIVO mesmo com endDate vencida', () => {
    const past = new Date('2026-01-01T00:00:00Z');
    for (const status of ['RASCUNHO', 'SUSPENSO', 'ENCERRADO'] as const) {
      expect(contractAccessState({ ...base, status, endDate: past }, NOW)).toEqual({ allowed: true });
    }
  });

  it('bloqueia ATIVO com endDate no passado', () => {
    const r = contractAccessState({ ...base, endDate: new Date('2026-07-01T00:00:00Z') }, NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('expired_end_date');
  });

  it('libera ATIVO com endDate no futuro', () => {
    expect(contractAccessState({ ...base, endDate: new Date('2026-12-31T00:00:00Z') }, NOW)).toEqual({ allowed: true });
  });

  it('bloqueia por accessDays vencido (startDate + N dias < agora)', () => {
    const r = contractAccessState({ ...base, startDate: new Date('2026-06-01T00:00:00Z'), accessDays: 10 }, NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('expired_access_days');
  });

  it('libera por accessDays ainda dentro da janela', () => {
    expect(contractAccessState({ ...base, startDate: new Date('2026-07-01T00:00:00Z'), accessDays: 30 }, NOW)).toEqual({ allowed: true });
  });

  it('ignora accessDays sem startDate (não dá pra computar a janela)', () => {
    expect(contractAccessState({ ...base, startDate: null, accessDays: 5 }, NOW)).toEqual({ allowed: true });
  });
});
