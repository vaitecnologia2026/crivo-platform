import { describe, expect, it, vi } from 'vitest';
import { TERMS_VERSION } from '@crivo/types';
import { MeController } from './me.controller';

// Homologação 17/09 (jornada, item 5): "Termos/Privacidade universais e
// versionados". O aceite fica na trilha (quem, quando, versão) e um bump de
// TERMS_VERSION volta a exigir o aceite.

function build(termsVersion: string | null) {
  const update = vi.fn(async () => ({}));
  const tx = {
    user: {
      findUnique: vi.fn(async () => ({ termsVersion, termsAcceptedAt: termsVersion ? new Date('2026-07-01') : null })),
      update,
    },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
  const audit = { record: vi.fn(async () => undefined) };
  const c = new MeController({} as never, {} as never, prisma as never, {} as never, audit as never);
  const user = { id: 'u1', tenantId: 'org-1', email: 'r@x.com', name: 'R', role: 'ADMIN' } as never;
  return { c, user, update, audit };
}

describe('termos versionados e auditados', () => {
  it('aceite grava a versão vigente e entra na auditoria com a versão anterior', async () => {
    const { c, user, update, audit } = build('2025-01');
    const r = await c.acceptTerms(user);
    expect(r).toEqual({ accepted: true, acceptedVersion: TERMS_VERSION, currentVersion: TERMS_VERSION });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ termsVersion: TERMS_VERSION }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'terms.accept',
      tenantId: 'org-1',
      target: 'r@x.com',
      meta: { version: TERMS_VERSION, previousVersion: '2025-01' },
    }));
  });

  it('quem aceitou uma versão antiga volta a "não aceito" até reaceitar', async () => {
    const { c, user } = build('2025-01');
    const s = await c.myTerms(user);
    expect(s).toEqual({ accepted: false, acceptedVersion: '2025-01', currentVersion: TERMS_VERSION });
  });

  it('aceite na versão vigente vale', async () => {
    const { c, user } = build(TERMS_VERSION);
    expect((await c.myTerms(user)).accepted).toBe(true);
  });
});
