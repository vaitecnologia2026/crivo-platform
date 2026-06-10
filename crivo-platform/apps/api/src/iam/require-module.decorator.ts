import { SetMetadata } from '@nestjs/common';

export const MODULE_KEY = 'required_module';

/**
 * Exige que o módulo (F4) esteja ATIVO para a empresa do usuário.
 * Ex.: @RequireModule('crm'). Avaliado pelo ModuleGuard, que roda após o
 * AuthGuard (precisa de req.user.tenantId). Compõe com @RequirePermission:
 * o módulo gateia por PLANO/contratação, a permissão por PAPEL.
 */
export const RequireModule = (code: string) => SetMetadata(MODULE_KEY, code);
