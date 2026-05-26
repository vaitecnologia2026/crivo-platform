import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginResponse, SessionUser } from '@crivo/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // F0: SHA-256 (igual ao seed). PRODUÇÃO: trocar por argon2id/bcrypt. TODO(F0->F1).
  private hash(plain: string): string {
    return createHash('sha256').update(plain).digest('hex');
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    // Login é cross-tenant por e-mail → usa a conexão owner (bypass RLS).
    // Em produção, o tenant vem do subdomínio/seleção e a busca é escopada.
    const user = await this.prisma.admin.user.findFirst({
      where: { email: email.toLowerCase().trim(), active: true },
    });

    if (!user || user.passwordHash !== this.hash(password)) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const session: SessionUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as SessionUser['role'],
    };

    const token = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    return { token, user: session };
  }
}
