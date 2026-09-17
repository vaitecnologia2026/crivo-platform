import { describe, it, expect, vi } from 'vitest';
import { MeController } from './me.controller';
import type { SessionUser } from '@crivo/types';

/**
 * KPI "Horas contratadas" (Programas › Mentorias e Agenda, auditoria Programas
 * vs. protótipo Lovable de 17/09/2026): antes o campo não existia no Contract e
 * `GET /me/mentorias` só devolvia as linhas de mentoria, sem contexto de
 * contrato — o portal ficava permanentemente com "—" / "não informado no
 * contrato". Com `Contract.contractedHours` (migration 20260917190000), o
 * endpoint passa a devolver `{ rows, contractedHours }`.
 */

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER: SessionUser = {
  id: 'user-1',
  tenantId: TENANT_ID,
  email: 'lider@empresa.com',
  name: 'Líder Teste',
  role: 'ADMIN',
};

const MENTORIA_ROW = {
  id: 'ment-1',
  title: 'Sessão de devolutiva',
  format: 'ONLINE',
  mentorName: 'Mentor CRIVO',
  attendee: 'lider@empresa.com',
  scheduledAt: new Date('2026-09-20T14:00:00Z'),
  durationMin: 60,
  meetingUrl: null,
  location: null,
  status: 'AGENDADA',
  notes: null,
  recordingUrl: null,
};

function buildController(contractedHours: number | null) {
  const prismaFake = {
    admin: {
      mentoria: { findMany: vi.fn(async () => [MENTORIA_ROW]) },
      contract: {
        findFirst: vi.fn(async ({ where }: { where: { organizationId: string } }) => {
          if (where.organizationId !== TENANT_ID) return null;
          return { contractedHours };
        }),
      },
    },
  };
  const controller = new MeController(
    {} as never, // ModuleService — não usado em myMentorias
    {} as never, // PermissionService — não usado em myMentorias
    prismaFake as never,
    {} as never, // GroupsService — não usado em myMentorias
  );
  return { controller, prismaFake };
}

describe('MeController.myMentorias — KPI "Horas contratadas"', () => {
  it('contrato com contractedHours definido → devolve o valor real', async () => {
    const { controller } = buildController(40);
    const result = await controller.myMentorias(USER);
    expect(result.contractedHours).toBe(40);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe('ment-1');
  });

  it('contrato com contractedHours = 0 → devolve 0 (não confunde com "não informado")', async () => {
    const { controller } = buildController(0);
    const result = await controller.myMentorias(USER);
    expect(result.contractedHours).toBe(0);
  });

  it('contrato sem contractedHours (null) → mantém "não informado" (null)', async () => {
    const { controller } = buildController(null);
    const result = await controller.myMentorias(USER);
    expect(result.contractedHours).toBeNull();
  });

  it('sem contrato nenhum → também null, sem quebrar', async () => {
    const prismaFake = {
      admin: {
        mentoria: { findMany: vi.fn(async () => [MENTORIA_ROW]) },
        contract: { findFirst: vi.fn(async () => null) },
      },
    };
    const controller = new MeController({} as never, {} as never, prismaFake as never, {} as never);
    const result = await controller.myMentorias(USER);
    expect(result.contractedHours).toBeNull();
  });
});
