import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginResponse, SessionUser } from '@crivo/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    // Login é cross-tenant por e-mail → usa a conexão owner (bypass RLS).
    // Em produção, o tenant vem do subdomínio/seleção e a busca é escopada.
    const user = await this.prisma.admin.user.findFirst({
      where: { email: email.toLowerCase().trim(), active: true },
    });

    // bcrypt.compare em tempo constante; mesmo erro p/ usuário inexistente (anti-enumeração).
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !ok) {
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
