import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import type { User } from '@crivo/db';
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
    createdAt: u.createdAt.toISOString(),
  };
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

  async create(tenantId: string, dto: CreateUserRequest): Promise<CreateUserResult> {
    const email = dto.email.toLowerCase().trim();
    const generated = !dto.password;
    const password = dto.password ?? generatePassword();

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
          passwordHash: bcrypt.hashSync(password, 10),
        },
      });
    });

    return { user: toSummary(user), tempPassword: generated ? password : undefined };
  }

  update(tenantId: string, id: string, dto: UpdateUserRequest): Promise<UserSummary> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.user.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Usuário não encontrado');
      // Reativar respeita a quota do plano (criar "capacidade" de volta).
      if (dto.active === true && !existing.active) {
        await this.metering.assertUserQuota(tx, tenantId);
      }
      const updated = await tx.user.update({
        where: { id },
        data: { role: dto.role, active: dto.active },
      });
      return toSummary(updated);
    });
  }
}
