import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';

// Justificativa de conclusão (modelo final 25/09): quem valida é a EMPRESA, no
// Plano de Evolução do portal — não a fila de governança da CRIVO. Validada,
// ela permite concluir a ação; a validação fica na trilha da ação.

function build(ev: Record<string, unknown> | null) {
  const historico: Record<string, unknown>[] = [];
  const tx = {
    evidence: {
      findUnique: vi.fn(async () => ev),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...ev, ...data })),
    },
    actionItemHistory: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        historico.push(data);
        return data;
      }),
    },
  };
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    admin: {},
  };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const svc = new ActionPlansService(prisma as any, {} as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { svc, tx, historico };
}

const justificativa = {
  id: 'e1',
  itemId: 'i1',
  kind: 'justificativa',
  title: 'Justificativa de conclusão',
  url: null,
  note: 'Medida absorvida pelo novo fluxo de escalas.',
  status: 'ENVIADA',
  fileName: null,
  fileMime: null,
  fileSize: null,
  createdAt: new Date('2026-09-25T12:00:00Z'),
  reviewedAt: null,
  reviewedBy: null,
};

describe('justificativa validada pela empresa no portal', () => {
  it('valida: status APROVADA, quem e quando, e registra na trilha da ação', async () => {
    const { svc, tx, historico } = build(justificativa);
    const out = await svc.validarJustificativa('t1', 'e1', 'Ana (RH)');
    expect(tx.evidence.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: expect.objectContaining({ status: 'APROVADA', reviewedBy: 'Ana (RH)' }),
    });
    expect(out.status).toBe('APROVADA');
    expect(out.reviewedBy).toBe('Ana (RH)');
    expect(historico).toEqual([
      expect.objectContaining({ actionItemId: 'i1', change: 'Justificativa validada: Justificativa de conclusão', changedBy: 'Ana (RH)' }),
    ]);
  });

  it('não valida evidência que não é justificativa (essa segue a governança da CRIVO)', async () => {
    const { svc, tx } = build({ ...justificativa, kind: 'ata' });
    await expect(svc.validarJustificativa('t1', 'e1', 'RH')).rejects.toThrow(BadRequestException);
    expect(tx.evidence.update).not.toHaveBeenCalled();
  });

  it('justificativa já validada: devolve como está, sem nova trilha', async () => {
    const { svc, tx, historico } = build({ ...justificativa, status: 'APROVADA', reviewedBy: 'Ana (RH)' });
    const out = await svc.validarJustificativa('t1', 'e1', 'Outro');
    expect(out.reviewedBy).toBe('Ana (RH)');
    expect(tx.evidence.update).not.toHaveBeenCalled();
    expect(historico).toHaveLength(0);
  });

  it('não valida justificativa rejeitada ou substituída', async () => {
    for (const status of ['REJEITADA', 'SUBSTITUIDA']) {
      const { svc } = build({ ...justificativa, status });
      await expect(svc.validarJustificativa('t1', 'e1', 'RH')).rejects.toThrow(BadRequestException);
    }
  });

  it('evidência inexistente (ou de outro tenant, invisível pela RLS): 404', async () => {
    const { svc } = build(null);
    await expect(svc.validarJustificativa('t1', 'e1', 'RH')).rejects.toThrow(/não encontrada/);
  });
});
