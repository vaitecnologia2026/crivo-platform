import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@crivo/db';
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

/**
 * Minha Jornada (Spec V1 v1.2 §3): a marcação `isLeader` no cadastro. O papel
 * LIDER é sempre líder; para os outros papéis vale o que veio (e, sem valor,
 * o atual). Trocar o PAPEL derruba as sessões — ele vai congelado no JWT —,
 * mas só marcar/desmarcar o líder não (o AuthGuard lê isLeader do banco).
 */
type FullRow = Row & { isLeader: boolean; screenAccess: string[] | null; tokenVersion: number };

function buildCompleto(row: FullRow | null) {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'u-novo',
    active: true,
    screenAccess: null,
    isLeader: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...data,
  }));
  // Como no Prisma, `undefined` no data = não mexe no campo.
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...(row as FullRow),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  }));
  const tx = { user: { findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => ('email' in where ? null : row)), create, update } };
  const prisma = {
    admin: { user: { findFirst: vi.fn(async () => null) } },
    forTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };
  const metering = { assertUserQuota: vi.fn(), userLimit: vi.fn() };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new UsersService(prisma as never, metering as never, audit as never);
  return { service, create, update, audit };
}

const existente = (over: Partial<FullRow> = {}): FullRow => ({
  id: 'u-alvo',
  role: 'GESTOR',
  email: 'alvo@empresa.com',
  name: 'Alvo',
  active: true,
  isLeader: false,
  screenAccess: null,
  tokenVersion: 3,
  ...over,
});

describe('UsersService.create — marcação de líder', () => {
  it('papel LIDER força isLeader=true, mesmo se vier false', async () => {
    const { service, create } = buildCompleto(null);
    const r = await service.create('t1', { name: 'L', email: 'l@x.com', role: 'LIDER', isLeader: false }, 'ADMIN');
    expect(create.mock.calls[0][0].data.isLeader).toBe(true);
    expect(r.user.isLeader).toBe(true);
  });

  it('isLeader informado para ADMIN é gravado (Líder + Administrador)', async () => {
    const { service, create } = buildCompleto(null);
    const r = await service.create('t1', { name: 'A', email: 'a@x.com', role: 'ADMIN', isLeader: true }, 'ADMIN');
    expect(create.mock.calls[0][0].data.isLeader).toBe(true);
    expect(r.user.isLeader).toBe(true);
  });

  it('sem isLeader, papel corporativo nasce sem Minha Jornada', async () => {
    const { service, create } = buildCompleto(null);
    await service.create('t1', { name: 'R', email: 'r@x.com', role: 'RH' }, 'ADMIN');
    expect(create.mock.calls[0][0].data.isLeader).toBe(false);
  });

  it('auditoria user.create registra isLeader', async () => {
    const { service, audit } = buildCompleto(null);
    await service.create('t1', { name: 'A', email: 'a@x.com', role: 'ADMIN', isLeader: true }, 'ADMIN');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.create', meta: expect.objectContaining({ role: 'ADMIN', isLeader: true }) }),
    );
  });

  it('a trava de elevação continua: RH não cria ADMIN (nem marcado como líder)', async () => {
    const { service, create } = buildCompleto(null);
    await expect(
      service.create('t1', { name: 'A', email: 'a@x.com', role: 'ADMIN', isLeader: true }, 'RH'),
    ).rejects.toThrow(/Administrador ou CEO/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('UsersService.update — marcação de líder e revogação de sessão', () => {
  it('trocar o papel incrementa tokenVersion (o papel antigo não sobrevive no JWT)', async () => {
    const { service, update } = buildCompleto(existente({ role: 'ADMIN' }));
    await service.update('t1', 'u-alvo', { role: 'COLABORADOR' }, 'ADMIN');
    expect(update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
  });

  it('só marcar como líder NÃO derruba a sessão (isLeader é lido do banco)', async () => {
    const { service, update } = buildCompleto(existente());
    const r = await service.update('t1', 'u-alvo', { isLeader: true }, 'ADMIN');
    expect(update.mock.calls[0][0].data.isLeader).toBe(true);
    expect(update.mock.calls[0][0].data).not.toHaveProperty('tokenVersion');
    expect(r.isLeader).toBe(true);
  });

  it('mandar o mesmo papel não conta como troca', async () => {
    const { service, update } = buildCompleto(existente());
    await service.update('t1', 'u-alvo', { role: 'GESTOR', active: true }, 'ADMIN');
    expect(update.mock.calls[0][0].data).not.toHaveProperty('tokenVersion');
  });

  it('trocar para LIDER força isLeader=true', async () => {
    const { service, update } = buildCompleto(existente());
    await service.update('t1', 'u-alvo', { role: 'LIDER', isLeader: false }, 'ADMIN');
    expect(update.mock.calls[0][0].data).toMatchObject({ role: 'LIDER', isLeader: true, tokenVersion: { increment: 1 } });
  });

  it('trocar de papel sem informar isLeader mantém o valor atual', async () => {
    const { service, update } = buildCompleto(existente({ isLeader: true }));
    const r = await service.update('t1', 'u-alvo', { role: 'RH' }, 'ADMIN');
    expect(update.mock.calls[0][0].data).not.toHaveProperty('isLeader');
    expect(r.isLeader).toBe(true);
  });

  it('desmarcar o líder de um ADMIN é gravado', async () => {
    const { service, update } = buildCompleto(existente({ role: 'ADMIN', isLeader: true }));
    await service.update('t1', 'u-alvo', { isLeader: false }, 'ADMIN');
    expect(update.mock.calls[0][0].data.isLeader).toBe(false);
  });

  it('auditoria user.update registra isLeader no antes → depois', async () => {
    const { service, audit } = buildCompleto(existente());
    await service.update('t1', 'u-alvo', { isLeader: true }, 'ADMIN');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.update',
        meta: expect.objectContaining({ changes: { isLeader: { before: false, after: true } } }),
      }),
    );
  });

  it('a trava de elevação continua: RH não marca um ADMIN como líder', async () => {
    const { service, update } = buildCompleto(existente({ role: 'ADMIN' }));
    await expect(service.update('t1', 'u-alvo', { isLeader: true }, 'RH')).rejects.toThrow(/Administrador ou CEO/);
    expect(update).not.toHaveBeenCalled();
  });
});

/**
 * Checklist de telas (screenAccess) é só da Área da Organização: o papel LIDER
 * não a usa e a UI nem a mostra para ele. Por isso, com papel resultante LIDER
 * (criação, troca de papel ou edição de quem já é LIDER), grava NULL e ignora
 * a lista enviada — senão uma checklist antiga ficaria presa sem correção.
 */
describe('UsersService — papel LIDER não usa a checklist de telas', () => {
  it('criar LIDER grava screenAccess NULL, mesmo com lista enviada', async () => {
    const { service, create } = buildCompleto(null);
    const r = await service.create(
      't1',
      { name: 'L', email: 'l@x.com', role: 'LIDER', screenAccess: ['lider', 'pocket'] },
      'ADMIN',
    );
    expect(create.mock.calls[0][0].data.screenAccess).toBe(Prisma.DbNull);
    expect(r.user.screenAccess).toBeNull();
  });

  it('criar outro papel continua gravando a checklist enviada', async () => {
    const { service, create } = buildCompleto(null);
    await service.create('t1', { name: 'R', email: 'r@x.com', role: 'RH', screenAccess: ['dashboard'] }, 'ADMIN');
    expect(create.mock.calls[0][0].data.screenAccess).toEqual(['dashboard']);
  });

  it('trocar para LIDER limpa a checklist e ignora a enviada', async () => {
    const { service, update } = buildCompleto(existente({ screenAccess: ['dashboard'] }));
    const r = await service.update('t1', 'u-alvo', { role: 'LIDER', screenAccess: ['relatorios'] }, 'ADMIN');
    expect(update.mock.calls[0][0].data.screenAccess).toBe(Prisma.DbNull);
    expect(r.screenAccess).toBeNull();
  });

  it('editar quem já é LIDER limpa a checklist legada (sem trocar o papel)', async () => {
    const { service, update } = buildCompleto(
      existente({ role: 'LIDER', isLeader: true, screenAccess: ['lider', 'decisoes', 'pocket'] }),
    );
    await service.update('t1', 'u-alvo', { active: true }, 'ADMIN');
    expect(update.mock.calls[0][0].data.screenAccess).toBe(Prisma.DbNull);
    expect(update.mock.calls[0][0].data).not.toHaveProperty('tokenVersion');
  });

  it('outro papel: lista enviada é gravada; sem enviar, não mexe', async () => {
    const a = buildCompleto(existente());
    await a.service.update('t1', 'u-alvo', { screenAccess: ['dashboard', 'dashboard'] }, 'ADMIN');
    expect(a.update.mock.calls[0][0].data.screenAccess).toEqual(['dashboard']);

    const b = buildCompleto(existente({ screenAccess: ['dashboard'] }));
    await b.service.update('t1', 'u-alvo', { active: true }, 'ADMIN');
    expect(b.update.mock.calls[0][0].data).not.toHaveProperty('screenAccess');
  });
});
