import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

/**
 * Cliente Prisma singleton. Em dev, reaproveita a instância entre hot-reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Executa um bloco dentro de uma transação com o tenant fixado para RLS.
 * Toda query dentro do callback só enxerga dados do tenant informado.
 *
 *   await withTenant(orgId, (tx) => tx.user.findMany());
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // set_config(..., true) => escopo da transação atual
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant', $1, true)`, tenantId);
    return fn(tx);
  });
}
