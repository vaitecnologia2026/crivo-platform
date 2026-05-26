import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@crivo/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Conexão owner (bypass RLS). USO RESTRITO: apenas autenticação cross-tenant
   * e provisionamento de novos tenants. Nunca para queries de negócio.
   */
  readonly admin: PrismaClient;

  constructor() {
    // Runtime conecta como crivo_app (não-owner) para que a RLS seja aplicada.
    super({
      datasourceUrl: process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL,
    });
    this.admin = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  }

  async onModuleInit() {
    await this.$connect();
    await this.admin.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.admin.$disconnect();
  }

  /**
   * Executa queries com o tenant fixado para RLS (escopo da transação).
   * Use em toda operação de negócio: this.prisma.forTenant(tenantId, (tx) => ...).
   */
  async forTenant<T>(tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant', $1, true)`, tenantId);
      return fn(tx as unknown as PrismaClient);
    });
  }
}
