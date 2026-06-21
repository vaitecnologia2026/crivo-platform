import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { PlatformAdmin } from '@crivo/types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Protege rotas do control plane (/admin/*). Exige um JWT com scope 'platform'
 * — emitido SÓ no login de super admin. Tokens de tenant (sem esse scope) são
 * rejeitados, então um usuário comum nunca alcança o painel global.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: PlatformAdmin }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');

    try {
      const payload = await this.jwt.verifyAsync(auth.slice(7));
      if (payload.scope !== 'platform') throw new Error('escopo inválido');

      // Revogação de sessão (logout / troca de senha / desativação do admin).
      // rls-allow: super_admins é control-plane (sem RLS); valida sessão por PK global
      const admin = await this.prisma.admin.superAdmin.findUnique({
        where: { id: payload.sub },
        select: { active: true, tokenVersion: true },
      });
      if (!admin || !admin.active) throw new Error('conta inativa ou inexistente');
      if ((payload.tv ?? 0) !== admin.tokenVersion) throw new Error('sessão revogada');

      req.admin = { id: payload.sub, email: payload.email, name: payload.name };
      return true;
    } catch {
      throw new UnauthorizedException('Token de plataforma inválido ou expirado');
    }
  }
}
