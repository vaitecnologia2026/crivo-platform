import { describe, expect, it, vi } from 'vitest';
import { TERMS_VERSION, type SessionUser } from '@crivo/types';
import { MeController } from './me.controller';

/**
 * GET /me/onboarding-status — card "Primeiros passos" do Dashboard (Área da
 * Organização). Só marcos corporativos: termos, primeira campanha e primeiro
 * plano validado. Os marcos pessoais de líder (decisão, Pocket) são conteúdo
 * privado de Minha Jornada (Spec V1 v1.2 §3): o card não os pede nem os exige
 * de quem é só Administrador — que nem pode registrá-los (LeaderGuard).
 */

type Estado = { termos: boolean; campanhas: number; planosValidados: number };

function build({ termos, campanhas, planosValidados }: Estado) {
  const decisionCount = vi.fn(async () => 3);
  const pocketCount = vi.fn(async () => 2);
  const tx = {
    user: {
      findUnique: vi.fn(async () =>
        termos
          ? { termsAcceptedAt: new Date('2026-09-01T12:00:00Z'), termsVersion: TERMS_VERSION }
          : { termsAcceptedAt: null, termsVersion: null },
      ),
    },
    assessmentCycle: { count: vi.fn(async () => campanhas) },
    actionPlan: { count: vi.fn(async () => planosValidados) },
    decision: { count: decisionCount },
    pocketSession: { count: pocketCount },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(tx)) };
  const controller = new MeController({} as never, {} as never, prisma as never, {} as never, {} as never);
  return { controller, decisionCount, pocketCount };
}

const admin = { id: 'u1', tenantId: 't1', email: 'admin@empresa.com', name: 'Admin', role: 'ADMIN' } as SessionUser;

describe('MeController.myOnboardingStatus — só marcos corporativos', () => {
  it('devolve só termos, campanha e plano validado (sem decisão nem Pocket)', async () => {
    const { controller, decisionCount, pocketCount } = build({ termos: true, campanhas: 1, planosValidados: 0 });
    const r = await controller.myOnboardingStatus(admin);
    expect(r).toEqual({
      termsAccepted: true,
      firstCampaignCreated: true,
      firstPlanValidated: false,
      allDone: false,
    });
    // O conteúdo privado do líder nem é consultado.
    expect(decisionCount).not.toHaveBeenCalled();
    expect(pocketCount).not.toHaveBeenCalled();
  });

  it('Somente Administrador conclui com os 3 marcos corporativos', async () => {
    const r = await build({ termos: true, campanhas: 2, planosValidados: 1 }).controller.myOnboardingStatus(admin);
    expect(r.allDone).toBe(true);
  });

  it('sem aceite dos termos vigentes não conclui', async () => {
    const r = await build({ termos: false, campanhas: 2, planosValidados: 1 }).controller.myOnboardingStatus(admin);
    expect(r).toMatchObject({ termsAccepted: false, allDone: false });
  });
});
