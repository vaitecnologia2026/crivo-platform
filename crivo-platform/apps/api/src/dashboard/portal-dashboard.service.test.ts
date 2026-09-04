import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

/**
 * O dashboard do cliente (Visão Geral) precisa mostrar o resultado agregado do
 * diagnóstico CONTRATADO. O defeito que estes testes fixam: a empresa coletava
 * as respostas dos colaboradores e a Visão Geral não mostrava nada, porque os
 * únicos endpoints que ela consumia liam a tabela do psicossocial — vazia para
 * quem contratou o Essencial, cujas respostas vão para `diagnostic_responses`.
 *
 * A regra que importa é o ROTEAMENTO: o dashboard tem de ler pelo mesmo motor
 * que gravou a resposta (`usesPsychosocialEngine`), senão volta a olhar para a
 * tabela errada.
 */

const { resolveInstrumentForTenant, usesPsychosocialEngine } = vi.hoisted(() => ({
  resolveInstrumentForTenant: vi.fn(),
  usesPsychosocialEngine: vi.fn(),
}));
vi.mock('../admin/methodology.service', () => ({
  resolveInstrumentForTenant,
  usesPsychosocialEngine,
}));

import { PortalDashboardService } from './portal-dashboard.service';

const TENANT = 'org-1';

const AGREGADO = {
  minRespondents: 5,
  totalRespondents: 5,
  suppressed: false,
  score: 49,
  level: 'ATENCAO',
  levelLabel: 'Atenção crítica',
  byDimension: { clima: 38, lideranca: 52 },
  dimensionLabels: { clima: 'Clima', lideranca: 'Liderança' },
};

function build() {
  const diagnostics = { results: vi.fn(async () => AGREGADO) };
  const prisma = {
    admin: {
      diagnosticInstrument: {
        findFirst: vi.fn(async (): Promise<{ name: string } | null> => ({ name: 'Diagnóstico Essencial' })),
      },
    },
  };
  const svc = new PortalDashboardService(prisma as never, diagnostics as never);
  return { svc, diagnostics, prisma };
}

describe('resultado do diagnóstico contratado no dashboard', () => {
  it('tenant do Essencial: devolve o agregado lido de diagnostic_responses', async () => {
    // É o caso do print do cliente: 5 respondentes, tela sem nenhum resultado.
    resolveInstrumentForTenant.mockResolvedValue('diagnostico-essencial');
    usesPsychosocialEngine.mockResolvedValue(false);
    const { svc, diagnostics } = build();

    const r = await svc.diagnostic(TENANT);

    expect(diagnostics.results).toHaveBeenCalledWith(TENANT, 'diagnostico-essencial');
    expect(r.engine).toBe('DIAGNOSTICS');
    expect(r.instrumentSlug).toBe('diagnostico-essencial');
    expect(r.instrumentName).toBe('Diagnóstico Essencial');
    expect(r.aggregate?.totalRespondents).toBe(5);
    expect(r.aggregate?.score).toBe(49);
  });

  it('tenant do Organizacional: não duplica o card — devolve o motor, sem agregado', async () => {
    // A Visão Geral já tem o card "Fatores Psicossociais" para este motor.
    // Devolver o agregado aqui faria o mesmo dado aparecer duas vezes na tela.
    resolveInstrumentForTenant.mockResolvedValue('PSYCHOSOCIAL');
    usesPsychosocialEngine.mockResolvedValue(true);
    const { svc, diagnostics } = build();

    const r = await svc.diagnostic(TENANT);

    expect(r.engine).toBe('PSYCHOSOCIAL');
    expect(r.aggregate).toBeNull();
    expect(diagnostics.results).not.toHaveBeenCalled();
  });

  it('sem contrato resolvido: cai no Diagnóstico Executivo e não quebra a tela', async () => {
    resolveInstrumentForTenant.mockResolvedValue(null);
    usesPsychosocialEngine.mockResolvedValue(false);
    const { svc, diagnostics } = build();

    const r = await svc.diagnostic(TENANT);

    expect(diagnostics.results).toHaveBeenCalledWith(TENANT, 'PRE_DIAGNOSTIC');
    expect(r.instrumentSlug).toBe('PRE_DIAGNOSTIC');
  });

  it('instrumento fora do catálogo: segue sem nome, sem derrubar o agregado', async () => {
    resolveInstrumentForTenant.mockResolvedValue('diagnostico-avulso');
    usesPsychosocialEngine.mockResolvedValue(false);
    const { svc, prisma } = build();
    // Fake do Prisma no teste; rls-allow: nao ha conexao nem query de negocio.
    prisma.admin.diagnosticInstrument.findFirst = vi.fn(async () => null);

    const r = await svc.diagnostic(TENANT);

    expect(r.instrumentName).toBeNull();
    expect(r.aggregate?.totalRespondents).toBe(5);
  });
});
