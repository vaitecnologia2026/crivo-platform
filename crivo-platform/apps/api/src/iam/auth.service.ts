import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginResponse, SessionUser } from '@crivo/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, tenantSlug?: string): Promise<LoginResponse> {
    const normalizedEmail = email.toLowerCase().trim();
    // Login é cross-tenant por e-mail → usa a conexão owner (bypass RLS).
    // R2 (F2): o e-mail pode existir em vários tenants (@@unique([tenantId,email])).
    // - Com tenantSlug: escopa a busca à organização daquele slug.
    // - Sem slug: só prossegue se houver EXATAMENTE 1 correspondência; havendo
    //   mais de uma, exige a empresa (em vez de logar contra um tenant arbitrário).
    let user: Awaited<ReturnType<typeof this.prisma.admin.user.findFirst>> = null;
    if (tenantSlug) {
      const tenant = await this.prisma.admin.tenant.findUnique({
        where: { slug: tenantSlug.trim() },
      });
      if (tenant) {
        user = await this.prisma.admin.user.findFirst({
          where: { tenantId: tenant.organizationId, email: normalizedEmail, active: true },
        });
      }
    } else {
      const matches = await this.prisma.admin.user.findMany({
        where: { email: normalizedEmail, active: true },
        take: 2,
      });
      if (matches.length > 1) {
        throw new UnauthorizedException('Informe a empresa para entrar.');
      }
      user = matches[0] ?? null;
    }

    // bcrypt.compare em tempo constante; mesmo erro p/ usuário inexistente (anti-enumeração).
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Gating por status do tenant (control plane): empresa SUSPENDED/DELETED não
    // autentica ninguém. Tenant ausente = org legada sem registro → permite
    // (compat até backfill). Ver docs/SAAS-TRANSFORMATION.md (F1).
    const tenant = await this.prisma.admin.tenant.findUnique({
      where: { organizationId: user.tenantId },
    });
    if (tenant && tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Empresa indisponível. Contate o suporte.');
    }

    const session: SessionUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as SessionUser['role'],
    };

    const token = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    return { token, user: session };
  }

  /** Usuário troca a própria senha (sob RLS — só o próprio registro do tenant). */
  async changeOwnPassword(
    tenantId: string,
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const u = await tx.user.findFirst({ where: { id: userId } });
      if (!u) throw new UnauthorizedException('Sessão inválida');
      if (!bcrypt.compareSync(currentPassword, u.passwordHash)) {
        throw new UnauthorizedException('Senha atual incorreta');
      }
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: bcrypt.hashSync(newPassword, 10) },
      });
      return { ok: true as const };
    });
  }
}
