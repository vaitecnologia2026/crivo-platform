import { describe, expect, it, vi } from 'vitest';
import { DiagnosticsService } from './diagnostics.service';

// Homologação 21/09: "Autoavaliação do gestor: separada do agregado dos
// colaboradores". O resultado da Visão Geral somava a resposta do gestor
// (origin = SELF_ASSESSMENT) ao índice e ao N ("8 respondentes · 7 por link +
// 1 autoavaliação"). Agora o agregado é só dos colaboradores; a autoavaliação
// volta apenas como contagem informativa.

type Where = { instrumentSlug?: string; origin?: string; OR?: { origin: null | { not: string } }[] };

/** Mock que aplica a semântica do `where` de origin — é ela que está em teste. */
function prismaCom(rows: { origin: string | null; score: number; byDimension: Record<string, number> }[]) {
  const casa = (r: { origin: string | null }, w: Where) => {
    if (w.origin !== undefined) return r.origin === w.origin;
    if (w.OR) return w.OR.some((c) => (c.origin === null ? r.origin === null : r.origin !== c.origin.not));
    return true;
  };
  const tx = {
    diagnosticResponse: {
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        rows.filter((r) => casa(r, where)).map((r) => ({ sector: null, score: r.score, byDimension: r.byDimension, methodologyVersionId: 'v1' })),
      ),
      count: vi.fn(async ({ where }: { where: Where }) => rows.filter((r) => casa(r, where)).length),
    },
  };
  const admin = {
    tenant: { findUnique: vi.fn(async () => null) },
    organization: { findUnique: vi.fn(async () => ({ minRespondents: 5 })) },
    engineConfig: { findUnique: vi.fn(async () => ({ minRespondents: 5 })), create: vi.fn() },
    methodologyVersion: { findFirst: vi.fn(async () => null) },
  };
  return {
    admin,
    forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
}

describe('Resultado do diagnóstico (colaboradores) sem a autoavaliação do gestor', () => {
  it('índice e N são só dos colaboradores; a autoavaliação vira contagem à parte', async () => {
    const colaboradores = Array.from({ length: 5 }, () => ({ origin: null, score: 40, byDimension: {} }));
    const gestor = { origin: 'SELF_ASSESSMENT', score: 100, byDimension: {} };
    const svc = new DiagnosticsService(prismaCom([...colaboradores, gestor]) as never);
    const r = await svc.results('org-1', 'diagnostico-essencial');
    expect(r.suppressed).toBe(false);
    if (r.suppressed) return;
    expect(r.totalRespondents).toBe(5);
    expect(r.score).toBe(40); // com o gestor dentro dava 50
    expect(r.selfAssessments).toBe(1);
  });

  it('a autoavaliação NÃO libera o resultado: 4 colaboradores + gestor continua suprimido', async () => {
    const colaboradores = Array.from({ length: 4 }, () => ({ origin: null, score: 40, byDimension: {} }));
    const gestor = { origin: 'SELF_ASSESSMENT', score: 100, byDimension: {} };
    const svc = new DiagnosticsService(prismaCom([...colaboradores, gestor]) as never);
    const r = await svc.results('org-1', 'diagnostico-essencial');
    expect(r.suppressed).toBe(true);
    expect(r.totalRespondents).toBe(4);
  });
});
