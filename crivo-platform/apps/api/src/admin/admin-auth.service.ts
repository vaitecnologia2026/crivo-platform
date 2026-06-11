import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import type { MfaSetupResponse, PlatformAdmin, PlatformLoginResponse } from '@crivo/types';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, totp?: string): Promise<PlatformLoginResponse> {
    // Super admins vivem no control plane → conexão owner (bypass RLS).
    const admin = await this.prisma.admin.superAdmin.findFirst({
      where: { email: email.toLowerCase().trim(), active: true },
    });

    // Comparação em tempo constante; mesmo erro p/ inexistente (anti-enumeração).
    const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
    if (!admin || !ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // MFA (F2): se habilitado, exige um código TOTP válido. Verificado só após
    // a senha conferir (não vaza se a conta tem MFA antes de autenticar a senha).
    if (admin.totpEnabled && admin.totpSecret) {
      if (!totp) throw new UnauthorizedException('Código MFA obrigatório');
      if (!authenticator.verify({ token: totp, secret: admin.totpSecret })) {
        throw new UnauthorizedException('Código MFA inválido');
      }
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

  /** Inicia o setup de MFA: gera um segredo (pendente) e devolve o otpauth URI. */
  async setupMfa(adminId: string): Promise<MfaSetupResponse> {
    const admin = await this.prisma.admin.superAdmin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.active) throw new UnauthorizedException('Sessão inválida');

    const secret = authenticator.generateSecret();
    // Armazena como pendente (totpEnabled segue false até confirmar com um código).
    await this.prisma.admin.superAdmin.update({
      where: { id: adminId },
      data: { totpSecret: secret, totpEnabled: false },
    });
    const otpauthUrl = authenticator.keyuri(admin.email, 'CRIVO Platform', secret);
    return { secret, otpauthUrl };
  }

  /** Confirma e ativa o MFA validando um código do segredo pendente. */
  async enableMfa(adminId: string, code: string): Promise<{ ok: true }> {
    const admin = await this.prisma.admin.superAdmin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.active) throw new UnauthorizedException('Sessão inválida');
    if (!admin.totpSecret) throw new BadRequestException('Inicie o setup de MFA primeiro');
    if (!authenticator.verify({ token: code, secret: admin.totpSecret })) {
      throw new UnauthorizedException('Código MFA inválido');
    }
    await this.prisma.admin.superAdmin.update({
      where: { id: adminId },
      data: { totpEnabled: true },
    });
    await this.audit.record({ action: 'admin.mfa.enable', actor: { id: admin.id, email: admin.email } });
    return { ok: true };
  }

  /** Desativa o MFA (exige um código válido do TOTP ativo). */
  async disableMfa(adminId: string, code: string): Promise<{ ok: true }> {
    const admin = await this.prisma.admin.superAdmin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.active) throw new UnauthorizedException('Sessão inválida');
    if (!admin.totpEnabled || !admin.totpSecret) throw new BadRequestException('MFA não está ativo');
    if (!authenticator.verify({ token: code, secret: admin.totpSecret })) {
      throw new UnauthorizedException('Código MFA inválido');
    }
    await this.prisma.admin.superAdmin.update({
      where: { id: adminId },
      data: { totpEnabled: false, totpSecret: null },
    });
    await this.audit.record({ action: 'admin.mfa.disable', actor: { id: admin.id, email: admin.email } });
    return { ok: true };
  }
}
