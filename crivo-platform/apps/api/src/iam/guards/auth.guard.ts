import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { SessionUser } from '@crivo/types';
import { PrismaService } from '../../prisma/prisma.service';

/** Verifica o Bearer JWT e injeta req.user (com tenantId para RLS). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente');

    try {
      const payload = await this.jwt.verifyAsync(auth.slice(7));
      // Token de super admin (scope 'platform') não vale como sessão de tenant —
      // ele não tem tenantId e não pode acessar dados de empresa.
      if (payload.scope === 'platform') throw new Error('escopo de plataforma');

      // Revogação de sessão: o token só vale se a conta existe, está ativa e a
      // versão (tv) bate com a atual. Busca por PK global ANTES do contexto RLS
      // (sessão é control-plane); lê só active/tokenVersion. Incrementar a versão
      // (logout / troca de senha) ou desativar a conta invalida os tokens emitidos.
      // rls-allow: validação de sessão por PK global, pré-RLS; não lê dados de tenant
      const u = await this.prisma.admin.user.findUnique({
        where: { id: payload.sub },
        select: { active: true, tokenVersion: true },
      });
      if (!u || !u.active) throw new Error('conta inativa ou inexistente');
      if ((payload.tv ?? 0) !== u.tokenVersion) throw new Error('sessão revogada');

      req.user = {
        id: payload.sub,
        tenantId: payload.tenantId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
