import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ActionPlansService } from './action-plans.service';
import { planoDoDocumento } from './documents.service';

// Homologação 17/09 — "PONTO NÃO NEGOCIÁVEL: o Dossiê deve carregar somente
// ações aprovadas. Hoje, as ações aprovadas não chegaram ao Dossiê."
// No banco: 12 ações SUGERIDA (nenhuma aprovada), plano VALIDADO. A empresa
// tomou "validar o plano" por aprovação. Duas travas fecham a brecha:
// (1) validar o plano recusa enquanto há sugestão pendente;
// (2) o documento lê o plano que tem ação aprovada, não o mais novo.

function build(pendentes: number) {
  const update = vi.fn(async () => ({}));
  const tx = {
    actionPlan: {
      findUnique: vi.fn(async () => ({
        id: 'p1', title: 'Plano', source: null, validatedAt: null, validatedBy: null,
        createdAt: new Date('2026-09-17T14:03:49Z'), items: [], sourceInstrument: null,
      })),
      update,
    },
    actionItem: { count: vi.fn(async () => pendentes) },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)), admin: {} };
  const svc = new ActionPlansService(prisma as any, {} as any);
  return { svc, update, tx };
}

describe('validatePlan — decisão antes da validação', () => {
  it('recusa validar com sugestões pendentes e diz quantas', async () => {
    const { svc, update } = build(12);
    await expect(svc.validatePlan('t1', 'p1', 'Rodrigo')).rejects.toThrow(BadRequestException);
    await expect(svc.validatePlan('t1', 'p1', 'Rodrigo')).rejects.toThrow(/12 sugest/);
    expect(update).not.toHaveBeenCalled();
  });

  it('conta só SUGERIDA/EM_REVISAO como pendente', async () => {
    const { svc, tx } = build(0);
    await svc.validatePlan('t1', 'p1', 'Rodrigo');
    expect(tx.actionItem.count).toHaveBeenCalledWith({
      where: { planId: 'p1', status: { in: ['SUGERIDA', 'EM_REVISAO'] } },
    });
  });

  it('valida quando todas as sugestões foram decididas', async () => {
    const { svc, update } = build(0);
    await svc.validatePlan('t1', 'p1', 'Rodrigo');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ validatedBy: 'Rodrigo' }) }),
    );
  });
});

describe('planoDoDocumento — qual plano o Dossiê lê', () => {
  const novo = { id: 'novo', validatedAt: null, items: [{ status: 'SUGERIDA' }] };
  const antigoComAprovada = { id: 'antigo', validatedAt: null, items: [{ status: 'APROVADA' }] };
  const validado = { id: 'val', validatedAt: new Date('2026-09-17T14:33:23Z'), items: [] };

  it('plano validado vence', () => {
    expect(planoDoDocumento([novo, antigoComAprovada, validado])?.id).toBe('val');
  });

  it('sem validado, lê o plano que tem ação aprovada (não o mais novo)', () => {
    expect(planoDoDocumento([novo, antigoComAprovada])?.id).toBe('antigo');
  });

  it('sem aprovada em lugar nenhum, cai no mais recente', () => {
    expect(planoDoDocumento([novo, { id: 'x', validatedAt: null, items: [] }])?.id).toBe('novo');
  });

  it('sem plano devolve undefined', () => {
    expect(planoDoDocumento([])).toBeUndefined();
  });
});
