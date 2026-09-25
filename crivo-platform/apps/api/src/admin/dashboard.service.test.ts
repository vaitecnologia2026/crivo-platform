import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

// Dashboard de Gestão no formato do protótipo Lovable (25/09/2026): KPIs novos
// (leads atendidos, contratos em rascunho, ações atrasadas, novo MRR, em
// renovação), pendências que apontam a tela que resolve, detalhamento dos KPIs
// clicáveis e filtro por consultor.

const DIA = 86_400_000;
const agora = Date.now();
const d = (dias: number) => new Date(agora + dias * DIA);

function build() {
  const leads = [
    { name: 'Ana', company: 'Franquia Alimentação', commercialOwner: 'Consultor A', stage: 'NOVO', origin: 'indicacao', convertedTenantId: null, productId: null, lostReason: null, firstContactedAt: null, createdAt: d(-2), proposedValueCents: null, proposalSentAt: null },
    { name: 'Bia', company: 'Rede Varejo', commercialOwner: 'Consultor B', stage: 'OPORTUNIDADE', origin: 'lp', convertedTenantId: null, productId: null, lostReason: null, firstContactedAt: d(-4), createdAt: d(-5), proposedValueCents: 500000, proposalSentAt: null },
    { name: 'Caio', company: 'Massa', commercialOwner: 'Consultor A', stage: 'ONBOARDING', origin: 'lp', convertedTenantId: 't1', productId: 'p1', lostReason: null, firstContactedAt: d(-9), createdAt: d(-10), proposedValueCents: null, proposalSentAt: d(-8) },
  ];
  const contracts = [
    { productId: 'p1', status: 'ATIVO', endDate: d(20), optionalModules: [], responsible: 'Consultor A', organizationId: 'o1', groupId: null, startDate: d(-3), createdAt: d(-3) },
    { productId: 'p1', status: 'RASCUNHO', endDate: null, optionalModules: [], responsible: null, organizationId: 'o2', groupId: null, startDate: null, createdAt: d(-1) },
  ];
  const prisma = {
    admin: {
      product: { findMany: vi.fn(async () => [{ id: 'p1', name: 'Diagnóstico', monthlyPriceCents: 920000 }]) },
      platformLead: {
        findMany: vi.fn(async (args: { distinct?: string[]; where?: { commercialOwner?: unknown } }) => {
          if (args.distinct) return [{ commercialOwner: 'Consultor A' }, { commercialOwner: 'Consultor B' }];
          const dono = args.where?.commercialOwner;
          return typeof dono === 'string' ? leads.filter((l) => l.commercialOwner === dono) : leads;
        }),
        count: vi.fn(async (args: { where: { stage?: string } }) => (args.where.stage === 'RENOVACAO' ? 2 : 1)),
      },
      contract: { findMany: vi.fn(async () => contracts) },
      tenant: {
        findMany: vi.fn(async () => [
          { id: 't1', organizationId: 'o1', name: 'Massa Ouro', createdAt: d(-9) },
          { id: 't2', organizationId: 'o2', name: 'Cliente Exemplo', createdAt: d(-30) },
        ]),
        findUnique: vi.fn(),
        count: vi.fn(async () => 1),
      },
      assessmentCycle: { count: vi.fn(async () => 1) },
      assessment: { count: vi.fn(async () => 5), groupBy: vi.fn(async () => [{ tenantId: 'o1', _count: { _all: 5 } }]) },
      actionPlan: { count: vi.fn(async () => 1) },
      actionItem: {
        groupBy: vi.fn(async () => [{ status: 'EM_ANDAMENTO', _count: { _all: 2 } }]),
        findMany: vi.fn(async () => [{ action: 'Revisar escala', responsible: 'RH', dueDate: d(-5), tenantId: 'o1' }]),
        count: vi.fn(async () => 1),
      },
      evidence: { count: vi.fn(async (args: { where: { status?: string } }) => (args.where.status === 'REJEITADA' ? 1 : 7)) },
      mentoria: { findMany: vi.fn(async () => []) },
      addon: { findMany: vi.fn(async () => []) },
    },
  };
  return { svc: new DashboardService(prisma as never), prisma };
}

describe('Dashboard de Gestão — modelo do protótipo', () => {
  it('apura os KPIs novos com dado real', async () => {
    const { svc } = build();
    const r = await svc.build(30);
    expect(r.comercial.leadsAtendidos).toBe(2);
    expect(r.contratos.rascunho).toBe(1);
    expect(r.entregas.acoesAtrasadas).toBe(1);
    expect(r.financeiro).toEqual({ receitaContratadaCents: 920000, novoMrrCents: 920000, contratosVencer60: 1, emRenovacao: 2 });
    expect(r.consultores).toEqual(['Consultor A', 'Consultor B']);
    expect(r.comercial.funilEtapas.map((e) => e.label)).toContain('Onboarding');
    expect(r.comercial.funilEtapas.some((e) => e.key === 'PERDIDO')).toBe(false);
  });

  it('pendências trazem frase, área e a tela que resolve', async () => {
    const { svc } = build();
    const { pendencias } = await svc.build(30);
    const porTipo = Object.fromEntries(pendencias.map((p) => [p.tipo, p]));
    expect(porTipo['Contrato em rascunho']).toMatchObject({ secao: 'contratos', texto: 'Contrato de Cliente Exemplo em rascunho aguardando ativação' });
    expect(porTipo['Contrato vencendo']).toMatchObject({ secao: 'contratos', area: 'Contratos' });
    expect(porTipo['Ações atrasadas']).toMatchObject({ secao: 'evolucao', texto: '1 ação do Plano de Ação atrasada' });
    expect(porTipo['Evidência rejeitada']).toMatchObject({ secao: 'evidencias' });
    expect(porTipo['Lead sem 1º contato']).toMatchObject({ secao: 'crm', texto: '1 lead sem 1º contato no período' });
  });

  it('detalhamento lista os registros dos KPIs clicáveis', async () => {
    const { svc } = build();
    const { detalhe } = await svc.build(30);
    expect(detalhe.leads).toHaveLength(3);
    expect(detalhe.leads[1]).toMatchObject({ empresa: 'Rede Varejo', etapa: 'Qualificação', atendido: true });
    expect(detalhe.contratacoes).toEqual([
      expect.objectContaining({ empresa: 'Massa Ouro', solucao: 'Diagnóstico', valorMensalCents: 920000, consultor: 'Consultor A' }),
    ]);
    expect(detalhe.acoesAtrasadas[0]).toMatchObject({ acao: 'Revisar escala', empresa: 'Massa Ouro', diasAtraso: 5 });
  });

  it('filtro de consultor recorta leads e contratos', async () => {
    const { svc, prisma } = build();
    const r = await svc.build(30, { consultor: 'Consultor B' });
    expect(prisma.admin.platformLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ commercialOwner: 'Consultor B' }) }),
    );
    expect(r.comercial.leads).toBe(1);
    expect(r.contratos.ativos).toBe(0); // contrato ativo é do Consultor A
  });

  it('status inválido não vira filtro de etapa', async () => {
    const { svc, prisma } = build();
    await svc.build(30, { status: 'QUALQUER' });
    const where = (prisma.admin.platformLead.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.stage).toBeUndefined();
  });
});
