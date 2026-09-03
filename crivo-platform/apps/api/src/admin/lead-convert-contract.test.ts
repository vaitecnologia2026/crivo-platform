import { describe, expect, it, vi } from 'vitest';
import { PlatformLeadsService } from './platform-leads.service';

/**
 * "Liberar acesso do cliente" no CRM provisiona a empresa, o admin e os módulos,
 * e o modal anuncia "Cliente Habilitado ✓ · sistema liberado". O contrato nascia
 * RASCUNHO — então a tela "Contratos e Liberações", que se apresenta como a fonte
 * de verdade das liberações, dizia o contrário do CRM, e alguém tinha que lembrar
 * de ativar à mão. Estes testes prendem o contrato ATIVO na liberação.
 */

const LEAD_ID = '33333333-3333-3333-3333-333333333333';
const TENANT_ID = '22222222-2222-2222-2222-222222222222';
const PRODUCT_ID = '55555555-5555-5555-5555-555555555555';
const ACTOR = { id: 'super', email: 'super@crivo.platform' };

function build(potentialAddons: string[] = []) {
  const lead = {
    id: LEAD_ID,
    name: 'RODRIGO OLIVEIRA',
    company: 'CRIVO LEGACY',
    email: 'rodrigo@exemplo.com',
    cnpj: null,
    stage: 'PROPOSTA',
    convertedTenantId: null,
    potentialAddons,
  };
  const prisma = {
    admin: {
      platformLead: {
        findUnique: vi.fn(async () => ({ ...lead })),
        update: vi.fn(async () => ({ ...lead })),
      },
      product: {
        findUnique: vi.fn(async () => ({
          id: PRODUCT_ID,
          name: 'CRIVO Organizacional',
          plan: 'BASE',
          modules: ['dashboard'],
          isLeadCapture: false,
        })),
      },
      tenant: { update: vi.fn(async () => ({})) },
    },
  };
  const provisioning = {
    provisionFromProduct: vi.fn(async () => ({
      tenant: { id: TENANT_ID, slug: 'crivo-legacy' },
      adminEmail: lead.email,
      tempPassword: 'x'.repeat(16),
    })),
  };
  const contracts = { upsert: vi.fn(async () => ({})) };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new PlatformLeadsService(
    prisma as never,
    audit as never,
    provisioning as never,
    {} as never, // preliminaryReports — não usado por convert
    contracts as never,
  );
  return { service, contracts, prisma, provisioning };
}

/** O payload que a conversão manda para o contrato. */
async function contractPayload(potentialAddons: string[] = []) {
  const { service, contracts } = build(potentialAddons);
  await service.convert(LEAD_ID, PRODUCT_ID, ACTOR);
  expect(contracts.upsert).toHaveBeenCalledOnce();
  const [tenantId, dto] = contracts.upsert.mock.calls[0] as unknown as [
    string,
    Record<string, unknown>,
  ];
  return { tenantId, dto };
}

describe('convert() — etapa do funil', () => {
  it('libera o acesso e MOVE o lead para "Cliente ativo" (ONBOARDING)', async () => {
    // O lead parava em FECHADO/CONTRATO: o funil mostrava como pendente um
    // cliente que já estava com o sistema liberado e em uso.
    const { service, prisma } = build();

    await service.convert(LEAD_ID, PRODUCT_ID, ACTOR);

    const chamada = prisma.admin.platformLead.update.mock.calls[0] as unknown as
      | [{ data: { stage?: string; convertedTenantId?: string } }]
      | undefined;
    expect(chamada?.[0]?.data?.stage).toBe('ONBOARDING');
    expect(chamada?.[0]?.data?.convertedTenantId).toBe(TENANT_ID);
  });
});

describe('convert() — contrato ativado na liberação', () => {
  it('cria o contrato ATIVO, não RASCUNHO', async () => {
    const { dto } = await contractPayload();
    expect(dto.status).toBe('ATIVO');
  });

  it('grava a solução contratada em solutionIds (e não só productId)', async () => {
    const { dto } = await contractPayload();
    // Sem isso o merge do contrato deixa solutionIds vazio: a ativação não liga
    // módulo nenhum e o portal fica sem o nome da solução no menu.
    expect(dto.solutionIds).toEqual([PRODUCT_ID]);
    expect(dto.productId).toBe(PRODUCT_ID);
  });

  it('abre a vigência no dia da liberação, sem prazo de expiração', async () => {
    const { dto } = await contractPayload();
    expect(typeof dto.startDate).toBe('string');
    expect(Number.isNaN(new Date(dto.startDate as string).getTime())).toBe(false);
    // endDate/accessDays ausentes: contract-access.ts só bloqueia com prazo vencido.
    expect(dto.endDate).toBeUndefined();
    expect(dto.accessDays).toBeUndefined();
  });

  it('usa o Tenant do control plane devolvido pelo provisionamento', async () => {
    const { tenantId } = await contractPayload();
    expect(tenantId).toBe(TENANT_ID);
  });

  it('NÃO libera os "adicionais potenciais" do CRM — só anota para conferência', async () => {
    const { dto } = await contractPayload(['pocket', 'analytics']);
    // Com o contrato ATIVO, qualquer código em optionalModules vira módulo ligado
    // na empresa. Pré-venda não é venda fechada: fica no texto, não no acesso.
    expect(dto.optionalModules).toEqual([]);
    expect(dto.notes).toContain('pocket');
    expect(dto.notes).toContain('analytics');
  });

  it('sem adicionais marcados, a nota não inventa lista', async () => {
    const { dto } = await contractPayload();
    expect(dto.notes).not.toContain('Adicionais negociados');
  });

  it('falha ao ativar o contrato não derruba a liberação já feita', async () => {
    const { service, contracts, provisioning } = build();
    contracts.upsert.mockRejectedValueOnce(new Error('banco fora'));
    const res = await service.convert(LEAD_ID, PRODUCT_ID, ACTOR);
    // A empresa e o acesso já existem — perder o contrato não pode desfazer isso.
    expect(provisioning.provisionFromProduct).toHaveBeenCalledOnce();
    expect(res.tenant.id).toBe(TENANT_ID);
  });
});
