import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolve quais módulos (F4) estão ATIVOS para uma empresa. tenant_modules é
 * data plane (RLS por tenant) → leitura sob forTenant, confinada à própria
 * empresa. A ativação/desativação é feita pelo super admin (control plane),
 * por isso aqui só lemos. Sem cache nesta fatia: a consulta é indexada e a
 * lista muda quando o super admin alterna um módulo (correção > micro-perf).
 */
@Injectable()
export class ModuleService {
  constructor(private readonly prisma: PrismaService) {}

  /** Conjunto de códigos de módulos ativos da empresa. */
  async enabledFor(tenantId: string): Promise<Set<string>> {
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenantModule.findMany({ where: { enabled: true }, select: { moduleCode: true } }),
    );
    return new Set(rows.map((r) => r.moduleCode));
  }

  async isEnabled(tenantId: string, code: string): Promise<boolean> {
    return (await this.enabledFor(tenantId)).has(code);
  }
}
