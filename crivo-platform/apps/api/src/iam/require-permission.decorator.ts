import { SetMetadata } from '@nestjs/common';

export const PERMS_KEY = 'permissions';

/**
 * Exige uma ou mais permissões (modulo:acao) no handler/controller.
 * Ex.: @RequirePermission('leads:view'). Avaliado pelo PermissionGuard.
 */
export const RequirePermission = (...perms: string[]) => SetMetadata(PERMS_KEY, perms);
