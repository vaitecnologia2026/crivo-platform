import { describe, expect, it, vi } from 'vitest';
import { medidasPorFator } from './documents.service';
import { ActionPlansService } from './action-plans.service';

// Matriz consolidada da homologação (17/09):
//  - "Medida existente: informação contraditória → uma fonte de verdade por fator"
//  - "Saída técnica precisa acompanhar contrato" (coberto em dossie-saida-tecnica abaixo)

describe('medidasPorFator — uma linha por fator', () => {
  it('a medida descrita vence "Nenhuma medida existente" no mesmo fator', () => {
    expect(
      medidasPorFator([
        { point: 'Sobrecarga de trabalho', existingMeasure: 'Nenhuma medida existente' },
        { point: 'Sobrecarga de trabalho', existingMeasure: 'Já existe' },
        { point: 'Sobrecarga de trabalho', existingMeasure: null },
        { point: 'Baixa autonomia', existingMeasure: 'Nenhuma medida existente' },
        { point: 'Falta de suporte', existingMeasure: '' },
      ]),
    ).toEqual([
      ['Sobrecarga de trabalho', 'Já existe'],
      ['Baixa autonomia', 'Nenhuma medida existente'],
    ]);
  });

  it('duas medidas descritas do mesmo fator saem juntas, sem repetir', () => {
    expect(
      medidasPorFator([
        { point: 'F', existingMeasure: 'Rodízio' },
        { point: 'F', existingMeasure: 'Rodízio' },
        { point: 'F', existingMeasure: 'Pausas' },
      ]),
    ).toEqual([['F', 'Rodízio; Pausas']]);
  });
});

describe('updateItem — medida existente replica nas ações do mesmo fator', () => {
  function build(existing: Record<string, unknown>) {
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const tx = {
      actionItem: {
        findUnique: vi.fn(async () => existing),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...existing, ...data, evidences: [], sourceInstrument: null })),
        updateMany,
      },
      actionItemHistory: { create: vi.fn(async () => ({})) },
    };
    const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)), admin: {} };
    return { svc: new ActionPlansService(prisma as never, {} as never), updateMany };
  }
  const base = {
    id: 'i1', tenantId: 't', planId: 'p1', point: 'Sobrecarga', origin: null, action: 'x', responsible: null, dueDate: null,
    status: 'SUGERIDA', expectedEvidence: null, reviewDate: null, exposedGroup: null, severity: null, probability: null,
    riskLevel: null, areaProcess: null, existingMeasure: null, indicator: null, objective: null, sourceInstrumentSlug: null,
    riskFactorSlug: 'fator-1', riskProbability: null, riskSeverity: null, suggestionKey: null, cycleId: null,
    createdAt: new Date(), updatedAt: new Date(),
  };

  it('pelo slug do fator quando existe', async () => {
    const { svc, updateMany } = build(base);
    await svc.updateItem('t', 'i1', { existingMeasure: 'Rodízio' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { planId: 'p1', id: { not: 'i1' }, riskFactorSlug: 'fator-1' },
      data: { existingMeasure: 'Rodízio' },
    });
  });

  it('pelo nome do fator quando a ação não tem slug', async () => {
    const { svc, updateMany } = build({ ...base, riskFactorSlug: null });
    await svc.updateItem('t', 'i1', { existingMeasure: 'Nenhuma medida existente' });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { planId: 'p1', id: { not: 'i1' }, point: 'Sobrecarga', riskFactorSlug: null } }));
  });

  it('não toca as irmãs quando a medida não veio no pedido', async () => {
    const { svc, updateMany } = build(base);
    await svc.updateItem('t', 'i1', { responsible: 'RH' });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
