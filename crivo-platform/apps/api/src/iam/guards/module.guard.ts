import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SessionUser } from '@crivo/types';
import { MODULE_KEY } from '../require-module.decorator';
import { ModuleService } from '../module.service';

/**
 * Gate de módulo (F4): bloqueia a rota se o módulo declarado via
 * @RequireModule() não estiver ativo para a empresa do usuário. Roda depois do
 * AuthGuard (que popula req.user com tenantId). Ortogonal ao PermissionGuard:
 * mesmo um papel autorizado é barrado se a empresa não tem o módulo no plano.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modules: ModuleService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(MODULE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Módulo indisponível');

    if (!(await this.modules.isEnabled(tenantId, required))) {
      throw new ForbiddenException(`Módulo "${required}" não está ativo para a sua empresa`);
    }
    return true;
  }
}
