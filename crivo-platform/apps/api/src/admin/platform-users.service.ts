import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

export type PlatformUserData = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  active: boolean;
  createdAt: string;
};

/** Funções organizacionais sugeridas (rótulo — permissões por função = fase posterior). */
export const PLATFORM_USER_ROLES = ['Super Admin', 'Comercial', 'Financeiro', 'Operações', 'Consultor'];

/**
 * Usuários CRIVO do painel (pedido do cliente 09/07: "criar usuários da CRIVO —
 * Comercial, Financeiro…"). São contas de super_admins com FUNÇÃO organizacional.
 * HOJE a função é rótulo (todos têm acesso de administrador do painel);
 * permissões diferenciadas por função entram em fase posterior.
 * Senha: gerada TEMPORÁRIA no servidor e exibida UMA vez (padrão do provisionamento).
 */
@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toData(u: { id: string; name: string; email: string; role: string | null; active: boolean; createdAt: Date }): PlatformUserData {
    return { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, createdAt: u.createdAt.toISOString() };
  }

  async list(): Promise<PlatformUserData[]> {
    const rows = await this.prisma.admin.superAdmin.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((u) => this.toData(u));
  }

  async create(input: { name: string; email: string; role?: string }, actor: Actor) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name || name.length < 2) throw new BadRequestException('Informe o nome.');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException('E-mail inválido.');
    const exists = await this.prisma.admin.superAdmin.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Já existe um usuário com este e-mail.');

    const tempPassword = `crivo-${randomBytes(4).toString('hex')}`;
    const user = await this.prisma.admin.superAdmin.create({
      data: {
        name,
        email,
        role: input.role?.trim() || null,
        passwordHash: await bcrypt.hash(tempPassword, 12),
      },
    });
    await this.audit.record({
      action: 'platform.user.create',
      actor,
      target: email,
      meta: { name, role: user.role },
    });
    // A senha temporária é retornada UMA única vez (não fica em log/banco em claro).
    return { user: this.toData(user), tempPassword };
  }

  async update(id: string, input: { role?: string | null; active?: boolean; resetPassword?: boolean }, actor: Actor) {
    const user = await this.prisma.admin.superAdmin.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.id === actor.id && input.active === false) {
      throw new BadRequestException('Você não pode desativar a própria conta.');
    }

    let tempPassword: string | undefined;
    const data: { role?: string | null; active?: boolean; passwordHash?: string; tokenVersion?: { increment: number } } = {};
    if (input.role !== undefined) data.role = input.role?.trim() || null;
    if (input.active !== undefined) data.active = input.active;
    if (input.resetPassword) {
      tempPassword = `crivo-${randomBytes(4).toString('hex')}`;
      data.passwordHash = await bcrypt.hash(tempPassword, 12);
      data.tokenVersion = { increment: 1 }; // derruba sessões antigas
    }
    if (input.active === false) data.tokenVersion = { increment: 1 };

    const updated = await this.prisma.admin.superAdmin.update({ where: { id }, data });
    await this.audit.record({
      action: 'platform.user.update',
      actor,
      target: user.email,
      meta: { role: input.role, active: input.active, resetPassword: !!input.resetPassword },
    });
    return { user: this.toData(updated), tempPassword };
  }
}
