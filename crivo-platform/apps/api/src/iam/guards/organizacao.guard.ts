import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionUser } from '@crivo/types';

/**
 * Área da Organização (Spec V1 v1.2 §3): "Somente Líder" (papel LIDER) não vê
 * o Portal corporativo — nem pelo menu, nem por URL/API. Todo papel que não é
 * LIDER tem a Área da Organização (o que ele enxerga lá continua decidido por
 * @Roles, permissão, módulo e tela); quem é corporativo E líder também passa.
 *
 * Roda DEPOIS do AuthGuard. Para os demais papéis não muda nada.
 */
@Injectable()
export class OrganizacaoGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const role = req.user?.role;
    if (!role || role === 'LIDER') {
      throw new ForbiddenException('Área da Organização indisponível para o perfil Líder.');
    }
    return true;
  }
}
