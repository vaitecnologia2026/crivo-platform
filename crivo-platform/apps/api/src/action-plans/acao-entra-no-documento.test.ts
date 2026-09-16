import { describe, expect, it, vi } from 'vitest';
import { acaoEntraNoDocumento } from './documents.service';
import { RiskSuggestionsService } from './risk-suggestions.service';
import type { PsychosocialRiskMatrixRow } from '@crivo/types';

// Ajustes Finais de Homologação: "somente ações aprovadas no Plano entram no
// Dossiê" e "ações descartadas não entram no Dossiê". O mesmo critério vale para
// o modelo importado ({{plano_acao}}), que imprimia TODAS as ações com o status.
describe('acaoEntraNoDocumento', () => {
  it('aprovada e o que veio depois dela entram', () => {
    for (const s of ['APROVADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'REAVALIADA']) {
      expect(acaoEntraNoDocumento(s)).toBe(true);
    }
  });
  it('sugestão pendente e descartada ficam fora', () => {
    for (const s of ['SUGERIDA', 'EM_REVISAO', 'NAO_ADOTADA', '']) {
      expect(acaoEntraNoDocumento(s)).toBe(false);
    }
  });
});

// "Objetivo da medida" saía "—" em toda ação do Dossiê emitido na homologação:
// o caminho que gera as ações ao abrir o Plano gravava o indicador mas
// descartava o objetivo escrito pela IA.
describe('RiskSuggestionsService.gerarPlanoAutomatico', () => {
  it('grava o objetivo da sugestão na ação criada', async () => {
    const matrix: PsychosocialRiskMatrixRow[] = [
      {
        slug: 'sobrecarga',
        label: 'Sobrecarga',
        sourceSlug: 'demandas',
        probability: 4,
        severity: 4,
        exposureAvg: 3.6,
        highExposureCount: 2,
        probabilitySource: 'perguntas',
        riskClass: 'MUITO_ALTO',
        actionLabel: 'Mitigar',
        planRequired: true,
        risk: 16,
      } as PsychosocialRiskMatrixRow,
    ];
    const criadas: Record<string, unknown>[] = [];
    const tx = {
      actionItem: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          criadas.push(data);
          return { id: 'i1', ...data };
        }),
      },
      actionItemHistory: { create: vi.fn(async () => ({})) },
      actionPlan: {
        findFirst: vi.fn(async () => ({ id: 'p1' })),
        create: vi.fn(async () => ({ id: 'p1' })),
      },
      diagnosticCycle: { findFirst: vi.fn(async () => null) },
    };
    const prisma = {
      forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      admin: {
        aiCustomPrompt: { findFirst: vi.fn(async () => null) },
        contract: { findFirst: vi.fn(async () => null) },
        tenant: { findFirst: vi.fn(async () => null) },
        product: { findUnique: vi.fn(async () => null) },
        diagnosticInstrument: { findFirst: vi.fn(async () => null) },
        factorActionPlan: { findMany: vi.fn(async () => []) },
      },
    };
    const psychosocial = {
      results: vi.fn(async () => ({
        minRespondents: 5,
        totalRespondents: 10,
        overall: { suppressed: false, riskMatrix: matrix },
        sectors: [],
      })),
    };
    const aiSettings = {
      get: vi.fn(async () => ({ enabled: false, enabledModules: ['relatorios'] })),
      chat: vi.fn(async () => ({ ok: false as const, kind: 'no_key' as const })),
    };
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const svc = new RiskSuggestionsService(prisma as any, psychosocial as any, aiSettings as any);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const n = await svc.gerarPlanoAutomatico('t1');

    expect(n).toBeGreaterThan(0);
    expect(criadas.length).toBe(n);
    for (const c of criadas) {
      expect(typeof c.objective).toBe('string');
      expect((c.objective as string).length).toBeGreaterThan(0);
      expect(typeof c.indicator).toBe('string');
    }
  });
});
