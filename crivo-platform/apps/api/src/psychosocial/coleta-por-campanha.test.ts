import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

/**
 * Regra do produto: no Diagnóstico Organizacional a coleta acontece SEMPRE
 * dentro de uma campanha. O link aberto da empresa (/q/<slug>) coletava fora de
 * qualquer ciclo — a resposta não entrava na adesão nem na comparação entre
 * períodos. A tela deixou de oferecer o botão; este teste prende o gate do
 * servidor, para a porta não voltar por uma chamada direta à API.
 */
const { resolveInstrumentForTenant, usesPsychosocialEngine } = vi.hoisted(() => ({
  resolveInstrumentForTenant: vi.fn(),
  usesPsychosocialEngine: vi.fn(),
}));
vi.mock('../admin/methodology.service', () => ({
  resolveInstrumentForTenant,
  usesPsychosocialEngine,
  loadActiveMethodologyConfig: vi.fn(async () => null),
  loadMethodologyConfigByVersion: vi.fn(async () => null),
  resolveActiveMethodology: vi.fn(async () => null),
  resolvePsychosocialInstrument: vi.fn(async () => 'diagnostico-organizacional'),
}));

import { PsychosocialService } from './psychosocial.service';

const TENANT = '11111111-1111-1111-1111-111111111111';

function build() {
  const org = { id: TENANT, name: 'Empresa Teste', psychosocialSlug: null as string | null };
  const tx = {
    organization: {
      findUnique: vi.fn(async () => org),
      update: vi.fn(async ({ data }: { data: { psychosocialSlug: string } }) => {
        org.psychosocialSlug = data.psychosocialSlug;
        return org;
      }),
    },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
  return { service: new PsychosocialService(prisma as never), org };
}

beforeEach(() => {
  resolveInstrumentForTenant.mockReset();
  usesPsychosocialEngine.mockReset();
});

describe('link aberto do questionário', () => {
  it('empresa com Organizacional NÃO gera link solto — a coleta é por campanha', async () => {
    resolveInstrumentForTenant.mockResolvedValue('diagnostico-organizacional');
    usesPsychosocialEngine.mockResolvedValue(true);
    const { service } = build();

    await expect(service.ensureLink(TENANT)).rejects.toThrow(BadRequestException);
    await expect(service.ensureLink(TENANT)).rejects.toThrow(/dentro de uma campanha/i);
  });

  it('empresa com outro diagnóstico segue gerando (nada quebra fora do NR-1)', async () => {
    resolveInstrumentForTenant.mockResolvedValue('essencial');
    usesPsychosocialEngine.mockResolvedValue(false);
    const { service, org } = build();

    const r = await service.ensureLink(TENANT);
    expect(r.slug).toBeTruthy();
    expect(org.psychosocialSlug).toBe(r.slug);
  });
});
