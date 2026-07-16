import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { CRIVO_TEAM_ROLES, CRIVO_TEAM_TOPIC } from './triggers';

/**
 * Tokens FCM por usuário/dispositivo. Tabela control-plane (owner-only): gravada
 * e lida SEMPRE via prisma.admin, filtrando por tenantId/userId no app.
 */
@Injectable()
export class PushTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  /** Registra (ou atualiza) o token do dispositivo do usuário logado. */
  async register(
    user: { id: string; tenantId: string; role: string },
    input: { token: string; platform: string },
  ): Promise<{ ok: true }> {
    const token = input.token.trim();
    if (!token) return { ok: true };

    await this.prisma.admin.pushToken.upsert({
      where: { token },
      create: {
        token,
        platform: input.platform,
        userId: user.id,
        tenantId: user.tenantId,
      },
      update: {
        platform: input.platform,
        userId: user.id,
        tenantId: user.tenantId,
        lastSeenAt: new Date(),
      },
    });

    // Papéis internos (equipe CRIVO) assinam o tópico de alertas.
    if (CRIVO_TEAM_ROLES.has(user.role)) {
      await this.fcm.subscribeToTopic([token], CRIVO_TEAM_TOPIC);
    }
    return { ok: true };
  }

  /** Remove um token (logout / desinstalação). */
  async remove(user: { id: string }, token: string): Promise<{ ok: true }> {
    await this.prisma.admin.pushToken.deleteMany({
      where: { token: token.trim(), userId: user.id },
    });
    return { ok: true };
  }

  /** Tokens de um conjunto de usuários (audiência 'users'). */
  async tokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.prisma.admin.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  /** Remove tokens inválidos devolvidos pelo FCM. */
  async pruneInvalid(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.prisma.admin.pushToken.deleteMany({ where: { token: { in: tokens } } });
  }

  /** Diagnóstico: total de tokens registrados e a contagem por plataforma. */
  async stats(): Promise<{ total: number; byPlatform: Record<string, number> }> {
    const grouped = await this.prisma.admin.pushToken.groupBy({
      by: ['platform'],
      _count: { _all: true },
    });
    const byPlatform: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      const n = g._count._all;
      byPlatform[g.platform] = n;
      total += n;
    }
    return { total, byPlatform };
  }
}
