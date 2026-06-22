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
      // E-mail é único na plataforma (garantido na criação). Para tolerar uma
      // duplicata legada SEM pedir a empresa, desempata pela senha: dentre as
      // contas com este e-mail, entra naquela cujo hash confere. Caso normal
      // (exatamente 1 conta) é idêntico ao fluxo anterior.
      const matches = await this.prisma.admin.user.findMany({
        where: { email: normalizedEmail, active: true },
      });
      if (matches.length <= 1) {
        user = matches[0] ?? null;
      } else {
        const hits: typeof matches = [];
        for (const m of matches) {
          if (await bcrypt.compare(password, m.passwordHash)) hits.push(m);
        }
        // 2+ contas com o MESMO e-mail E a MESMA senha: ambíguo de verdade.
        if (hits.length > 1) {
          throw new UnauthorizedException('Conta duplicada. Contate o suporte.');
        }
        // 1 acerto → entra nela; 0 acertos → cai no "Credenciais inválidas" abaixo.
        user = hits[0] ?? matches[0];
      }
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
      tv: user.tokenVersion, // versão de sessão — o guard rejeita se divergir (revogação)
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
      // Trocar a senha revoga as sessões antigas (incrementa a versão de token).
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: bcrypt.hashSync(newPassword, 12), tokenVersion: { increment: 1 } },
      });
      return { ok: true as const };
    });
  }

  /**
   * Logout: revoga TODAS as sessões do usuário (todos os dispositivos) incrementando
   * a versão de token. Qualquer JWT emitido antes deixa de ser aceito pelo AuthGuard.
   */
  async logout(tenantId: string, userId: string): Promise<{ ok: true }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
      return { ok: true as const };
    });
  }
}
