import { SetMetadata } from '@nestjs/common';
import type { Role } from '@crivo/types';

export const ROLES_KEY = 'roles';

/** Restringe um handler/controller a papéis específicos. Ex: @Roles('CEO','RH') */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
