import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

/**
 * A campanha pública (/p/c/<slug>) aplicava o Diagnóstico Organizacional (NR-1)
 * com o instrumento FIXO no código, enquanto a autoavaliação do Essencial e o
 * link do colaborador sempre resolveram o questionário pelo MÉTODO CONTRATADO.
 * Numa empresa só-Essencial isso entregava o questionário errado E gravava em
 * outra tabela, sem somar com as demais respostas.
 *
 * Estes testes prendem: a campanha resolve o instrumento pelo contrato, roteia a
 * gravação para o serviço certo, e o caminho do tenant ORGANIZACIONAL — que é o
 * que está em produção hoje — não muda em nada.
 */

const { resolveInstrumentForTenant, resolveActiveMethodology } = vi.hoisted(() => ({
  resolveInstrumentForTenant: vi.fn(),
  resolveActiveMethodology: vi.fn(),
}));
vi.mock('../admin/methodology.service', () => ({
  resolveInstrumentForTenant,
  resolveActiveMethodology,
}));

import { IcdService } from './icd.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const SLUG = 'campanha-teste';

const PERGUNTAS_NR1 = [{ id: 1, dimension: 'demandas', text: 'Pergunta do NR-1' }];

function build(cycle: Partial<Record<string, unknown>> = {}) {
  const prisma = {
    admin: {
      assessmentCycle: {
        findUnique: vi.fn(async () => ({
          id: 'ciclo-1',
          tenantId: TENANT,
          name: 'Campanha teste',
          description: null,
          sector: 'Operações',
          status: 'OPEN',
          startsAt: null,
          endsAt: null,
          org: { name: 'Empresa Teste' },
          ...cycle,
        })),
      },
    },
  };
  const psychosocial = {
    publicQuestions: vi.fn(async () => PERGUNTAS_NR1),
    submit: vi.fn(async () => ({ ok: true as const, result: { score: 80 } })),
  };
  const diagnostics = {
    submitForTenant: vi.fn(async () => ({ ok: true as const, result: { score: 70 } })),
  };
  const service = new IcdService(
    prisma as never,
    {} as never,
    {} as never,
    psychosocial as never,
    diagnostics as never,
  );
  return { service, psychosocial, diagnostics };
}

beforeEach(() => {
  resolveInstrumentForTenant.mockReset();
  resolveActiveMethodology.mockReset();
});

describe('campanha pública — instrumento pelo método contratado', () => {
  it('tenant ORGANIZACIONAL: segue no psicossocial, sem mudança nenhuma', async () => {
    resolveInstrumentForTenant.mockResolvedValue('PSYCHOSOCIAL');
    const { service, psychosocial, diagnostics } = build();

    const info = await service.getPublicBySlug(SLUG);
    expect(info.questions).toEqual(PERGUNTAS_NR1);

    await service.submitPublicByCampaignSlug(SLUG, { answers: [{ questionId: 1, value: 3 }] } as never);
    expect(psychosocial.submit).toHaveBeenCalledOnce();
    // O caminho antigo NÃO pode passar pelo serviço de diagnósticos do catálogo.
    expect(diagnostics.submitForTenant).not.toHaveBeenCalled();
  });

  it('tenant ESSENCIAL: aplica o instrumento contratado, não o NR-1', async () => {
    resolveInstrumentForTenant.mockResolvedValue('essencial');
    resolveActiveMethodology.mockResolvedValue({
      versionId: 'v1',
      config: { questions: [{ dimensionSlug: 'clareza', text: 'Pergunta do Essencial' }] },
    });
    const { service, psychosocial, diagnostics } = build();

    const info = await service.getPublicBySlug(SLUG);
    expect(info.questions).toEqual([{ id: 1, dimension: 'clareza', text: 'Pergunta do Essencial' }]);
    expect(psychosocial.publicQuestions).not.toHaveBeenCalled();

    await service.submitPublicByCampaignSlug(SLUG, { answers: [{ questionId: 1, value: 4 }] } as never);
    expect(psychosocial.submit).not.toHaveBeenCalled();
    expect(diagnostics.submitForTenant).toHaveBeenCalledOnce();
    const chamada = diagnostics.submitForTenant.mock.calls[0] as unknown as
      | [string, string, { sector?: string }]
      | undefined;
    expect(chamada?.[0]).toBe(TENANT);
    expect(chamada?.[1]).toBe('essencial');
    // O setor é o da campanha — o respondente não escolhe.
    expect(chamada?.[2]?.sector).toBe('Operações');
  });

  it('sem método resolvido, cai no psicossocial (comportamento histórico)', async () => {
    resolveInstrumentForTenant.mockResolvedValue(null);
    const { service, psychosocial } = build();
    const info = await service.getPublicBySlug(SLUG);
    expect(info.questions).toEqual(PERGUNTAS_NR1);
    expect(psychosocial.publicQuestions).toHaveBeenCalledOnce();
  });

  it('instrumento contratado sem versão publicada: erro que explica o motivo', async () => {
    resolveInstrumentForTenant.mockResolvedValue('essencial');
    resolveActiveMethodology.mockResolvedValue(null);
    const { service } = build();
    // Não pode virar "link inválido": manda a pessoa procurar o problema no lugar errado.
    await expect(service.getPublicBySlug(SLUG)).rejects.toThrow(BadRequestException);
    await expect(service.getPublicBySlug(SLUG)).rejects.toThrow(/ainda não foi publicado no Motor/);
  });

  it('campanha fechada não devolve pergunta nem aceita resposta', async () => {
    resolveInstrumentForTenant.mockResolvedValue('essencial');
    const { service, diagnostics } = build({ status: 'CLOSED' });
    const info = await service.getPublicBySlug(SLUG);
    expect(info.questions).toEqual([]);
    expect(info.open).toBe(false);
    await expect(
      service.submitPublicByCampaignSlug(SLUG, { answers: [] } as never),
    ).rejects.toThrow(/não está aberta/);
    expect(diagnostics.submitForTenant).not.toHaveBeenCalled();
  });
});
