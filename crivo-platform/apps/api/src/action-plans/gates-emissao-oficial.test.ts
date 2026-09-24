import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

/**
 * Homologação 17/09 — "Gates de emissão oficial precisam ser comprovados de
 * ponta a ponta" e "congelar a versão emitida". Prova, no servidor, a cadeia
 * de emit() do Dossiê Técnico:
 *   1. campanha ABERTA → recusa (a pré-visualização segue livre);
 *   2. identificação da organização incompleta → recusa, nomeando o que falta;
 *   3. tudo em ordem → v1 congelada com hash e "Documento emitido";
 *   4. reemitir o MESMO conteúdo → devolve a v1 (não gera v2);
 *   5. conteúdo mudou → v2, hash diferente.
 */
vi.mock('../admin/engine-config', () => ({
  getEngineConfig: vi.fn(async () => ({ minRespondents: 5 })),
  resolveMinRespondents: vi.fn(async () => 5),
}));
// Motor do instrumento: psicossocial = Organizacional (gates também por GHE).
const motor = vi.hoisted(() => ({ psicossocial: false }));
vi.mock('../admin/methodology.service', () => ({
  resolveActiveMethodology: vi.fn(async () => null),
  resolveInstrumentForTenant: vi.fn(),
  resolveTenantInstrument: vi.fn(async () => ({
    slug: motor.psicossocial ? 'diagnostico-organizacional' : 'diagnostico-essencial',
    motorPsicossocial: motor.psicossocial,
  })),
  usesPsychosocialEngine: vi.fn(),
}));

import { DocumentsService } from './documents.service';

const TENANT = 'dded8882-85a0-4bc0-85e2-01b34d2ec548';

type Plano = { validatedAt: Date | null; items: Record<string, unknown>[] };
function build(
  opts: {
    campanhaAberta?: string | null;
    org?: Record<string, unknown>;
    responsible?: string | null;
    plans?: Plano[];
    obrigatorios?: { slug: string; label: string }[];
    /** Organizacional: matriz de cada GHE elegível (fatores com plano obrigatório). */
    ghes?: { ghe: string; obrigatorios: { slug: string; label: string }[] }[];
  } = {},
) {
  motor.psicossocial = !!opts.ghes;
  const emissoes: Record<string, unknown>[] = [];
  const tx = {
    assessmentCycle: {
      findFirst: vi.fn(async () => (opts.campanhaAberta ? { name: opts.campanhaAberta } : null)),
    },
    reportEmission: {
      findFirst: vi.fn(async ({ where }: { where: { type: string; emissionNumber?: number } }) => {
        const doTipo = emissoes.filter((e) => e.type === where.type);
        if (where.emissionNumber != null) return doTipo.find((e) => e.emissionNumber === where.emissionNumber) ?? null;
        return doTipo.sort((a, b) => (b.emissionNumber as number) - (a.emissionNumber as number))[0] ?? null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `em-${emissoes.length + 1}`, ...data };
        emissoes.push(row);
        return row;
      }),
    },
  };
  const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)), admin: {} };
  const psychosocial = {
    results: vi.fn(async () =>
      opts.obrigatorios
        ? {
            totalRespondents: 7,
            minRespondents: 5,
            overall: {
              suppressed: false,
              riskMatrix: opts.obrigatorios.map((f) => ({ ...f, planRequired: true })),
            },
            ghes: (opts.ghes ?? []).map((g) => ({
              ghe: g.ghe,
              respondents: 6,
              suppressed: false,
              riskMatrix: g.obrigatorios.map((f) => ({ ...f, planRequired: true })),
            })),
          }
        : null,
    ),
  };
  const svc = new DocumentsService(prisma as never, psychosocial as never, {} as never);

  const org = {
    id: TENANT, name: 'ESSENCIAL - TESTE', legalName: 'Essencial Teste Ltda', taxId: '12.345.678/0001-90',
    ...(opts.org ?? {}),
  };
  const contract = { responsible: opts.responsible === undefined ? 'Rodrigo' : opts.responsible, technicalOutput: 'SEM_INTEGRACAO' };
  vi.spyOn(svc as never as { context: () => unknown }, 'context').mockResolvedValue({
    contract, method: 'ESSENCIAL', org, company: org.name, plans: opts.plans ?? [], cnaeDecision: null,
  } as never);

  let corpo = 'Plano com 4 ações aprovadas';
  vi.spyOn(svc as never as { generate: () => unknown }, 'generate').mockImplementation(async () => ({
    title: 'Dossiê Técnico',
    generatedAt: new Date().toISOString(),
    meta: [{ label: 'Status', value: 'Rascunho (pré-visualização)' }],
    sections: [
      { heading: 'Plano de ação', body: corpo },
      { heading: 'Controle documental', rows: [{ label: 'Método', value: 'Essencial' }, { label: 'Status do documento', value: 'Rascunho' }] },
    ],
  }));
  return { svc, tx, emissoes, mudarConteudo: (novo: string) => { corpo = novo; } };
}

describe('gates de emissão oficial do Dossiê Técnico', () => {
  it('1. campanha aberta bloqueia a emissão e nomeia a campanha', async () => {
    const { svc, emissoes } = build({ campanhaAberta: 'ESSENCIAL TESTE COMPLETO' });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(BadRequestException);
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/ESSENCIAL TESTE COMPLETO.*ainda está aberta/);
    expect(emissoes).toHaveLength(0);
  });

  it('2. identificação incompleta bloqueia e lista o que falta', async () => {
    const { svc, emissoes } = build({ org: { taxId: '' }, responsible: null });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/CNPJ\/identificador legal, responsável da empresa/);
    expect(emissoes).toHaveLength(0);
  });

  it('3. com os gates satisfeitos, congela a v1 com hash e o carimbo do modelo (Final · 1.0)', async () => {
    const { svc, emissoes } = build();
    const r = await svc.emit(TENANT, 'dossie_tecnico', 'rodrigo@empresa.com');
    expect(r.reused).toBe(false);
    expect(emissoes).toHaveLength(1);
    const e = emissoes[0] as { emissionNumber: number; contentHash: string; generatedBy: string; content: { meta: { label: string; value: string }[]; sections: { heading: string; rows?: { label: string; value: string }[] }[] } };
    expect(e.emissionNumber).toBe(1);
    expect(e.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(e.generatedBy).toBe('rodrigo@empresa.com');
    const controle = e.content.sections.find((s) => s.heading === 'Controle documental')!.rows!;
    // Modelo oficial de 23/09: "Final", versão "1.0", validação pela organização.
    expect(controle).toEqual(expect.arrayContaining([
      { label: 'Status do documento', value: 'Final' },
      { label: 'Versão do documento', value: '1.0' },
      { label: 'Validação', value: 'Organização / responsável autorizado' },
      { label: 'Hash/Identificador', value: e.contentHash.slice(0, 16) },
      { label: 'Método', value: 'Essencial' }, // linha do gerador preservada
    ]));
    expect(controle.find((r) => r.value === 'Rascunho')).toBeUndefined();
    // O Status do cabeçalho também vira "Final" na versão congelada.
    expect(e.content.meta).toEqual([{ label: 'Status', value: 'Final' }]);
  });

  it('4. reemitir sem mudança devolve a v1 — não cria versão nova', async () => {
    const { svc, emissoes } = build();
    await svc.emit(TENANT, 'dossie_tecnico');
    const r2 = await svc.emit(TENANT, 'dossie_tecnico');
    expect(r2.reused).toBe(true);
    expect((r2.emission as { emissionNumber: number }).emissionNumber).toBe(1);
    expect(emissoes).toHaveLength(1);
  });

  it('5. conteúdo diferente gera v2 com outro hash; a v1 continua congelada', async () => {
    const { svc, emissoes, mudarConteudo } = build();
    await svc.emit(TENANT, 'dossie_tecnico');
    mudarConteudo('Plano com 5 ações aprovadas');
    const r2 = await svc.emit(TENANT, 'dossie_tecnico');
    expect(r2.reused).toBe(false);
    expect(emissoes).toHaveLength(2);
    const [v1, v2] = emissoes as { emissionNumber: number; contentHash: string }[];
    expect([v1.emissionNumber, v2.emissionNumber]).toEqual([1, 2]);
    expect(v1.contentHash).not.toBe(v2.contentHash);
  });

  it('a pré-visualização não passa pelos gates: só a emissão oficial é barrada', async () => {
    const { svc, tx } = build({ campanhaAberta: 'Aberta' });
    // generate() é o preview — mockado aqui, mas emit() nunca chega nele com campanha aberta.
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/ainda está aberta/);
    expect(tx.reportEmission.create).not.toHaveBeenCalled();
  });
});

describe('identificacaoFaltante — mesma régua do cartão e do emit()', () => {
  it('lista exatamente o que falta, na ordem do portão', async () => {
    const { identificacaoFaltante } = await import('./documents.service');
    expect(identificacaoFaltante({ legalName: 'X', taxId: '1' }, { responsible: 'R' }, 'ESSENCIAL')).toEqual([]);
    expect(identificacaoFaltante({ legalName: '', taxId: null }, { responsible: ' ' }, null)).toEqual([
      'razão social', 'CNPJ/identificador legal', 'método aplicado', 'responsável da empresa',
    ]);
    expect(identificacaoFaltante(null, null, 'ESSENCIAL')).toEqual(['razão social', 'CNPJ/identificador legal', 'responsável da empresa']);
  });
});

describe('modelos importados (tpl:) passam pelos mesmos portões', () => {
  it('campanha aberta bloqueia a emissão do modelo importado', async () => {
    const { svc, emissoes } = build({ campanhaAberta: 'ESSENCIAL TESTE COMPLETO' });
    await expect(svc.emit(TENANT, 'tpl:crivo-dossie-tecnico-modelo-oficial-final-v2-3-essencial')).rejects.toThrow(/ainda está aberta/);
    expect(emissoes).toHaveLength(0);
  });

  it('identificação incompleta bloqueia o modelo importado', async () => {
    const { svc, emissoes } = build({ responsible: null });
    await expect(svc.emit(TENANT, 'tpl:qualquer')).rejects.toThrow(/responsável da empresa/);
    expect(emissoes).toHaveLength(0);
  });

  it('com os portões satisfeitos, o modelo importado é emitido e congelado como o oficial', async () => {
    const { svc, emissoes } = build();
    const r = await svc.emit(TENANT, 'tpl:qualquer');
    expect(r.reused).toBe(false);
    expect((emissoes[0] as { type: string; emissionNumber: number }).type).toBe('tpl:qualquer');
    // O carimbo do modelo do Dossiê é só do Dossiê: o importado segue o dele.
    const e = emissoes[0] as { content: { sections: { heading: string; rows?: { label: string; value: string }[] }[] } };
    const controle = e.content.sections.find((s) => s.heading === 'Controle documental')!.rows!;
    expect(controle).toEqual(expect.arrayContaining([
      { label: 'Status do documento', value: 'Documento emitido' },
      { label: 'Versão do documento', value: 'v1' },
    ]));
  });
});

describe('gates de PLANO na emissão oficial (matriz de aceite 21/09)', () => {
  const sobrecarga = { slug: 'fator-1', label: 'Sobrecarga de trabalho' };
  const aprovada = {
    status: 'APROVADA', point: 'Sobrecarga de trabalho', riskFactorSlug: 'fator-1',
    responsible: 'RH', dueDate: new Date('2026-10-21'), expectedEvidence: 'Ata',
  };
  const validado = (items: Record<string, unknown>[]): Plano => ({ validatedAt: new Date('2026-09-21'), items });

  it('1. sugestão pendente bloqueia', async () => {
    const { svc } = build({ plans: [validado([aprovada, { ...aprovada, status: 'SUGERIDA' }])], obrigatorios: [sobrecarga] });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/1 sugestão\(ões\) aguardando decisão/);
  });

  it('2. fator obrigatório sem ação aprovada bloqueia — mesmo com o plano validado', async () => {
    const { svc } = build({ plans: [validado([{ ...aprovada, status: 'NAO_ADOTADA' }])], obrigatorios: [sobrecarga] });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/sem ação aprovada: Sobrecarga de trabalho/);
  });

  it('3. aprovada sem prazo bloqueia', async () => {
    const { svc } = build({ plans: [validado([{ ...aprovada, dueDate: null }])], obrigatorios: [sobrecarga] });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/sem responsável, prazo ou evidência esperada/);
  });

  it('7. plano não validado bloqueia', async () => {
    const { svc } = build({ plans: [{ validatedAt: null, items: [aprovada] }], obrigatorios: [sobrecarga] });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/ainda não validado/);
  });

  it('com os 4 gates satisfeitos, emite; o modelo importado passa pelos mesmos gates', async () => {
    const { svc, emissoes } = build({ plans: [validado([aprovada])], obrigatorios: [sobrecarga] });
    await svc.emit(TENANT, 'dossie_tecnico', 'rodrigo@empresa.com');
    expect(emissoes).toHaveLength(1);
    const { svc: svc2 } = build({ plans: [validado([{ ...aprovada, status: 'SUGERIDA' }])], obrigatorios: [sobrecarga] });
    await expect(svc2.emit(TENANT, 'tpl:dossie-v2-3-essencial')).rejects.toThrow(/aguardando decisão/);
  });
});

describe('gates por GHE no Dossiê Organizacional (modelo oficial de 23/09)', () => {
  const sobrecarga = { slug: 'rps-001', label: 'Sobrecarga de trabalho' };
  const autonomia = { slug: 'rps-005', label: 'Baixa autonomia' };
  const acao = (over: Record<string, unknown>) => ({
    status: 'APROVADA', responsible: 'RH', dueDate: new Date('2026-10-23'), expectedEvidence: 'Ata', ...over,
  });
  const validado = (items: Record<string, unknown>[]): Plano => ({ validatedAt: new Date('2026-09-23'), items });
  const geralSobrecarga = acao({ point: 'Sobrecarga de trabalho', riskFactorSlug: 'rps-001' });

  it('fator que exige ação SÓ num GHE, sem ação aplicável, bloqueia e nomeia o GHE', async () => {
    const { svc } = build({
      plans: [validado([geralSobrecarga])],
      obrigatorios: [sobrecarga],
      ghes: [{ ghe: 'GHE-Operações', obrigatorios: [sobrecarga, autonomia] }],
    });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(
      /no GHE sem ação aprovada aplicável: GHE - Operações: Baixa autonomia/,
    );
  });

  it('a ação GERAL do fator vale para o GHE — sem duplicar por grupo', async () => {
    const { svc, emissoes } = build({
      plans: [validado([geralSobrecarga, acao({ point: 'Baixa autonomia', riskFactorSlug: 'rps-005' })])],
      obrigatorios: [sobrecarga],
      ghes: [{ ghe: 'GHE-Operações', obrigatorios: [sobrecarga, autonomia] }],
    });
    await svc.emit(TENANT, 'dossie_tecnico');
    expect(emissoes).toHaveLength(1);
  });

  it('a ação ESPECÍFICA do próprio GHE cobre; a de outro GHE não', async () => {
    const doGhe = (ghe: string) =>
      acao({ point: 'Baixa autonomia', riskFactorSlug: 'rps-005', scopeGhe: ghe });
    const base = {
      obrigatorios: [sobrecarga],
      ghes: [{ ghe: 'GHE-Operações', obrigatorios: [autonomia] }],
    };
    const ok = build({ ...base, plans: [validado([geralSobrecarga, doGhe('GHE-Operações')])] });
    await ok.svc.emit(TENANT, 'dossie_tecnico');
    expect(ok.emissoes).toHaveLength(1);

    const outro = build({ ...base, plans: [validado([geralSobrecarga, doGhe('GHE-Financeiro')])] });
    await expect(outro.svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/GHE - Operações: Baixa autonomia/);
  });

  it('fator do Resultado Geral não é coberto só por ação específica de um GHE', async () => {
    const { svc } = build({
      plans: [validado([acao({ point: 'Sobrecarga de trabalho', riskFactorSlug: 'rps-001', scopeGhe: 'GHE-Operações' })])],
      obrigatorios: [sobrecarga],
      ghes: [{ ghe: 'GHE-Operações', obrigatorios: [sobrecarga] }],
    });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/sem ação aprovada: Sobrecarga de trabalho/);
  });

  it('fora do Organizacional (motor de diagnóstico), o GHE não cria exigência', async () => {
    const { svc, emissoes } = build({ plans: [validado([geralSobrecarga])], obrigatorios: [sobrecarga] });
    await svc.emit(TENANT, 'dossie_tecnico');
    expect(emissoes).toHaveLength(1);
  });
});

describe('completude cobra a ação específica de GHE (revisão 24/09)', () => {
  it('PA-005 aprovada sem prazo bloqueia, mesmo sendo de escopo GHE', async () => {
    const sobrecarga = { slug: 'rps-001', label: 'Sobrecarga de trabalho' };
    const base = { status: 'APROVADA', point: 'Sobrecarga de trabalho', riskFactorSlug: 'rps-001', responsible: 'RH', expectedEvidence: 'Ata' };
    const { svc } = build({
      plans: [{
        validatedAt: new Date('2026-09-23'),
        items: [
          { ...base, dueDate: new Date('2026-11-22') },
          { ...base, scopeGhe: 'GHE-Operações', responsible: 'Gerente de Operações', dueDate: null },
        ],
      }],
      obrigatorios: [sobrecarga],
      ghes: [{ ghe: 'GHE-Operações', obrigatorios: [sobrecarga] }],
    });
    await expect(svc.emit(TENANT, 'dossie_tecnico')).rejects.toThrow(/sem responsável, prazo ou evidência esperada/);
  });
});
