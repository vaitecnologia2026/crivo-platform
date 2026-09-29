import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@crivo/db';
import { AdminUsersService } from './admin-users.service';

/**
 * Cadastro de usuários pelo Super Admin com a marcação de líder (Minha
 * Jornada — Spec V1 v1.2 §3). Mesma regra do app da empresa: papel LIDER é
 * sempre líder, isLeader informado para outro papel é gravado, trocar de
 * papel sem informar mantém o atual; trocar o PAPEL derruba as sessões (ele
 * vai congelado no JWT). A auditoria leva isLeader.
 */

const ORG = 'dded8882-85a0-4bc0-85e2-01b34d2ec548';

type Row = { id: string; tenantId: string; email: string; name: string; role: string; active: boolean; isLeader: boolean };

function build(existing: Row | null = null) {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'u-novo',
    active: true,
    screenAccess: null,
    isLeader: false,
    createdAt: new Date('2026-09-29T12:00:00Z'),
    ...data,
  }));
  // Como no Prisma, `undefined` no data = não mexe no campo.
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...(existing as Row),
    screenAccess: null,
    createdAt: new Date('2026-09-29T12:00:00Z'),
    ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  }));
  const prisma = {
    admin: {
      organization: { findUnique: vi.fn(async () => ({ id: ORG })) },
      tenant: { findUnique: vi.fn(async () => null) },
      // findEmailOwner (e-mail único na plataforma) e a checagem de pertença.
      user: { findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => ('email' in where ? null : existing)), create, update },
    },
  };
  const audit = { record: vi.fn(async () => undefined) };
  const metering = { assertUserQuotaAdmin: vi.fn(async () => undefined), userLimit: vi.fn(async () => null) };
  const svc = new AdminUsersService(prisma as never, audit as never, metering as never);
  return { svc, create, update, audit };
}

const actor = { id: 'sa-1', email: 'super@crivo.platform' };
const usuario = (over: Partial<Row> = {}): Row => ({
  id: 'u-1', tenantId: ORG, email: 'u@empresa.com', name: 'U', role: 'ADMIN', active: true, isLeader: false, ...over,
});

describe('AdminUsersService.create — marcação de líder', () => {
  it('papel LIDER força isLeader=true e a auditoria registra', async () => {
    const { svc, create, audit } = build();
    const r = await svc.create(ORG, { name: 'L', email: 'l@x.com', role: 'LIDER', isLeader: false }, actor);
    expect(create.mock.calls[0][0].data.isLeader).toBe(true);
    expect(r.user.isLeader).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.user.create', meta: expect.objectContaining({ role: 'LIDER', isLeader: true }) }),
    );
  });

  it('ADMIN marcado como líder é gravado; sem marcação, nasce sem Minha Jornada', async () => {
    const a = build();
    await a.svc.create(ORG, { name: 'A', email: 'a@x.com', role: 'ADMIN', isLeader: true }, actor);
    expect(a.create.mock.calls[0][0].data.isLeader).toBe(true);

    const b = build();
    await b.svc.create(ORG, { name: 'B', email: 'b@x.com', role: 'ADMIN' }, actor);
    expect(b.create.mock.calls[0][0].data.isLeader).toBe(false);
  });
});

describe('AdminUsersService.update — marcação de líder e revogação de sessão', () => {
  it('trocar o papel incrementa tokenVersion', async () => {
    const { svc, update } = build(usuario());
    await svc.update(ORG, 'u-1', { role: 'RH' }, actor);
    expect(update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
  });

  it('só marcar como líder não incrementa tokenVersion; auditoria leva isLeader antes → depois', async () => {
    const { svc, update, audit } = build(usuario());
    const r = await svc.update(ORG, 'u-1', { isLeader: true }, actor);
    expect(update.mock.calls[0][0].data.isLeader).toBe(true);
    expect(update.mock.calls[0][0].data).not.toHaveProperty('tokenVersion');
    expect(r.isLeader).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.user.update',
        meta: expect.objectContaining({ isLeader: { before: false, after: true } }),
      }),
    );
  });

  it('trocar para LIDER força isLeader=true; trocar de papel sem informar mantém o atual', async () => {
    const a = build(usuario());
    await a.svc.update(ORG, 'u-1', { role: 'LIDER' }, actor);
    expect(a.update.mock.calls[0][0].data).toMatchObject({ role: 'LIDER', isLeader: true, tokenVersion: { increment: 1 } });

    const b = build(usuario({ isLeader: true }));
    const r = await b.svc.update(ORG, 'u-1', { role: 'GESTOR' }, actor);
    expect(b.update.mock.calls[0][0].data).not.toHaveProperty('isLeader');
    expect(r.isLeader).toBe(true);
  });
});

describe('AdminUsersService — papel LIDER não usa a checklist de telas', () => {
  it('criar LIDER grava screenAccess NULL, mesmo com lista enviada', async () => {
    const { svc, create } = build();
    await svc.create(ORG, { name: 'L', email: 'l@x.com', role: 'LIDER', screenAccess: ['lider'] }, actor);
    expect(create.mock.calls[0][0].data.screenAccess).toBe(Prisma.DbNull);
  });

  it('trocar para LIDER limpa a checklist e ignora a enviada', async () => {
    const { svc, update } = build(usuario({ role: 'GESTOR' }));
    const r = await svc.update(ORG, 'u-1', { role: 'LIDER', screenAccess: ['dashboard'] }, actor);
    expect(update.mock.calls[0][0].data.screenAccess).toBe(Prisma.DbNull);
    expect(r.screenAccess).toBeNull();
  });

  it('editar quem já é LIDER também limpa; outro papel segue com a lista enviada', async () => {
    const a = build(usuario({ role: 'LIDER', isLeader: true }));
    await a.svc.update(ORG, 'u-1', { active: true }, actor);
    expect(a.update.mock.calls[0][0].data.screenAccess).toBe(Prisma.DbNull);

    const b = build(usuario({ role: 'RH' }));
    await b.svc.update(ORG, 'u-1', { screenAccess: ['dashboard'] }, actor);
    expect(b.update.mock.calls[0][0].data.screenAccess).toEqual(['dashboard']);
  });
});
