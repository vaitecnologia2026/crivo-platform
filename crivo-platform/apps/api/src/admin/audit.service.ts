import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditActor {
  id?: string;
  email?: string;
}

export interface AuditEntry {
  action: string; // ex.: tenant.provision, tenant.suspend, admin.login
  actor?: AuditActor;
  target?: string; // id/slug do alvo
  tenantId?: string; // null/undefined = ação global de super admin
  meta?: Record<string, unknown>;
}

/**
 * Trilha de auditoria das ações de plataforma (control plane). Escreve via
 * conexão owner (audit_log é owner-only). Best-effort: uma falha de auditoria
 * NUNCA derruba a operação de negócio — apenas registra um warning.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.admin.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actor?.id,
          actorEmail: entry.actor?.email,
          target: entry.target,
          tenantId: entry.tenantId,
          meta: entry.meta as object | undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao registrar auditoria (${entry.action}): ${String(err)}`);
    }
  }
}
