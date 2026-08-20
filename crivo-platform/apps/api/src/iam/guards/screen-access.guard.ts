import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SessionUser } from '@crivo/types';
import { SCREEN_KEY } from '../require-screen.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Lockdown por TELA (defesa em profundidade). Se o controller declara
 * @RequireScreen('x') e o usuário tem restrição de telas (User.screenAccess)
 * que NÃO inclui 'x', bloqueia (403) — mesmo que o papel autorizasse. Espelha,
 * no backend, o filtro da nav do portal. Roda depois do AuthGuard (precisa de
 * req.user). Sem @RequireScreen ou sem restrição → libera.
 *
 * Lê screenAccess do banco (control plane, por id) a cada request → sempre
 * fresco: revogar uma tela tem efeito imediato, sem esperar novo login.
 */
@Injectable()
export class ScreenAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Metadata é string[] (any-of). Aceita string legada por segurança.
    const meta = this.reflector.getAllAndOverride<string | string[]>(SCREEN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const screens = Array.isArray(meta) ? meta : meta ? [meta] : [];
    if (screens.length === 0) return true; // controller sem tela declarada → não restringe

    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const userId = req.user?.id;
    if (!userId) return true; // sem usuário (rota pública) → outros guards decidem

    const user = await this.prisma.admin.user.findUnique({
      where: { id: userId },
      select: { screenAccess: true },
    });
    const allowed = Array.isArray(user?.screenAccess) ? (user!.screenAccess as string[]) : null;
    if (!allowed) return true; // sem restrição → vê tudo que papel/módulo permitem

    // ANY-OF: basta o usuário ter acesso a UMA das telas que consomem este endpoint.
    if (!screens.some((s) => allowed.includes(s))) {
      throw new ForbiddenException('Você não tem acesso a esta tela.');
    }
    return true;
  }
}
