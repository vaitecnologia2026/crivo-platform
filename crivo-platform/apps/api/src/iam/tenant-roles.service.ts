import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../admin/audit.service';
import { PermissionService } from './permission.service';

/** Quem está executando a ação (vem do JWT via @CurrentUser no controller). */
export interface RbacActor {
  id?: string;
  email?: string;
}

export interface TenantRoleData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  isCustom: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantRoleInput {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateTenantRoleInput {
  name?: string;
  description?: string | null;
  permissions?: string[];
  active?: boolean;
}

/**
 * RBAC dinâmico (#68) — gestão de papéis customizados por tenant.
 * Control plane sem RLS — usa `prisma.admin`. Acesso é gateado no controller
 * pela permissão `users:manage` (já existe no catálogo).
 */
@Injectable()
export class TenantRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string): Promise<TenantRoleData[]> {
    const rows = await this.prisma.admin.tenantRole.findMany({
      where: { tenantId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toData);
  }

  async create(
    tenantId: string,
    dto: CreateTenantRoleInput,
    actor: RbacActor = {},
  ): Promise<TenantRoleData> {
    const code = normalizeCode(dto.code);
    if (!code) throw new BadRequestException('Code inválido (use letras minúsculas, números e _).');

    await this.validatePermissions(dto.permissions);

    const exists = await this.prisma.admin.tenantRole.findFirst({
      where: { tenantId, code },
    });
    if (exists) throw new ConflictException('Já existe um papel com este code neste tenant.');

    const row = await this.prisma.admin.tenantRole.create({
      data: {
        tenantId,
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        permissions: dto.permissions,
        isCustom: true,
        active: true,
      },
    });
    await this.audit.record({
      action: 'tenant.role.create',
      actor,
      tenantId,
      target: row.id,
      meta: { code: row.code, name: row.name, permissionsCount: dto.permissions.length },
    });
    return toData(row);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTenantRoleInput,
    actor: RbacActor = {},
  ): Promise<TenantRoleData> {
    const existing = await this.prisma.admin.tenantRole.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Papel não encontrado.');
    if (dto.permissions) await this.validatePermissions(dto.permissions);

    const row = await this.prisma.admin.tenantRole.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        permissions: dto.permissions,
        active: dto.active,
      },
    });
    await this.audit.record({
      action: 'tenant.role.update',
      actor,
      tenantId,
      target: id,
      meta: {
        code: existing.code,
        changed: Object.keys(dto).filter((k) => (dto as Record<string, unknown>)[k] !== undefined),
      },
    });
    return toData(row);
  }

  async remove(tenantId: string, id: string, actor: RbacActor = {}): Promise<{ ok: true }> {
    const existing = await this.prisma.admin.tenantRole.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Papel não encontrado.');
    // Cascade remove UserRole automaticamente via FK.
    await this.prisma.admin.tenantRole.delete({ where: { id } });
    await this.audit.record({
      action: 'tenant.role.delete',
      actor,
      tenantId,
      target: id,
      meta: { code: existing.code, name: existing.name },
    });
    return { ok: true as const };
  }

  /** Atribui papel a um usuário do mesmo tenant. Idempotente. */
  async assignToUser(
    tenantId: string,
    roleId: string,
    userId: string,
    actor: RbacActor = {},
  ): Promise<{ ok: true }> {
    const role = await this.prisma.admin.tenantRole.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Papel não encontrado neste tenant.');
    // Confirma que o user pertence ao tenant.
    const user = await this.prisma.admin.user.findUnique({ where: { id: userId } });
    if (!user || user.tenantId !== tenantId) {
      throw new BadRequestException('Usuário não pertence a este tenant.');
    }
    await this.prisma.admin.userRole.upsert({
      where: { userId_tenantRoleId: { userId, tenantRoleId: roleId } },
      create: { userId, tenantRoleId: roleId, assignedBy: actor.email ?? null },
      update: { assignedBy: actor.email ?? null },
    });
    await this.audit.record({
      action: 'tenant.role.assign',
      actor,
      tenantId,
      target: roleId,
      meta: { roleCode: role.code, userId, userEmail: user.email },
    });
    return { ok: true as const };
  }

  async unassignFromUser(
    tenantId: string,
    roleId: string,
    userId: string,
    actor: RbacActor = {},
  ): Promise<{ ok: true }> {
    const role = await this.prisma.admin.tenantRole.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Papel não encontrado neste tenant.');
    const user = await this.prisma.admin.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    await this.prisma.admin.userRole.deleteMany({
      where: { userId, tenantRoleId: roleId },
    });
    await this.audit.record({
      action: 'tenant.role.unassign',
      actor,
      tenantId,
      target: roleId,
      meta: { roleCode: role.code, userId, userEmail: user?.email ?? null },
    });
    return { ok: true as const };
  }

  /** Lista usuários do tenant com seus papéis (sistema + custom). */
  async usersWithRoles(tenantId: string): Promise<
    Array<{ id: string; email: string; name: string; systemRole: string; customRoles: { id: string; name: string; code: string }[] }>
  > {
    const users = await this.prisma.admin.user.findMany({
      where: { tenantId, active: true },
      orderBy: { name: 'asc' },
      include: {
        userRoles: {
          include: { tenantRole: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      systemRole: u.role,
      customRoles: u.userRoles.map((ur) => ur.tenantRole),
    }));
  }

  private async validatePermissions(perms: string[]) {
    if (!Array.isArray(perms) || perms.length === 0) {
      throw new BadRequestException('Pelo menos uma permissão é obrigatória.');
    }
    // Confirma que cada code existe no catálogo global.
    const valid = await this.prisma.admin.permission.findMany({
      where: { code: { in: perms } },
      select: { code: true },
    });
    const validSet = new Set(valid.map((v) => v.code));
    const invalid = perms.filter((p) => !validSet.has(p));
    if (invalid.length > 0) {
      throw new BadRequestException(`Permissões inválidas: ${invalid.join(', ')}.`);
    }
  }
}

function normalizeCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toData(row: any): TenantRoleData {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    permissions: row.permissions ?? [],
    isCustom: row.isCustom,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
