import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { resolveInstrumentForTenant, usesPsychosocialEngine } from '../admin/methodology.service';

/** Instrumento aplicado quando a empresa não tem contrato/produto resolvível. */
const FALLBACK = 'PRE_DIAGNOSTIC';

export type PortalDashboardEngine = 'PSYCHOSOCIAL' | 'DIAGNOSTICS';

export interface PortalDashboardDiagnostic {
  /** Motor que grava e lê as respostas deste diagnóstico. */
  engine: PortalDashboardEngine;
  instrumentSlug: string;
  /** Nome do diagnóstico no catálogo do Motor (null = instrumento não cadastrado). */
  instrumentName: string | null;
  /** Agregado das respostas. `null` no motor psicossocial — ver abaixo. */
  aggregate: Awaited<ReturnType<DiagnosticsService['results']>> | null;
}

/**
 * Read model da Visão Geral: o resultado do diagnóstico que a empresa
 * CONTRATOU.
 *
 * O defeito que isto corrige: o dashboard só sabia ler `/psychosocial/results`.
 * Quem contratou o Essencial coleta para `diagnostic_responses` (a escolha da
 * tabela é feita em `collaborators.service` pelo mesmo `usesPsychosocialEngine`
 * usado aqui), então a empresa juntava respostas e a Visão Geral não mostrava
 * nada — e a única tela de resultado que existia era a do NR-1, que lê a tabela
 * do outro motor e por isso dizia "Ainda não há respostas".
 *
 * Por que o motor psicossocial não devolve agregado: a Visão Geral já tem o card
 * "Fatores Psicossociais" alimentado por `/psychosocial/results`. Devolver o
 * mesmo dado aqui faria o número aparecer duas vezes na mesma tela. O campo
 * `engine` existe justamente para o front saber que aquele card é o dono.
 */
@Injectable()
export class PortalDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnostics: DiagnosticsService,
  ) {}

  async diagnostic(tenantId: string): Promise<PortalDashboardDiagnostic> {
    const instrumentSlug = (await resolveInstrumentForTenant(this.prisma, tenantId)) ?? FALLBACK;
    const psicossocial = await usesPsychosocialEngine(this.prisma, instrumentSlug);
    // rls-allow: DiagnosticInstrument é catálogo GLOBAL (control-plane), sem tenantId.
    const inst = await this.prisma.admin.diagnosticInstrument.findFirst({
      where: { slug: instrumentSlug },
      select: { name: true },
    });

    return {
      engine: psicossocial ? 'PSYCHOSOCIAL' : 'DIAGNOSTICS',
      instrumentSlug,
      instrumentName: inst?.name ?? null,
      // A supressão por volume mínimo é do próprio DiagnosticsService.results —
      // abaixo do piso nenhum número sai do servidor.
      aggregate: psicossocial ? null : await this.diagnostics.results(tenantId, instrumentSlug),
    };
  }
}
