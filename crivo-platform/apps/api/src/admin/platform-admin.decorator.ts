import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PlatformAdmin } from '@crivo/types';

/** Injeta o super admin da sessão (populado pelo SuperAdminGuard). */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAdmin | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: PlatformAdmin }>();
    return req.admin;
  },
);
