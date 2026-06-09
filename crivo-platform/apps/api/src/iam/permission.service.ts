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
}
