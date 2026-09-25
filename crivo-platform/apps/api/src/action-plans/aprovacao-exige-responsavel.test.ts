import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';

// Commit 83fd176 (Ajustes Finais de Homologação): "Responsável da ação —
// definir onde é cadastrado/selecionado e exigir antes da aprovação final".
// Modelo final de 25/09: a evidência esperada deixou de ser gate para aprovar;
// concluir exige evidência anexada ou justificativa validada.

function build(existing: Record<string, unknown>, evidencias: { kind: string; status: string }[] = []) {
  const updates: Record<string, unknown>[] = [];
  const tx = {
    evidence: { findMany: vi.fn(async () => evidencias) },
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

describe('aprovar uma ação exige responsável (83fd176; evidência esperada opcional desde 25/09)', () => {
  it('recusa aprovar sem responsável', async () => {
    const { svc, updates } = build(sugerida);
    await expect(svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH')).rejects.toThrow(BadRequestException);
    await expect(svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH')).rejects.toThrow(/Responsável/);
    expect(updates).toHaveLength(0);
  });

  it('aprova com responsável e SEM evidência esperada (não é mais gate)', async () => {
    const { svc, updates } = build(sugerida);
    await svc.updateItem('t1', 'i1', { status: 'APROVADA', responsible: 'Gerente de Operações' }, 'RH');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'APROVADA', responsible: 'Gerente de Operações' });
  });

  it('aprova quando o responsável já estava gravado na ação', async () => {
    const { svc, updates } = build({ ...sugerida, responsible: 'RH + Gestores' });
    await svc.updateItem('t1', 'i1', { status: 'APROVADA' }, 'RH');
    expect(updates).toHaveLength(1);
  });

  it('outros status (ex.: descartar) não exigem os campos', async () => {
    const { svc, updates } = build(sugerida);
    await svc.updateItem('t1', 'i1', { status: 'NAO_ADOTADA' }, 'RH');
    expect(updates).toHaveLength(1);
  });
});

describe('concluir exige evidência anexada ou justificativa validada (modelo final 25/09)', () => {
  const emAndamento = { ...sugerida, status: 'EM_ANDAMENTO', responsible: 'RH' };

  it('recusa concluir sem nenhuma evidência', async () => {
    const { svc, updates } = build(emAndamento);
    await expect(svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH')).rejects.toThrow(
      /anexe uma evidência ou registre uma justificativa/,
    );
    expect(updates).toHaveLength(0);
  });

  it('recusa concluir só com evidência rejeitada ou substituída', async () => {
    const { svc } = build(emAndamento, [
      { kind: 'ata', status: 'REJEITADA' },
      { kind: 'documento', status: 'SUBSTITUIDA' },
    ]);
    await expect(svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH')).rejects.toThrow(BadRequestException);
  });

  it('conclui com evidência anexada, mesmo aguardando validação', async () => {
    const { svc, updates } = build(emAndamento, [{ kind: 'ata', status: 'ENVIADA' }]);
    await svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH');
    expect(updates[0]).toMatchObject({ status: 'CONCLUIDA' });
  });

  it('justificativa só vale depois de validada', async () => {
    const pendente = build(emAndamento, [{ kind: 'justificativa', status: 'ENVIADA' }]);
    await expect(pendente.svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH')).rejects.toThrow(BadRequestException);
    const validada = build(emAndamento, [{ kind: 'justificativa', status: 'APROVADA' }]);
    await validada.svc.updateItem('t1', 'i1', { status: 'CONCLUIDA' }, 'RH');
    expect(validada.updates[0]).toMatchObject({ status: 'CONCLUIDA' });
  });

  it('ação já concluída continua editável (a regra é da transição)', async () => {
    const { svc, updates } = build({ ...emAndamento, status: 'CONCLUIDA' });
    await svc.updateItem('t1', 'i1', { status: 'REAVALIADA', indicator: 'Horas extras' }, 'RH');
    expect(updates).toHaveLength(1);
  });
});
