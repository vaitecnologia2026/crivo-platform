import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { PlatformAdmin } from '@crivo/types';

/**
 * Protege rotas do control plane (/admin/*). Exige um JWT com scope 'platform'
 * — emitido SÓ no login de super admin. Tokens de tenant (sem esse scope) são
 * rejeitados, então um usuário comum nunca alcança o painel global.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: PlatformAdmin }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');

    try {
      const payload = await this.jwt.verifyAsync(auth.slice(7));
      if (payload.scope !== 'platform') throw new Error('escopo inválido');
      req.admin = { id: payload.sub, email: payload.email, name: payload.name };
      return true;
    } catch {
      throw new UnauthorizedException('Token de plataforma inválido ou expirado');
    }
  }
}
