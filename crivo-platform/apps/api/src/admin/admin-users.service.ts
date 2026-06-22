import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Prisma, type User } from '@crivo/db';
import type {
  CreateUserRequest,
  CreateUserResult,
  UpdateUserRequest,
  UserSummary,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { MeteringService } from '../metering/metering.service';
import { AuditService, type AuditActor } from './audit.service';

/** Senha temporária legível (sem caracteres ambíguos). */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join('');
}

function toSummary(u: User): UserSummary {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserSummary['role'],
    active: u.active,
    screenAccess: Array.isArray(u.screenAccess) ? (u.screenAccess as string[]) : null,
    createdAt: u.createdAt.toISOString(),
  };
}

function normalizeScreens(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const list = v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return list.length ? Array.from(new Set(list)) : null;
}

/**
 * Gestão de usuários de QUALQUER empresa, pelo Super Admin (control plane).
 *
 * Diferente do UsersService (App da Empresa, que usa RLS via forTenant e o
 * tenant vem do JWT), aqui o tenant vem da ROTA e a conexão é a de owner
 * (`prisma.admin`, sem RLS) — por isso TODA query filtra explicitamente por
 * `tenantId`, e mutações por `id` confirmam antes que o usuário pertence à
 * empresa informada (impede edição cross-empresa por id adivinhado).
 *
 * Acesso restrito ao Super Admin (SuperAdminGuard no controller).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly metering: MeteringService,
  ) {}

  private async assertTenant(tenantId: string): Promise<void> {
    const org = await this.prisma.admin.organization.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Empresa não encontrada');
  }

  async list(tenantId: string): Promise<UserSummary[]> {
    await this.assertTenant(tenantId);
    const rows = await this.prisma.admin.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toSummary);
  }

  async create(
    tenantId: string,
    dto: CreateUserRequest,
    actor: AuditActor,
  ): Promise<CreateUserResult> {
    await this.assertTenant(tenantId);
    // Limite de usuários do plano (mesma regra do app da empresa).
    await this.metering.assertUserQuotaAdmin(tenantId);
    const email = dto.email.toLowerCase().trim();
    const generated = !dto.password;
    const password = dto.password ?? generatePassword();

    // E-mail é único na plataforma: rejeita se já existe em QUALQUER empresa.
    const dup = await this.prisma.admin.user.findFirst({ where: { email } });
    if (dup) throw new ConflictException('Este e-mail já está em uso na plataforma. Use outro.');

    const user = await this.prisma.admin.user.create({
      data: {
        tenantId,
        email,
        name: dto.name.trim(),
        role: dto.role,
        screenAccess: normalizeScreens(dto.screenAccess) ?? undefined,
        passwordHash: bcrypt.hashSync(password, 12),
      },
    });

    await this.audit.record({
      action: 'admin.user.create',
      actor,
      target: email,
      meta: { tenantId, role: dto.role },
    });

    return { user: toSummary(user), tempPassword: generated ? password : undefined };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateUserRequest,
    actor: AuditActor,
  ): Promise<UserSummary> {
    // Confirma que o usuário pertence à empresa informada (anti cross-empresa).
    const existing = await this.prisma.admin.user.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Usuário não encontrado nesta empresa');

    // Reativar consome um assento → respeita o limite do plano.
    if (dto.active === true && !existing.active) {
      await this.metering.assertUserQuotaAdmin(tenantId);
    }

    const updated = await this.prisma.admin.user.update({
      where: { id },
      data: {
        role: dto.role,
        active: dto.active,
        ...(dto.screenAccess !== undefined
          ? { screenAccess: normalizeScreens(dto.screenAccess) ?? Prisma.DbNull }
          : {}),
      },
    });

    await this.audit.record({
      action: 'admin.user.update',
      actor,
      target: id,
      meta: { tenantId, role: dto.role, active: dto.active },
    });

    return toSummary(updated);
  }

  /** Uso de assentos da empresa: ativos atuais + limite do plano (null = ilimitado). */
  async seats(tenantId: string): Promise<{ active: number; max: number | null }> {
    await this.assertTenant(tenantId);
    // rls-allow: contagem de assentos por tenantId explícito (super admin, control plane)
    const active = await this.prisma.admin.user.count({ where: { tenantId, active: true } });
    const max = await this.metering.userLimit(tenantId);
    return { active, max };
  }
}
