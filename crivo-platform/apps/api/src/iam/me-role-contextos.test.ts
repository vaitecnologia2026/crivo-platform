import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@crivo/types';
import { MeController } from './me.controller';

/**
 * GET /me/role define em que contexto o portal abre (Spec V1 v1.2 §3):
 * Somente Líder → só Minha Jornada; Somente Administrador → só Área da
 * Organização; Líder + Administrador → os dois, com seletor. A marcação de
 * líder vem do BANCO (não do token) na mesma consulta de mustChangePassword.
 */

type Row = { name: string; mustChangePassword: boolean; isLeader: boolean } | null;

function build(row: Row) {
  const findFirst = vi.fn(async (_args: unknown) => row);
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn({ user: { findFirst } })),
  };
  const controller = new MeController({} as never, {} as never, prisma as never, {} as never, {} as never);
  return { controller, findFirst };
}

const user = (role: string): SessionUser =>
  ({ id: 'u1', tenantId: 't1', email: 'x@empresa.com', name: 'Nome do Token', role }) as SessionUser;

describe('MeController.myRole — contextos por perfil', () => {
  it('Somente Líder: só Minha Jornada', async () => {
    const { controller } = build({ name: 'Líder', mustChangePassword: false, isLeader: true });
    const r = await controller.myRole(user('LIDER'));
    expect(r).toMatchObject({ role: 'LIDER', isLeader: true, contexts: ['JORNADA'] });
  });

  it('LIDER legado sem a marcação gravada continua só com Minha Jornada', async () => {
    const { controller } = build({ name: 'Líder', mustChangePassword: false, isLeader: false });
    expect((await controller.myRole(user('LIDER'))).contexts).toEqual(['JORNADA']);
  });

  it('Somente Administrador: só Área da Organização', async () => {
    const { controller } = build({ name: 'Admin', mustChangePassword: false, isLeader: false });
    const r = await controller.myRole(user('ADMIN'));
    expect(r).toMatchObject({ role: 'ADMIN', isLeader: false, contexts: ['ORGANIZACAO'] });
  });

  it('Líder + Administrador: os dois contextos, na ordem do seletor', async () => {
    const { controller } = build({ name: 'Admin Líder', mustChangePassword: false, isLeader: true });
    const r = await controller.myRole(user('ADMIN'));
    expect(r.contexts).toEqual(['JORNADA', 'ORGANIZACAO']);
    expect(r.isLeader).toBe(true);
  });

  it('nome, senha provisória e marcação vêm do banco numa única consulta; o papel é o do token', async () => {
    const { controller, findFirst } = build({ name: 'Nome do Banco', mustChangePassword: true, isLeader: false });
    const r = await controller.myRole(user('RH'));
    expect(r).toEqual({
      role: 'RH',
      name: 'Nome do Banco',
      mustChangePassword: true,
      isLeader: false,
      contexts: ['ORGANIZACAO'],
    });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { name: true, mustChangePassword: true, isLeader: true },
    });
  });

  it('sem linha no banco: não quebra (nome do token, sem Jornada para papel corporativo)', async () => {
    const { controller } = build(null);
    const r = await controller.myRole(user('ADMIN'));
    expect(r).toMatchObject({ name: 'Nome do Token', mustChangePassword: false, isLeader: false, contexts: ['ORGANIZACAO'] });
  });
});
