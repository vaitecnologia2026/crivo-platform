import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionGuard } from './guards/permission.guard';
import { ModuleGuard } from './guards/module.guard';
import { PermissionService } from './permission.service';
import { ModuleService } from './module.service';
import { TenantRolesController } from './tenant-roles.controller';
import { TenantRolesService } from './tenant-roles.service';

@Module({
  imports: [
    // registerAsync + factory: o secret é lido em runtime (após ConfigModule) e
    // VALIDADO. Sem AUTH_SECRET forte, o boot falha em vez de cair para um
    // segredo público (que permitiria forjar tokens admin).
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.AUTH_SECRET;
        if (!secret || secret.length < 32) {
          throw new Error(
            'AUTH_SECRET ausente ou fraco (mínimo 32 caracteres). Configure-o no ambiente.',
          );
        }
        return {
          secret,
          signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController, MeController, TenantRolesController],
  providers: [
    AuthService,
    AuthGuard,
    RolesGuard,
    PermissionGuard,
    ModuleGuard,
    PermissionService,
    ModuleService,
    TenantRolesService,
  ],
  exports: [
    AuthService,
    AuthGuard,
    RolesGuard,
    PermissionGuard,
    ModuleGuard,
    PermissionService,
    ModuleService,
  ],
})
export class IamModule {}
