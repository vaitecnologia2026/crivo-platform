import { Injectable } from '@nestjs/common';
import { computeOperationalAlerts, type AlertsSnapshot, type OperationalAlertsResult } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Notificações & Travas operacionais (Fase 3 — §12). O sistema CONDUZ a operação:
 * lê o estado do plano de ação do tenant e deriva alertas (ação atrasada, evidência
 * pendente, baixa adesão) + travas críticas (sem prazo/responsável/evidência, plano
 * não validado = dossiê bloqueado). Não substitui decisão humana — sinaliza.
 */
@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<OperationalAlertsResult> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const plans = await tx.actionPlan.findMany({
        select: {
          title: true,
          validatedAt: true,
          items: {
            select: { action: true, status: true, dueDate: true, expectedEvidence: true, responsible: true },
          },
        },
      });

      const snapshot: AlertsSnapshot = { campaigns: [], actionItems: [], unvalidatedPlans: [] };
      for (const p of plans) {
        if (!p.validatedAt && p.items.length > 0) {
          snapshot.unvalidatedPlans.push({ title: p.title, itemCount: p.items.length });
        }
        for (const it of p.items) {
          snapshot.actionItems.push({
            title: it.action,
            status: it.status,
            dueDateMs: it.dueDate ? it.dueDate.getTime() : null,
            hasExpectedEvidence: !!it.expectedEvidence?.trim(),
            hasResponsible: !!it.responsible?.trim(),
          });
        }
      }

      return computeOperationalAlerts(snapshot, Date.now());
    });
  }
}
