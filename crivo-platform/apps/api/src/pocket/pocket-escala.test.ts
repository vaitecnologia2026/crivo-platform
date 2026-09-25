import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { PocketService } from './pocket.service';

// Pocket v2 (25/09/2026): a resposta é na ESCALA 1–5 e o texto virou
// comentário opcional. O upsert só muda o que veio no pedido — salvar a
// resposta não apaga o comentário, e vice-versa; texto vazio limpa o comentário.

function build() {
  const upserts: { create: Record<string, unknown>; update: Record<string, unknown> }[] = [];
  const tx = {
    pocketSession: {
      findUnique: vi.fn(async () => ({ id: 's1', leaderId: 'u1', status: 'EM_ANDAMENTO' })),
    },
    pocketReflection: {
      upsert: vi.fn(async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        upserts.push(args);
        return {
          id: 'r1',
          ...args.create,
          createdAt: new Date('2026-09-25T12:00:00Z'),
          updatedAt: new Date('2026-09-25T12:00:00Z'),
        };
      }),
    },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)), admin: {} };
  return { svc: new PocketService(prisma as never, {} as never, {} as never), upserts };
}

describe('Pocket v2 — resposta na escala e comentário opcional', () => {
  it('grava o valor da escala na criação e devolve no formato do portal', async () => {
    const { svc, upserts } = build();
    const r = await svc.upsertReflection('t1', 'u1', 's1', { questionCode: 'C1', value: 4 });
    expect(upserts[0].create).toMatchObject({ questionCode: 'C1', value: 4, text: null });
    expect(r.value).toBe(4);
  });

  it('atualização só da resposta não apaga o comentário (e vice-versa)', async () => {
    const { svc, upserts } = build();
    await svc.upsertReflection('t1', 'u1', 's1', { questionCode: 'C1', value: 2 });
    expect(upserts[0].update).toEqual({ value: 2 });

    await svc.upsertReflection('t1', 'u1', 's1', { questionCode: 'C1', text: '  A pressão do prazo pesa.  ' });
    expect(upserts[1].update).toEqual({ text: 'A pressão do prazo pesa.' });
  });

  it('comentário vazio limpa o comentário salvo', async () => {
    const { svc, upserts } = build();
    await svc.upsertReflection('t1', 'u1', 's1', { questionCode: 'C1', value: 3, text: '' });
    expect(upserts[0].update).toEqual({ value: 3, text: null });
  });
});
