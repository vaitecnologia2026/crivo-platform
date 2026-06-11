import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import type { PlatformAdmin, PlatformLoginResponse } from '@crivo/types';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<PlatformLoginResponse> {
    // Super admins vivem no control plane → conexão owner (bypass RLS).
    const admin = await this.prisma.admin.superAdmin.findFirst({
      where: { email: email.toLowerCase().trim(), active: true },
    });

    // Comparação em tempo constante; mesmo erro p/ inexistente (anti-enumeração).
    const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
    if (!admin || !ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const session: PlatformAdmin = { id: admin.id, email: admin.email, name: admin.name };

    // scope 'platform' distingue do token de tenant — sem tenantId, nunca
    // recebe app.tenant, nunca atravessa para o data plane de uma empresa.
    const token = await this.jwt.signAsync({
      sub: admin.id,
      scope: 'platform',
      email: admin.email,
      name: admin.name,
    });

    await this.audit.record({
      action: 'admin.login',
      actor: { id: admin.id, email: admin.email },
    });

    return { token, admin: session };
  }

  /** Troca a própria senha do super admin (exige a senha atual). */
  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const admin = await this.prisma.admin.superAdmin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.active) throw new UnauthorizedException('Sessão inválida');

    const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Senha atual incorreta');

    await this.prisma.admin.superAdmin.update({
      where: { id: adminId },
      data: { passwordHash: bcrypt.hashSync(newPassword, 10) },
    });
    await this.audit.record({
      action: 'admin.password.change',
      actor: { id: admin.id, email: admin.email },
    });
    return { ok: true };
  }
}
