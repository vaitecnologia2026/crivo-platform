import { describe, expect, it } from 'vitest';

import { cycleStatusLabel } from './icd-cycle-status';

const NOW = new Date('2026-09-17T12:00:00.000Z');

describe('cycleStatusLabel — chip da aba Aplicações e Ciclos', () => {
  it('ciclo aberto com início no futuro é "Programado"', () => {
    expect(cycleStatusLabel({ status: 'OPEN', startsAt: '2026-10-01T00:00:00.000Z' }, NOW)).toBe('Programado');
  });

  it('ciclo aberto com início no passado é "Em andamento"', () => {
    expect(cycleStatusLabel({ status: 'OPEN', startsAt: '2026-07-01T00:00:00.000Z' }, NOW)).toBe('Em andamento');
  });

  it('início exatamente em `now` já conta como "Em andamento" (limite inclusivo)', () => {
    expect(cycleStatusLabel({ status: 'OPEN', startsAt: NOW.toISOString() }, NOW)).toBe('Em andamento');
  });

  it('1 ms depois de `now` ainda é "Programado"', () => {
    const start = new Date(NOW.getTime() + 1).toISOString();
    expect(cycleStatusLabel({ status: 'OPEN', startsAt: start }, NOW)).toBe('Programado');
  });

  it('ciclo fechado é "Fechado" mesmo com início no futuro (status vence a data)', () => {
    expect(cycleStatusLabel({ status: 'CLOSED', startsAt: '2027-01-01T00:00:00.000Z' }, NOW)).toBe('Fechado');
  });

  it('ciclo aberto com data inválida cai em "Em andamento" (nunca some o botão de fechar)', () => {
    expect(cycleStatusLabel({ status: 'OPEN', startsAt: 'não-é-data' }, NOW)).toBe('Em andamento');
  });

  it('usa a data atual quando `now` não é informado', () => {
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const farPast = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(cycleStatusLabel({ status: 'OPEN', startsAt: farFuture })).toBe('Programado');
    expect(cycleStatusLabel({ status: 'OPEN', startsAt: farPast })).toBe('Em andamento');
  });
});
