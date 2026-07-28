import { BadRequestException, Injectable } from '@nestjs/common';
import type { DiagnosticCycleData } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';

/**
 * F4 — CICLOS FORMAIS de diagnóstico (definição do cliente 27/07: "ciclo =
 * aplicação formal aberta e encerrada"). A empresa abre um ciclo, aplica o
 * diagnóstico/plano no período e ENCERRA — o encerramento congela o snapshot
 * (DocumentsService.cycleSnapshot) que alimenta o comparativo do TPL-003.
 * Um ciclo encerrado é imutável: não reabre nem recalcula.
 */
@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  private toData(c: {
    id: string; label: string; status: string; openedAt: Date; openedBy: string | null;
    closedAt: Date | null; closedBy: string | null; method: string | null;
    methodologyVersion: string | null; snapshot: unknown;
  }): DiagnosticCycleData {
    const factors = (c.snapshot as { factors?: unknown[] } | null)?.factors;
    return {
      id: c.id,
      label: c.label,
      status: c.status as DiagnosticCycleData['status'],
      openedAt: c.openedAt.toISOString(),
      openedBy: c.openedBy,
      closedAt: c.closedAt?.toISOString() ?? null,
      closedBy: c.closedBy,
      method: c.method,
      methodologyVersion: c.methodologyVersion,
      factorsCount: Array.isArray(factors) ? factors.length : null,
    };
  }

  async list(tenantId: string): Promise<DiagnosticCycleData[]> {
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.diagnosticCycle.findMany({ orderBy: [{ openedAt: 'desc' }, { id: 'desc' }] }),
    );
    return rows.map((c) => this.toData(c));
  }

  /** Abre um ciclo novo. Só UM ciclo aberto por vez — encerre o vigente antes. */
  async open(tenantId: string, label: string | undefined, actor: string): Promise<DiagnosticCycleData> {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        const aberto = await tx.diagnosticCycle.findFirst({ where: { status: 'ABERTO' } });
        if (aberto) {
          throw new BadRequestException(
            `Já existe um ciclo aberto ("${aberto.label}") — encerre-o antes de abrir outro.`,
          );
        }
        const total = await tx.diagnosticCycle.count();
        const clean = label?.trim().slice(0, 120);
        const row = await tx.diagnosticCycle.create({
          data: { tenantId, label: clean || `Ciclo ${total + 1}`, openedBy: actor },
        });
        return this.toData(row);
      });
    } catch (e) {
      // Corrida entre dois POSTs: o índice único parcial (tenantId WHERE
      // status='ABERTO') barra o segundo — mesma mensagem do check de leitura.
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Já existe um ciclo aberto — encerre-o antes de abrir outro.');
      }
      throw e;
    }
  }

  /**
   * ENCERRA o ciclo: congela o snapshot (fatores + risco derivado + evidências
   * + psicossocial da janela do ciclo). Irreversível — base do TPL-003.
   */
  async close(tenantId: string, id: string, actor: string): Promise<DiagnosticCycleData> {
    const cycle = await this.prisma.forTenant(tenantId, (tx) =>
      tx.diagnosticCycle.findUnique({ where: { id } }),
    );
    if (!cycle) throw new BadRequestException('Ciclo não encontrado.');
    if (cycle.status !== 'ABERTO') throw new BadRequestException('Este ciclo já está encerrado.');

    const closedAt = new Date();
    const snap = await this.documents.cycleSnapshot(tenantId, cycle.openedAt, closedAt);
    if (snap.snapshot.factors.length === 0) {
      throw new BadRequestException(
        'Encerramento bloqueado — o Plano de Evolução não tem fatores/ações registrados. ' +
          'O ciclo encerrado congela os fatores para o comparativo do Relatório de Evolução; ' +
          'sem fatores não há o que comparar.',
      );
    }
    // Compare-and-set NO BANCO: só grava se o ciclo AINDA estiver ABERTO.
    // Sem isto, dois encerramentos concorrentes (duas abas) sobrescreveriam o
    // snapshot já congelado — quebrando a imutabilidade que o TPL-003 assume.
    const row = await this.prisma.forTenant(tenantId, async (tx) => {
      const { count } = await tx.diagnosticCycle.updateMany({
        where: { id, status: 'ABERTO' },
        data: {
          status: 'ENCERRADO',
          closedAt,
          closedBy: actor,
          method: snap.method,
          methodologyVersion: snap.methodologyVersion,
          snapshot: snap.snapshot as object,
        },
      });
      if (count === 0) throw new BadRequestException('Este ciclo já está encerrado.');
      return tx.diagnosticCycle.findUnique({ where: { id } });
    });
    return this.toData(row!);
  }
}
