import { describe, expect, it, vi } from 'vitest';
import type { PsychosocialRiskMatrixRow } from '@crivo/types';
import {
  findActiveCustomPromptForInstrument,
  normalizeInstrumentSlugs,
} from './ai-custom-prompts.service';
import { resolveActionPlans } from '../action-plans/psychosocial-action-plans';

/**
 * Um prompt da IA da Plataforma pode atender MAIS DE UM diagnóstico — a mesma
 * política valendo para o Essencial e para o Organizacional. Estes testes
 * protegem as duas coisas que, se quebrarem, deixam o vínculo decorativo: a
 * normalização da lista e a resolução do prompt pelo diagnóstico EM JOGO (antes
 * a consulta tinha 'PSYCHOSOCIAL' cravado no código).
 */

describe('normalizeInstrumentSlugs', () => {
  it('limpa espaços, vazios e repetições preservando a ordem escolhida', () => {
    expect(normalizeInstrumentSlugs([' PSYCHOSOCIAL ', '', 'essencial', 'PSYCHOSOCIAL'])).toEqual([
      'PSYCHOSOCIAL',
      'essencial',
    ]);
  });

  it('ignora o que não é string e o que não é lista', () => {
    expect(normalizeInstrumentSlugs([1, null, 'essencial'])).toEqual(['essencial']);
    expect(normalizeInstrumentSlugs('PSYCHOSOCIAL')).toEqual([]);
    expect(normalizeInstrumentSlugs(undefined)).toEqual([]);
  });

  it('para no teto de 10 diagnósticos', () => {
    const muitos = Array.from({ length: 15 }, (_, i) => `slug-${i}`);
    expect(normalizeInstrumentSlugs(muitos)).toHaveLength(10);
  });
});

type FindFirstArgs = {
  where: { active: boolean; OR: unknown[] };
  orderBy: { updatedAt: string };
};

const ROW = {
  name: 'Política de diagnósticos',
  body: 'corpo do prompt',
  files: [{ filename: 'orientacao.pdf', extractedText: 'texto de referência' }],
};

function prismaWith(row: unknown, fail = false) {
  const findFirst = vi.fn(async (_args: FindFirstArgs) => {
    if (fail) throw new Error('banco fora');
    return row;
  });
  return { prisma: { admin: { aiCustomPrompt: { findFirst } } }, findFirst };
}

describe('findActiveCustomPromptForInstrument', () => {
  it('procura só o ATIVO, pela lista nova E pela coluna antiga', async () => {
    const { prisma, findFirst } = prismaWith(ROW);
    await findActiveCustomPromptForInstrument(prisma as never, 'essencial');

    const args = findFirst.mock.calls[0][0];
    expect(args.where.active).toBe(true);
    // O OR é o que faz um prompt antigo (vínculo só na coluna singular) seguir
    // valendo depois da migration.
    expect(args.where.OR).toEqual([
      { instrumentSlugs: { has: 'essencial' } },
      { instrumentSlug: 'essencial' },
    ]);
    expect(args.orderBy).toEqual({ updatedAt: 'desc' });
  });

  it('devolve corpo e material de referência do prompt encontrado', async () => {
    const { prisma } = prismaWith(ROW);
    const out = await findActiveCustomPromptForInstrument(prisma as never, 'PSYCHOSOCIAL');
    expect(out?.body).toBe('corpo do prompt');
    expect(out?.files).toEqual([
      { filename: 'orientacao.pdf', extractedText: 'texto de referência' },
    ]);
  });

  it('sem prompt cadastrado devolve null (o chamador usa o prompt fixo)', async () => {
    const { prisma } = prismaWith(null);
    expect(await findActiveCustomPromptForInstrument(prisma as never, 'essencial')).toBeNull();
  });

  it('falha de banco NÃO derruba a geração — vira null', async () => {
    const { prisma } = prismaWith(null, true);
    expect(await findActiveCustomPromptForInstrument(prisma as never, 'essencial')).toBeNull();
  });
});

const MATRIX = [
  {
    slug: 'sobrecarga',
    label: 'Sobrecarga de trabalho',
    sourceSlug: 'demandas',
    probability: 4,
    severity: 4,
    risk: 16,
    riskClass: 'MUITO_ALTO',
    exposureAvg: 4.1,
    planRequired: true,
  },
] as unknown as PsychosocialRiskMatrixRow[];

describe('resolveActionPlans', () => {
  it('resolve o prompt pelo diagnóstico recebido, não por um slug fixo', async () => {
    const { prisma, findFirst } = prismaWith(null);
    const aiSettings = {
      get: vi.fn(async () => ({ enabled: true, enabledModules: ['relatorios'] })),
      chat: vi.fn(async () => ({ ok: false as const, kind: 'no_key' as const })),
    };

    const out = await resolveActionPlans({ prisma, aiSettings } as never, 't1', MATRIX, 'essencial');

    expect(findFirst.mock.calls[0][0].where.OR).toContainEqual({
      instrumentSlugs: { has: 'essencial' },
    });
    // Sem chave de IA, o conteúdo continua vindo da biblioteca técnica.
    expect(out.origin).toBe('biblioteca');
  });

  it('IA desligada nem consulta prompt personalizado', async () => {
    const { prisma, findFirst } = prismaWith(ROW);
    const aiSettings = {
      get: vi.fn(async () => ({ enabled: false, enabledModules: [] })),
      chat: vi.fn(),
    };

    const out = await resolveActionPlans(
      { prisma, aiSettings } as never,
      't1',
      MATRIX,
      'PSYCHOSOCIAL',
    );

    expect(findFirst).not.toHaveBeenCalled();
    expect(aiSettings.chat).not.toHaveBeenCalled();
    expect(out.origin).toBe('biblioteca');
  });
});
