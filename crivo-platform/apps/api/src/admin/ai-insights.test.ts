import { describe, expect, it, vi } from 'vitest';
import { AiInsightsService } from './ai-insights.service';

/** Motor de IA — saneamento do `limit` dos logs (take:NaN quebrava o Prisma). */
describe('AiInsightsService.logs — limite', () => {
  function makeService() {
    const findMany = vi.fn(async () => []);
    const prisma = {
      admin: {
        aiCallLog: { findMany },
        organization: { findMany: vi.fn(async () => []) },
      },
    } as any;
    return { svc: new AiInsightsService(prisma), findMany };
  }

  const takeOf = (findMany: any) => findMany.mock.calls[0][0].take;

  it.each([
    ['NaN (?limit=abc)', Number('abc'), 100],
    ['ausente', undefined, 100],
    ['zero', 0, 100],
    ['negativo', -5, 100],
    ['fracionário', 10.7, 10],
    ['acima do teto', 5000, 500],
    ['Infinity', Number.POSITIVE_INFINITY, 100],
    ['válido', 25, 25],
  ])('%s → take %s', async (_label, limit, expected) => {
    const { svc, findMany } = makeService();
    await svc.logs({ limit: limit as number | undefined });
    expect(takeOf(findMany)).toBe(expected);
    expect(Number.isInteger(takeOf(findMany))).toBe(true);
  });
});
