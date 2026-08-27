import { describe, expect, it, vi } from 'vitest';
import type { PsychosocialRiskMatrixRow } from '@crivo/types';
import { ActionPlansService } from './action-plans.service';
import { RiskSuggestionsService, suggestionKeyOf } from './risk-suggestions.service';

/**
 * A matriz 5×5 decide QUAIS fatores exigem plano (R = P × S ≥ 10, NR-1 §8.4).
 * Estes testes protegem as três regras que, se quebrarem, produzem dano real:
 * plano obrigatório sendo ignorado, ação repetida, e — a mais importante — a
 * régua 5×5 vazando para os campos da matriz 3×3 preenchida pela empresa.
 */

/** Linha da matriz com o mínimo que o gerador consome. */
function row(
  over: Partial<PsychosocialRiskMatrixRow> & { probability: number; severity: number },
): PsychosocialRiskMatrixRow {
  const risk = over.probability * over.severity;
  const riskClass =
    risk <= 4 ? 'BAIXO' : risk <= 9 ? 'MODERADO' : risk <= 15 ? 'ALTO' : risk <= 20 ? 'MUITO_ALTO' : 'CRITICO';
  return {
    slug: 'fator',
    label: 'Fator',
    sourceSlug: 'demandas',
    criticalCount: 3,
    respondents: 10,
    percentCritical: 30,
    exposureAvg: 3.5,
    highExposureCount: 2,
    probabilitySource: 'perguntas',
    riskClass,
    actionLabel: 'Corrigir',
    planRequired: risk >= 10,
    risk,
    ...over,
  } as PsychosocialRiskMatrixRow;
}

function build(matrix: PsychosocialRiskMatrixRow[], aiEnabled = false) {
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ actionItem: { findMany: vi.fn(async () => []) } }),
    ),
    admin: { aiCustomPrompt: { findFirst: vi.fn(async () => null) } },
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
    get: vi.fn(async () => ({ enabled: aiEnabled, enabledModules: ['relatorios'] })),
    chat: vi.fn(async () => ({ ok: false as const, kind: 'no_key' as const })),
  };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const svc = new RiskSuggestionsService(prisma as any, psychosocial as any, aiSettings as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { svc, prisma, psychosocial, aiSettings };
}

describe('RiskSuggestionsService', () => {
  it('gera ação SÓ para o fator cujo risco torna o plano obrigatório', async () => {
    const { svc } = build([
      row({ slug: 'sobrecarga', label: 'Sobrecarga', sourceSlug: 'demandas', probability: 4, severity: 4 }), // 16
      row({ slug: 'autonomia', label: 'Autonomia', sourceSlug: 'controle', probability: 3, severity: 3 }), // 9 → fora
    ]);
    const out = await svc.list('t1');
    expect(new Set(out.suggestions.map((s) => s.factorSlug))).toEqual(new Set(['sobrecarga']));
    expect(out.suggestions.every((s) => s.risk >= 10)).toBe(true);
  });

  it('risco 9 não gera e risco 10 gera (a fronteira da NR-1)', async () => {
    const nove = await build([row({ probability: 3, severity: 3 })]).svc.list('t1');
    expect(nove.suggestions).toHaveLength(0);
    expect(nove.reason).toContain('risco 10');

    const dez = await build([row({ probability: 2, severity: 5 })]).svc.list('t1');
    expect(dez.suggestions.length).toBeGreaterThan(0);
  });

  it('dois fatores da MESMA dimensão não repetem a mesma ação', async () => {
    const { svc } = build([
      row({ slug: 'sobrecarga', label: 'Sobrecarga', sourceSlug: 'demandas', probability: 5, severity: 4 }),
      row({ slug: 'ritmo', label: 'Ritmo', sourceSlug: 'demandas', probability: 4, severity: 3 }),
    ]);
    const out = await svc.list('t1');
    expect(new Set(out.suggestions.map((s) => s.key)).size).toBe(out.suggestions.length);
    // O fator de MAIOR risco reivindica as ações da dimensão.
    expect(out.suggestions.every((s) => s.factorSlug === 'sobrecarga')).toBe(true);
  });

  it('carrega o retrato do cálculo em cada sugestão', async () => {
    const { svc } = build([row({ slug: 'sobrecarga', label: 'Sobrecarga', probability: 4, severity: 4 })]);
    const [s] = (await svc.list('t1')).suggestions;
    expect(s.probability).toBe(4);
    expect(s.severity).toBe(4);
    expect(s.risk).toBe(16);
    expect(s.riskClass).toBe('MUITO_ALTO');
    expect(s.key).toBe(suggestionKeyOf('demandas', s.title));
  });

  it('cai na biblioteca quando a IA está desligada', async () => {
    const { svc, aiSettings } = build([row({ probability: 4, severity: 4 })]);
    const out = await svc.list('t1');
    expect(out.origin).toBe('biblioteca');
    expect(aiSettings.chat).not.toHaveBeenCalled();
  });

  it('explica em vez de listar vazio quando falta volume de respostas', async () => {
    const { svc, psychosocial } = build([]);
    psychosocial.results.mockResolvedValueOnce({
      minRespondents: 5,
      totalRespondents: 2,
      overall: { suppressed: true },
      sectors: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const out = await svc.list('t1');
    expect(out.suggestions).toHaveLength(0);
    expect(out.reason).toContain('mínimo');
  });

  it('fator sem dimensão conhecida não vira ação inventada', async () => {
    const { svc } = build([row({ slug: 'x', sourceSlug: 'dimensao-inexistente', probability: 4, severity: 4 })]);
    const out = await svc.list('t1');
    expect(out.suggestions).toHaveLength(0);
    expect(out.reason).toContain('biblioteca');
  });
});

describe('ActionPlansService.acceptRiskSuggestions', () => {
  /** Captura o `data` do create para inspecionar o que é gravado. */
  function buildAccept() {
    const created: Record<string, unknown>[] = [];
    const tx = {
      actionPlan: { findUnique: vi.fn(async () => ({ id: 'p1' })) },
      actionItem: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return {
            ...data,
            id: `i${created.length}`,
            status: 'SUGERIDA',
            reviewDate: null,
            createdAt: new Date(),
            evidences: [],
          };
        }),
      },
      actionItemHistory: { create: vi.fn(async () => ({})) },
    };
    const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const riskSuggestions = {
      list: vi.fn(async () => ({
        origin: 'biblioteca' as const,
        suggestions: [
          {
            key: 'demandas|Revisão de alocação',
            factorSlug: 'sobrecarga',
            factorLabel: 'Sobrecarga de trabalho',
            dimensionSlug: 'demandas',
            probability: 4,
            severity: 4,
            risk: 16,
            riskClass: 'MUITO_ALTO' as const,
            title: 'Revisão de alocação',
            prazo: 'Curto → Médio prazo',
            objetivo: 'Equilibrar volume',
            etapas: 'Levantamento; realocação',
            indicadores: 'Horas extras por área',
            alreadyInPlan: false,
          },
        ],
      })),
    };
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const svc = new ActionPlansService(prisma as any, riskSuggestions as any);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return { svc, created, tx, riskSuggestions };
  }

  it('NÃO preenche severity/probability da matriz 3x3 (as réguas não se derivam)', async () => {
    const { svc, created } = buildAccept();
    await svc.acceptRiskSuggestions('t1', 'p1', ['demandas|Revisão de alocação'], 'RH');
    expect(created).toHaveLength(1);
    expect(created[0].severity).toBeUndefined();
    expect(created[0].probability).toBeUndefined();
    expect(created[0].riskLevel).toBeUndefined();
  });

  it('grava o retrato do cálculo e a chave de idempotência', async () => {
    const { svc, created } = buildAccept();
    await svc.acceptRiskSuggestions('t1', 'p1', ['demandas|Revisão de alocação'], 'RH');
    expect(created[0].riskFactorSlug).toBe('sobrecarga');
    expect(created[0].riskProbability).toBe(4);
    expect(created[0].riskSeverity).toBe(4);
    expect(created[0].suggestionKey).toBe('demandas|Revisão de alocação');
    expect(created[0].sourceInstrumentSlug).toBe('PSYCHOSOCIAL');
  });

  it('preserva as etapas na ação e o indicador no campo próprio', async () => {
    const { svc, created } = buildAccept();
    await svc.acceptRiskSuggestions('t1', 'p1', ['demandas|Revisão de alocação'], 'RH');
    expect(created[0].action).toContain('Revisão de alocação');
    expect(created[0].action).toContain('Levantamento; realocação');
    expect(created[0].indicator).toBe('Horas extras por área');
  });

  it('registra na trilha por que a ação existe', async () => {
    const { svc, tx } = buildAccept();
    await svc.acceptRiskSuggestions('t1', 'p1', ['demandas|Revisão de alocação'], 'RH');
    const call = tx.actionItemHistory.create.mock.calls[0] as unknown as [{ data: { change: string } }];
    const change = call[0].data.change;
    expect(change).toContain('matriz de risco');
    expect(change).toContain('P4 × S4 = 16');
  });

  it('recusa aceitar o que já está no plano', async () => {
    const { svc, riskSuggestions } = buildAccept();
    riskSuggestions.list.mockResolvedValueOnce({
      origin: 'biblioteca' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      suggestions: [{ key: 'demandas|Revisão de alocação', alreadyInPlan: true } as any],
    });
    await expect(
      svc.acceptRiskSuggestions('t1', 'p1', ['demandas|Revisão de alocação'], 'RH'),
    ).rejects.toThrow(/já estão no plano/);
  });

  it('recusa lista vazia', async () => {
    const { svc } = buildAccept();
    await expect(svc.acceptRiskSuggestions('t1', 'p1', [], 'RH')).rejects.toThrow(/ao menos uma/);
  });
});
