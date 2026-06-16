import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolve o conjunto efetivo de permissões (códigos "modulo:acao") de um papel.
 * O catálogo RBAC é GLOBAL (sem RLS) → leitura direta na conexão de app.
 *
 * Cache em memória por código de papel: papéis de SISTEMA são estáticos, então
 * a 1ª resolução popula o cache e as seguintes não tocam o banco. Quando
 * entrarem papéis customizados por empresa, a chave passa a ser tenant+papel e
 * será preciso invalidar na edição (próxima fatia da F3).
 */
@Injectable()
export class PermissionService {
  private readonly cache = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  async effectiveForRole(roleCode: string): Promise<Set<string>> {
    const cached = this.cache.get(roleCode);
    if (cached) return cached;

    const role = await this.prisma.roleDef.findUnique({
      where: { code: roleCode },
      include: { perms: { include: { perm: true } } },
    });
    const set = new Set((role?.perms ?? []).map((rp) => rp.perm.code));
    this.cache.set(roleCode, set);
    return set;
  }

  /** #68 — Permissões efetivas de um USUÁRIO: une o papel de sistema
   *  (User.role enum) com TODOS os TenantRole customizados atribuídos via
   *  UserRole. RBAC dinâmico aditivo: nunca remove permissão do papel
   *  legado, só adiciona. Sem cache (precisa refletir mudanças de UserRole). */
  async effectiveForUser(
    tenantId: string,
    userId: string,
    systemRoleCode: string,
  ): Promise<Set<string>> {
    const base = await this.effectiveForRole(systemRoleCode);
    const combined = new Set(base);
    const userRoles = await this.prisma.admin.userRole.findMany({
      where: {
        userId,
        tenantRole: { tenantId, active: true },
      },
      include: { tenantRole: { select: { permissions: true } } },
    });
    for (const ur of userRoles) {
      for (const p of ur.tenantRole.permissions) combined.add(p);
    }
    return combined;
  }
}
