import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';

// Commit 83fd176 (Ajustes Finais de Homologação): "Responsável da ação —
// definir onde é cadastrado/selecionado e exigir antes da aprovação final".
// A regra vive em updateItem: aprovar sem responsável ou sem evidência esperada
// é recusado; com os dois, a aprovação passa.

function build(existing: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const tx = {
    actionItem: {
      findUnique: vi.fn(async () => existing),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { ...existing, ...data, evidences: [], sourceInstrument: null };
      }),
    },
    actionItemHistory: { create: vi.fn(async () => ({})) },
  };
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    admin: {},
  };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const svc = new ActionPlansService(prisma as any, {} as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { svc, updates };
}

const sugerida = {
  id: 'i1',
  tenantId: 't1',
  planId: 'p1',
  point: 'Sobrecarga de trabalho',
  origin: 'questionário',
  action: 'Revisar carga',
  responsible: null,
  dueDate: null,
  status: 'SUGERIDA',
  expectedEvidence: null,
  reviewDate: null,
  exposedGroup: null,
  severity: null,
  probability: null,
  riskLevel: null,
  areaProcess: null,
  existingMeasure: null,
  indicator: null,
  objective: null,
  sourceInstrumentSlug: null,
  riskFactorSlug: null,
  riskProbability: null,
  riskSeverity: null,
  suggestionKey: null,
  cycleId: null,
  createdAt: new Date('2026-09-16T12:00:00Z'),
  updatedAt: new Date('2026-09-16T12:00:00Z'),
};

describe('aprovar uma ação exige responsável e evidência esperada (83fd176)', () => {
  it('recusa aprovar sem responsável', async () => {
    const { svc, updates } = build(sugerida);
    await expect(svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH')).rejects.toThrow(BadRequestException);
    await expect(svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH')).rejects.toThrow(/Responsável/);
    expect(updates).toHaveLength(0);
  });

  it('recusa aprovar com responsável mas sem evidência esperada', async () => {
    const { svc, updates } = build(sugerida);
    await expect(
      svc.updateItem('t1', 'i1', { status: 'APROVADA', responsible: 'Gerente de Operações' }, 'RH'),
    ).rejects.toThrow(/Evidência esperada/);
    expect(updates).toHaveLength(0);
  });

  it('aprova quando os dois vêm no mesmo pedido', async () => {
    const { svc, updates } = build(sugerida);
    await svc.updateItem(
      't1',
      'i1',
      { status: 'APROVADA', responsible: 'Gerente de Operações', expectedEvidence: 'Relatório de carga' },
      'RH',
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'APROVADA', responsible: 'Gerente de Operações' });
  });

  it('aprova quando os dois já estavam gravados na ação', async () => {
    const { svc, updates } = build({ ...sugerida, responsible: 'RH + Gestores', expectedEvidence: 'Ata' });
    await svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH');
    expect(updates).toHaveLength(1);
  });

  it('outros status (ex.: descartar) não exigem os campos', async () => {
    const { svc, updates } = build(sugerida);
    await svc.updateItem('t1', 'i1', { status: 'NAO_ADOTADA' }, 'RH');
    expect(updates).toHaveLength(1);
  });
});
