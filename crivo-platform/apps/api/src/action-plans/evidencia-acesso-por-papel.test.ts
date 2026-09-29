import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { SessionUser } from '@crivo/types';
import { ActionPlansService } from './action-plans.service';

// As rotas de evidência (/action-plans/items/:id/evidences, /upload e
// /evidences/:id/file) não têm @Roles: o RESPONSÁVEL vinculado à ação (H-008,
// decisão CRIVO 28/09/2026) pode ser de qualquer papel. A barreira é a checagem
// no serviço — este teste impede que um refactor a remova e deixe a rota aberta
// a qualquer papel do tenant.

const item = { id: 'i1', planId: 'p1', responsibleUserId: 'u-resp' };

function build() {
  const tx = {
    actionItem: { findUnique: vi.fn(async () => item) },
    evidence: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'e1',
        ...data,
        url: null,
        note: null,
        status: 'ENVIADA',
        fileName: null,
        fileMime: null,
        fileSize: null,
        createdAt: new Date('2026-09-28T12:00:00Z'),
      })),
      findUnique: vi.fn(async () => ({
        id: 'e1',
        fileName: 'ata.pdf',
        fileMime: 'application/pdf',
        file: { data: Buffer.from('x') },
        item: { responsibleUserId: 'u-resp' },
      })),
    },
    evidenceFile: { create: vi.fn(async () => ({})) },
  };
  const prisma = {
    forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    admin: {},
  };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const svc = new ActionPlansService(prisma as any, {} as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { svc, tx };
}

const u = (id: string, role: SessionUser['role']): SessionUser => ({
  id,
  role,
  tenantId: 't1',
  email: `${id}@t`,
  name: id,
});
const dto = { kind: 'ata', title: 'Ata da reunião' };
const arquivo = { originalname: 'ata.pdf', mimetype: 'application/pdf', size: 1, buffer: Buffer.from('x') };

describe('evidência: gestão ou o usuário responsável pela ação', () => {
  it('LÍDER que não é o responsável não anexa nem baixa', async () => {
    const { svc, tx } = build();
    await expect(svc.addEvidence('t1', 'i1', dto, u('u-outro', 'LIDER'))).rejects.toThrow(ForbiddenException);
    await expect(
      svc.addFileEvidence('t1', 'i1', { kind: 'ata', title: 'x' }, arquivo, u('u-outro', 'LIDER')),
    ).rejects.toThrow(ForbiddenException);
    await expect(svc.getEvidenceFile('t1', 'e1', u('u-outro', 'COLABORADOR'))).rejects.toThrow(ForbiddenException);
    expect(tx.evidence.create).not.toHaveBeenCalled();
  });

  it('o usuário responsável pela ação anexa e baixa, mesmo sendo LÍDER', async () => {
    const { svc, tx } = build();
    await svc.addEvidence('t1', 'i1', dto, u('u-resp', 'LIDER'));
    expect(tx.evidence.create).toHaveBeenCalledTimes(1);
    await expect(svc.getEvidenceFile('t1', 'e1', u('u-resp', 'LIDER'))).resolves.toMatchObject({ fileName: 'ata.pdf' });
  });

  it('gestão anexa; Jurídico só baixa', async () => {
    const { svc } = build();
    await expect(svc.addEvidence('t1', 'i1', dto, u('u-rh', 'RH'))).resolves.toBeTruthy();
    await expect(svc.addEvidence('t1', 'i1', dto, u('u-jur', 'JURIDICO'))).rejects.toThrow(ForbiddenException);
    await expect(svc.getEvidenceFile('t1', 'e1', u('u-jur', 'JURIDICO'))).resolves.toBeTruthy();
  });
});
