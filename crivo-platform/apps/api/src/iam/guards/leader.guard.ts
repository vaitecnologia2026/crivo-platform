import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionUser } from '@crivo/types';
import { temJornada } from '../role-groups';

/**
 * Minha Jornada (Spec V1 v1.2 §3): as rotas PRIVADAS do líder — Registro de
 * Decisão, ICD próprio, Pocket e Mentor — só atendem quem é líder (papel LIDER
 * ou marcado como líder). "Somente Administrador" não ganha a Jornada: antes
 * qualquer papel gravava decisão/ICD como se fosse líder e entrava no ICD da
 * empresa.
 *
 * Roda DEPOIS do AuthGuard: `req.user.isLeader` vem do banco a cada request
 * (não do JWT), então marcar/desmarcar o líder vale no request seguinte. Não
 * relaxa nada: o escopo "só o próprio" continua nos services.
 */
@Injectable()
export class LeaderGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const user = req.user;
    if (!user || !temJornada(user)) {
      throw new ForbiddenException('Área exclusiva de Minha Jornada: disponível para líderes.');
    }
    return true;
  }
}
