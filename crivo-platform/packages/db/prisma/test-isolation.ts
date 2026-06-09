/**
 * Teste automatizado de isolamento multi-tenant (F2). Gate de segurança:
 * verifica, contra o banco real, que a RLS isola tenants e que o control plane
 * é inacessível ao papel de aplicação. Rode com `pnpm db:test:isolation`
 * (requer DATABASE_URL = owner e DATABASE_URL_APP = crivo_app, + `pnpm db:rls`).
 */
import { PrismaClient } from '@prisma/client';

const owner = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const app = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_APP });

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failures++;
}

/** Executa no contexto do app fixando o tenant para a RLS (igual ao runtime). */
function withTenant<T>(tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return app.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant', $1, true)`, tenantId);
    return fn(tx as unknown as PrismaClient);
  });
}

async function main() {
  // Dois tenants de teste (via owner / bypass RLS).
  const a = await owner.organization.create({ data: { name: 'ISO-A' } });
  const b = await owner.organization.create({ data: { name: 'ISO-B' } });
  await owner.user.create({ data: { tenantId: a.id, email: 'a@iso.test', name: 'A', passwordHash: 'x' } });
  await owner.user.create({ data: { tenantId: b.id, email: 'b@iso.test', name: 'B', passwordHash: 'x' } });

  try {
    // 1) Tenant A só enxerga os próprios dados.
    const seenByA = await withTenant(a.id, (tx) => tx.user.findMany());
    check(
      'RLS data plane: tenant A vê só os próprios usuários',
      seenByA.length >= 1 && seenByA.every((u) => u.tenantId === a.id),
    );

    // 2) Sem app.tenant fixado, nenhuma linha é visível.
    const none = await app.$transaction((tx) => tx.user.findMany());
    check('RLS data plane: sem app.tenant => 0 linhas', none.length === 0);

    // 3) WITH CHECK: inserir em outro tenant é bloqueado.
    let crossInsertBlocked = false;
    try {
      await withTenant(a.id, (tx) =>
        tx.user.create({ data: { tenantId: b.id, email: 'x@iso.test', name: 'x', passwordHash: 'x' } }),
      );
    } catch {
      crossInsertBlocked = true;
    }
    check('RLS data plane: insert cross-tenant bloqueado (WITH CHECK)', crossInsertBlocked);

    // 4) Control plane inacessível ao papel de aplicação.
    for (const table of ['tenants', 'super_admins', 'audit_log']) {
      let denied = false;
      try {
        await app.$queryRawUnsafe(`SELECT count(*) FROM ${table}`);
      } catch {
        denied = true;
      }
      check(`Control plane: crivo_app sem acesso a ${table}`, denied);
    }
  } finally {
    await owner.organization.delete({ where: { id: a.id } }).catch(() => {});
    await owner.organization.delete({ where: { id: b.id } }).catch(() => {});
    await owner.$disconnect();
    await app.$disconnect();
  }

  console.log(failures === 0 ? '\nISOLAMENTO OK ✅' : `\n${failures} FALHA(S) ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
