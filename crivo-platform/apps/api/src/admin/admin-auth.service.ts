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
}
