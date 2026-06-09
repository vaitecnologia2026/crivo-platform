import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SessionUser } from '@crivo/types';
import { PERMS_KEY } from '../require-permission.decorator';
import { PermissionService } from '../permission.service';

/**
 * RBAC dinâmico: exige que as permissões declaradas via @RequirePermission()
 * estejam no conjunto efetivo do papel do usuário (resolvido do catálogo, não
 * de uma lista hard-coded). Roda depois do AuthGuard (que popula req.user).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly perms: PermissionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const role = req.user?.role;
    if (!role) throw new ForbiddenException('Permissão insuficiente');

    const granted = await this.perms.effectiveForRole(role);
    if (!required.every((p) => granted.has(p))) {
      throw new ForbiddenException('Permissão insuficiente');
    }
    return true;
  }
}
