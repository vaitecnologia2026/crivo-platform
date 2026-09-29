import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Prisma, type User } from '@crivo/db';
import {
  isLeaderUser,
  type CreateUserRequest,
  type CreateUserResult,
  type UpdateUserRequest,
  type UserSummary,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from '../admin/audit.service';
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
    isLeader: isLeaderUser(u),
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

/**
 * Marcação de líder (Minha Jornada — Spec V1 v1.2 §3) que vai para o banco.
 * O papel LIDER é SEMPRE líder; para os demais papéis vale o que veio, e sem
 * valor informado fica o atual (`current`; na criação, false). Exportada para
 * o cadastro do Super Admin usar a mesma regra.
 */
export function resolveIsLeader(role: string, informed: boolean | undefined, current = false): boolean {
  if (role === 'LIDER') return true;
  return informed ?? current;
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
    // S12-09 (Arquitetura v3.1 §4/§16): mudança de usuário, papel e acesso é
    // crítica e vai para a trilha de auditoria. Opcional só para os testes.
    private readonly audit?: AuditService,
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
    actor?: AuditActor,
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
          isLeader: resolveIsLeader(dto.role, dto.isLeader),
          // Papel LIDER não usa a checklist de telas (ela é só da Área da
          // Organização e a UI não a mostra para ele): grava NULL e ignora a lista.
          screenAccess:
            dto.role === 'LIDER' ? Prisma.DbNull : (normalizeScreens(dto.screenAccess) ?? undefined),
          passwordHash: bcrypt.hashSync(password, 12),
        },
      });
    });

    await this.audit?.record({
      action: 'user.create',
      actor,
      tenantId,
      target: user.id,
      meta: { email, role: user.role, isLeader: user.isLeader, screenAccess: user.screenAccess ?? null },
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

  async update(
    tenantId: string,
    id: string,
    dto: UpdateUserRequest,
    actorRole: string,
    actor?: AuditActor,
  ): Promise<UserSummary> {
    assertCanAssignRole(actorRole, dto.role);
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
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
      const role = dto.role ?? existing.role;
      const isLeader = resolveIsLeader(role, dto.isLeader, existing.isLeader);
      const updated = await tx.user.update({
        where: { id },
        data: {
          role: dto.role,
          active: dto.active,
          ...(isLeader !== existing.isLeader ? { isLeader } : {}),
          // screenAccess: undefined = não mexe; [] ou null = limpa (sem restrição).
          // Papel LIDER (novo ou mantido) não usa a checklist — ela é só da Área
          // da Organização e a UI não a mostra para ele: grava NULL e ignora a
          // lista enviada, senão uma checklist antiga ficaria presa sem correção.
          ...(role === 'LIDER'
            ? { screenAccess: Prisma.DbNull }
            : dto.screenAccess !== undefined
              ? { screenAccess: normalizeScreens(dto.screenAccess) ?? Prisma.DbNull }
              : {}),
          // O papel vai CONGELADO no JWT (o @Roles lê o token): sem derrubar as
          // sessões, um rebaixamento só valeria no próximo login (até 7 dias).
          // `isLeader` não precisa — o AuthGuard lê do banco a cada request.
          ...(role !== existing.role ? { tokenVersion: { increment: 1 } } : {}),
        },
      });
      return { before: existing, after: updated };
    });
    // Antes → depois só dos campos que mudaram (papel, líder, ativo, telas).
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const k of ['role', 'isLeader', 'active', 'screenAccess'] as const) {
      const b = result.before[k] ?? null;
      const a = result.after[k] ?? null;
      if (JSON.stringify(b) !== JSON.stringify(a)) changes[k] = { before: b, after: a };
    }
    if (Object.keys(changes).length) {
      await this.audit?.record({
        action: 'user.update',
        actor,
        tenantId,
        target: id,
        meta: { email: result.after.email, changes },
      });
    }
    return toSummary(result.after);
  }

  /**
   * Redefine a senha de alguém do time e devolve a temporária UMA vez.
   * É o "esqueci minha senha" resolvido dentro da empresa: o link do login só
   * abre WhatsApp, então sem isto toda senha perdida virava chamado para a
   * equipe CRIVO — que precisava entrar no Super Admin para desbloquear.
   */
  async resetPassword(
    tenantId: string,
    id: string,
    actorRole: string,
    actorId: string,
    actor?: AuditActor,
  ): Promise<{ user: UserSummary; tempPassword: string }> {
    const r = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.user.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('Usuário não encontrado');
      // A própria senha se troca em "Trocar senha" (topo da tela), que exige a
      // senha atual. Redefinir a si mesmo entregaria uma temporária sem nenhuma
      // prova de identidade — uma sessão sequestrada trocaria a senha do dono.
      if (existing.id === actorId) {
        throw new ForbiddenException(
          'Para trocar a sua própria senha, use "Trocar senha" no topo da tela.',
        );
      }
      // Mesma regra do update: quem não é ADMIN/CEO não mexe em ADMIN/CEO — sem
      // isto um RH redefiniria a senha do CEO e assumiria a conta dele.
      if (ELEVATED_ROLES.has(existing.role) && !ELEVATED_ROLES.has(actorRole)) {
        throw new ForbiddenException(
          'Apenas Administrador ou CEO podem redefinir a senha de usuários com esses cargos.',
        );
      }
      const password = generatePassword();
      const updated = await tx.user.update({
        where: { id },
        data: {
          passwordHash: bcrypt.hashSync(password, 12),
          // Derruba as sessões abertas daquele usuário: a senha antiga deixa de
          // valer AGORA, não só no próximo login.
          tokenVersion: { increment: 1 },
        },
      });
      return { user: toSummary(updated), tempPassword: password };
    });
    // Sem a senha, claro: só quem redefiniu e de quem.
    await this.audit?.record({
      action: 'user.reset-password',
      actor: actor ?? { id: actorId },
      tenantId,
      target: id,
      meta: { email: r.user.email },
    });
    return r;
  }
}
