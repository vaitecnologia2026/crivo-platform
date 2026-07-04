import { Injectable } from '@nestjs/common';
import { aggregateBenchmarks, porteBandOf, type BenchmarkRecord } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type Actor = { id: string; email: string };

function parseHeadcount(range?: string | null): number | null {
  if (!range) return null;
  const m = range.replace(/\./g, '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Base CRIVO / Benchmarks (Fase 5 — §11). Agrega, ENTRE as empresas-cliente, os
 * indicadores (People Analytics + pré-diagnóstico) por PORTE, anonimizado e com
 * SUPRESSÃO por volume mínimo. Lê os dados de cada tenant via forTenant (respeita
 * o RLS); a saída é só média agregada (nenhuma empresa identificável). Acesso
 * é registrado em auditoria (controle de finalidade §11). Super admin.
 */
@Injectable()
export class BenchmarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async compute(actor: Actor) {
    // Tela 09: só entram na base as empresas que AUTORIZARAM o uso no benchmark
    // (opt-in). Sem autorização registrada, o dado da empresa não é agregado.
    const consented = await this.prisma.admin.tenant.findMany({
      where: { consentBenchmark: true },
      select: { id: true },
    });
    const okIds = new Set(consented.map((t) => t.id));

    const allConverted = await this.prisma.admin.platformLead.findMany({
      where: { convertedTenantId: { not: null } },
      select: { convertedTenantId: true, employeesCount: true, diagnosticScore: true },
    });
    const leads = allConverted.filter((l) => okIds.has(l.convertedTenantId as string));

    const records: BenchmarkRecord[] = [];
    for (const l of leads) {
      const tid = l.convertedTenantId as string;
      let people: Record<string, number | null> = {};
      let headcount = parseHeadcount(l.employeesCount);
      try {
        const row = await this.prisma.forTenant(tid, async (tx) =>
          tx.peopleAnalyticsData.findUnique({ where: { tenantId: tid } }),
        );
        const periods = (row?.periods as { period: string; headcount?: number | null; values?: Record<string, number | null> }[]) ?? [];
        if (periods.length) {
          const last = [...periods].sort((a, b) => String(a.period).localeCompare(String(b.period)))[periods.length - 1];
          people = last?.values ?? {};
          if (last?.headcount != null) headcount = Number(last.headcount);
        }
      } catch {
        /* tenant sem dados — ignora */
      }
      const indicators: Record<string, number | null> = { ...people };
      if (l.diagnosticScore != null) indicators.diagnostico = l.diagnosticScore;
      records.push({ group: porteBandOf(headcount) ?? 'Porte não informado', indicators });
    }

    const result = aggregateBenchmarks(records, 3);
    await this.audit.record({
      action: 'benchmarks.view',
      actor,
      target: 'base-crivo',
      meta: { companies: records.length, consented: okIds.size, converted: allConverted.length },
    });
    // totalCompanies = empresas que autorizaram (entram na base); consented = idem.
    return { ...result, totalCompanies: leads.length, consentedCompanies: okIds.size, convertedCompanies: allConverted.length };
  }
}
