import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Prisma, type User } from '@crivo/db';
import type { CreateUserRequest, CreateUserResult, UpdateUserRequest, UserSummary } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { MeteringService } from '../metering/metering.service';

/** Senha temporária legível (sem caracteres ambíguos). */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join('');
}

/** Projeta o User sem expor o hash de senha. */
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

/** Normaliza a lista de telas: array de strings único, ou null (sem restrição). */
function normalizeScreens(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const list = v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return list.length ? Array.from(new Set(list)) : null;
}

/** Cargos administrativos elevados — só quem já os tem pode concedê-los. */
const ELEVATED_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'CEO']);

/** Anti-escalonamento de privilégio: impede que quem tem users:create/edit
 *  promova alguém (ou a si mesmo) a ADMIN/CEO sem ser ADMIN/CEO. */
function assertCanAssignRole(actorRole: string, targetRole: string | undefined): void {
  if (targetRole && ELEVATED_ROLES.has(targetRole) && !ELEVATED_ROLES.has(actorRole)) {
    throw new ForbiddenException(
      'Apenas Administrador ou CEO podem atribuir os cargos Administrador ou CEO.',
    );
  }
}

/**
 * Gestão de usuários da empresa (time). Tudo escopado por tenant (RLS via
 * forTenant) — uma empresa só enxerga/edita os próprios usuários. A criação
 * respeita o limite de usuários ativos do plano (MeteringService).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metering: MeteringService,
  ) {}

  list(tenantId: string): Promise<UserSummary[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.user.findMany({ orderBy: { createdAt: 'asc' } });
      return rows.map(toSummary);
    });
  }

  async create(
    tenantId: string,
    dto: CreateUserRequest,
    actorRole: string,
  ): Promise<CreateUserResult> {
    assertCanAssignRole(actorRole, dto.role);
    const email = dto.email.toLowerCase().trim();
    const generated = !dto.password;
    const password = dto.password ?? generatePassword();

    // E-mail é único na plataforma: rejeita se já existe em QUALQUER empresa
    // (evita o login ambíguo que pedia "selecione a empresa").
    // rls-allow: unicidade global de e-mail (control plane) antes do escopo RLS do tenant
    const dupGlobal = await this.prisma.admin.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (dupGlobal) throw new ConflictException('Este e-mail já está em uso. Escolha outro.');

    const user = await this.prisma.forTenant(tenantId, async (tx) => {
      await this.metering.assertUserQuota(tx, tenantId);
      const dup = await tx.user.findFirst({ where: { email } });
      if (dup) throw new ConflictException('Já existe um usuário com este e-mail na empresa');
      return tx.user.create({
        data: {
          tenantId,
          email,
          name: dto.name.trim(),
          role: dto.role,
          screenAccess: normalizeScreens(dto.screenAccess) ?? undefined,
          passwordHash: bcrypt.hashSync(password, 12),
        },
      });
    });

    return { user: toSummary(user), tempPassword: generated ? password : undefined };
  }

  /** Uso de assentos: ativos atuais + limite (do Produto da empresa; null = ilimitado). */
  async seats(tenantId: string): Promise<{ active: number; max: number | null }> {
    const active = await this.prisma.forTenant(tenantId, (tx) =>
      tx.user.count({ where: { active: true } }),
    );
    const max = await this.metering.userLimit(tenantId);
    return { active, max };
  }

  update(
    tenantId: string,
    id: string,
    dto: UpdateUserRequest,
    actorRole: string,
  ): Promise<UserSummary> {
    assertCanAssignRole(actorRole, dto.role);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.user.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Usuário não encontrado');
      // Não permitir que um não-elevado rebaixe/mexa num ADMIN/CEO existente.
      if (ELEVATED_ROLES.has(existing.role) && !ELEVATED_ROLES.has(actorRole)) {
        throw new ForbiddenException(
          'Apenas Administrador ou CEO podem alterar usuários com cargo Administrador ou CEO.',
        );
      }
      // Reativar respeita a quota do plano (criar "capacidade" de volta).
      if (dto.active === true && !existing.active) {
        await this.metering.assertUserQuota(tx, tenantId);
      }
      const updated = await tx.user.update({
        where: { id },
        data: {
          role: dto.role,
          active: dto.active,
          // screenAccess: undefined = não mexe; [] ou null = limpa (sem restrição).
          ...(dto.screenAccess !== undefined
            ? { screenAccess: normalizeScreens(dto.screenAccess) ?? Prisma.DbNull }
            : {}),
        },
      });
      return toSummary(updated);
    });
  }
}
