import { describe, expect, it, vi } from 'vitest';
import type { PsychosocialRiskMatrixRow } from '@crivo/types';
import { resolveActionPlans } from './psychosocial-action-plans';

// Homologação 21/09: "está gerando praticamente 1 ação para cada situação …
// avaliaria a necessidade real de gerar 12 ações ou consolidar em menos". O
// prompt pedia "de 2 a 3 ações" por fator — um piso que a IA enchia. Agora a
// quantidade é TETO pela classificação (Muito alto ≤ 2, Alto = 1) e a IA lê o
// rótulo humano da classificação, não o código do enum.

function linha(over: Partial<PsychosocialRiskMatrixRow>): PsychosocialRiskMatrixRow {
  return {
    slug: 'fator-1',
    label: 'Sobrecarga de trabalho',
    probability: 5,
    severity: 4,
    risk: 20,
    riskClass: 'MUITO_ALTO',
    planRequired: true,
    exposureAvg: 4.4,
    exposureCount: 10,
    highExposureCount: 8,
    respondents: 10,
    ...over,
  } as PsychosocialRiskMatrixRow;
}

function deps(chat: ReturnType<typeof vi.fn>) {
  const admin = {
    aiCustomPrompt: { findFirst: vi.fn(async () => null) },
    factorActionPlan: { findMany: vi.fn(async () => []), upsert: vi.fn(async () => ({})) },
    organization: { findUnique: vi.fn(async () => null) },
  };
  const aiSettings = {
    get: vi.fn(async () => ({ enabled: true, enabledModules: ['relatorios'] })),
    chat,
  };
  return { prisma: { admin } as never, aiSettings: aiSettings as never };
}

describe('teto de ações por fator no prompt da IA', () => {
  it('pede TETO pela classificação, nunca 3, e envia o rótulo humano da classificação', async () => {
    const chat = vi.fn(async () => ({
      ok: true,
      content: JSON.stringify({
        planos: {
          'fator-1': {
            descricao: 'd',
            objetivo: 'o',
            acoes: [{ titulo: 'a', nivel: 'Organizacional', prazo: 'Curto prazo', objetivo: 'x', etapas: 'y', indicadores: 'z' }],
          },
        },
      }),
    }));
    await resolveActionPlans(deps(chat), 'org-1', [linha({})], 'diagnostico-essencial', 1000);

    expect(chat).toHaveBeenCalledTimes(1);
    const req = (chat.mock.calls as unknown as [{ messages: { role: string; content: string }[] }][])[0][0];
    const user = req.messages.find((m) => m.role === 'user')!.content;

    expect(user).toContain('TETO pela classificação');
    expect(user).toContain('"Muito alto" ou "Crítico" → no máximo 2');
    expect(user).toContain('"Alto" → 1 ação');
    expect(user).toContain('Nunca 3');
    expect(user).not.toContain('2 a 3 ações');
    // O código do enum não diz nada à IA; a régua é escrita com o rótulo.
    expect(user).toContain('Classificação: Muito alto / Prioridade imediata');
    expect(user).not.toContain('Classificação: MUITO_ALTO');
  });

  it('uma ação só é aceita pelo parser (o teto de 1 para "Alto" não cai na biblioteca)', async () => {
    const chat = vi.fn(async () => ({
      ok: true,
      content: JSON.stringify({
        planos: {
          'fator-2': {
            descricao: 'd',
            objetivo: 'o',
            acoes: [{ titulo: 'Redistribuir demandas por fila única', nivel: 'Organizacional', prazo: 'Curto prazo', objetivo: 'x', etapas: 'y', indicadores: 'z' }],
          },
        },
      }),
    }));
    const r = await resolveActionPlans(
      deps(chat),
      'org-1',
      [linha({ slug: 'fator-2', label: 'Demandas simultâneas', probability: 5, severity: 3, risk: 15, riskClass: 'ALTO' })],
      'diagnostico-essencial',
      1000,
    );
    expect(r.origin).toBe('IA');
    expect(r.plans['fator-2'].acoes).toHaveLength(1);
    expect(r.plans['fator-2'].acoes[0].nivel).toBe('Organizacional');
  });
});
