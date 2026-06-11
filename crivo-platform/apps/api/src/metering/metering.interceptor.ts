import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs';
import type { SessionUser } from '@crivo/types';
import { MeteringService } from './metering.service';

/**
 * Metering de uso (F4): conta uma chamada de API por empresa a cada requisição
 * autenticada de TENANT bem-sucedida. Pula login, rotas públicas e super admin
 * (sem tenantId). Incremento best-effort e fora do caminho crítico (no tap pós-
 * resposta). Em alta escala, considerar agregação em buffer/Redis em vez de um
 * upsert por request.
 */
@Injectable()
export class MeteringInterceptor implements NestInterceptor {
  constructor(private readonly metering: MeteringService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const tenantId = req.user?.tenantId;
    return next.handle().pipe(
      tap(() => {
        if (tenantId) void this.metering.track(tenantId, 'api_calls');
      }),
    );
  }
}
