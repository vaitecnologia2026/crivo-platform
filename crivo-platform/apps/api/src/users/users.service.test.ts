import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

/**
 * Redefinir a senha de outra pessoa é a operação mais perigosa desta tela: quem
 * consegue fazê-la assume a conta alvo. Os testes abaixo protegem as três
 * barreiras que impedem isso — escalonamento por cargo, auto-reset sem prova de
 * identidade, e a revogação de sessão que faz a senha antiga morrer na hora.
 */

type Row = { id: string; role: string; email: string; name: string; active: boolean };

function build(row: Row | null) {
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...(row as Row),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    screenAccess: null,
    ...data,
  }));
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ user: { findFirst: vi.fn(async () => row), update } }),
    ),
  };
  const metering = { assertUserQuota: vi.fn(), userLimit: vi.fn() };
  const service = new UsersService(prisma as never, metering as never);
  return { service, update };
}

const alvo: Row = { id: 'u-alvo', role: 'COLABORADOR', email: 'alvo@empresa.com', name: 'Alvo', active: true };

describe('UsersService.resetPassword', () => {
  it('devolve a senha temporária e grava o hash dela (nunca o texto puro)', async () => {
    const { service, update } = build(alvo);
    const r = await service.resetPassword('t1', 'u-alvo', 'ADMIN', 'u-admin');

    expect(r.tempPassword).toHaveLength(16);
    const hash = update.mock.calls[0][0].data.passwordHash as string;
    expect(hash).not.toBe(r.tempPassword);
    expect(bcrypt.compareSync(r.tempPassword, hash)).toBe(true);
  });

  it('derruba as sessões abertas do usuário (a senha antiga morre na hora)', async () => {
    const { service, update } = build(alvo);
    await service.resetPassword('t1', 'u-alvo', 'RH', 'u-rh');
    expect(update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
  });

  it('não expõe o hash no retorno', async () => {
    const { service } = build(alvo);
    const r = await service.resetPassword('t1', 'u-alvo', 'ADMIN', 'u-admin');
    expect(r.user).not.toHaveProperty('passwordHash');
  });

  it('recusa quem tenta redefinir a própria senha (sem prova de identidade)', async () => {
    const { service, update } = build({ ...alvo, id: 'u-admin' });
    await expect(service.resetPassword('t1', 'u-admin', 'ADMIN', 'u-admin')).rejects.toThrow(
      /Trocar senha/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('impede um RH de redefinir a senha de um CEO (escalonamento de privilégio)', async () => {
    const { service, update } = build({ ...alvo, id: 'u-ceo', role: 'CEO' });
    await expect(service.resetPassword('t1', 'u-ceo', 'RH', 'u-rh')).rejects.toThrow(
      /Administrador ou CEO/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('permite ADMIN redefinir a senha de outro ADMIN', async () => {
    const { service, update } = build({ ...alvo, id: 'u-outro', role: 'ADMIN' });
    await service.resetPassword('t1', 'u-outro', 'ADMIN', 'u-admin');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('404 quando o usuário não é do tenant (findFirst já roda sob RLS)', async () => {
    const { service, update } = build(null);
    await expect(service.resetPassword('t1', 'u-de-outra', 'ADMIN', 'u-admin')).rejects.toThrow(
      /não encontrado/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('gera senha diferente a cada chamada', async () => {
    const a = await build(alvo).service.resetPassword('t1', 'u-alvo', 'ADMIN', 'u-admin');
    const b = await build(alvo).service.resetPassword('t1', 'u-alvo', 'ADMIN', 'u-admin');
    expect(a.tempPassword).not.toBe(b.tempPassword);
  });
});
