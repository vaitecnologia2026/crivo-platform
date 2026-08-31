import { describe, expect, it, vi } from 'vitest';
import { ProvisioningService } from './provisioning.service';

/**
 * O e-mail decide a PESSOA no login, e a empresa não é informada ali. Duas
 * contas com o mesmo e-mail deixam a senha desempatando em silêncio — e, se as
 * senhas coincidirem, o login trava as duas. Estes testes garantem que os dois
 * caminhos de provisionamento (criação manual e conversão de lead no CRM)
 * recusam o e-mail repetido ANTES de abrir a transação, para não deixar
 * empresa órfã criada pela metade.
 */

function build(emailOwnerTenantId: string | null) {
  const $transaction = vi.fn(async () => ({
    id: 't1',
    organizationId: 'org-nova',
    slug: 'empresa-nova',
    name: 'Empresa Nova',
    plan: 'BASE',
    status: 'ACTIVE',
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    updatedAt: new Date('2026-08-31T00:00:00.000Z'),
  }));
  const prisma = {
    admin: {
      tenant: { findUnique: vi.fn(async () => null) }, // slug livre
      user: {
        findFirst: vi.fn(async () =>
          emailOwnerTenantId ? { tenantId: emailOwnerTenantId } : null,
        ),
      },
      organization: { findUnique: vi.fn(async () => ({ name: 'CRIVO teste 20 08 2026' })) },
      $transaction,
    },
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new ProvisioningService(prisma as never, audit as never);
  return { service, $transaction, prisma };
}

const doProduto = {
  companyName: 'Empresa Nova',
  adminName: 'Fulano',
  adminEmail: 'rodrigo@exemplo.com',
  plan: 'BASE' as const,
  productId: 'prod-1',
  modules: ['diagnosticos'],
};

const manual = {
  name: 'Empresa Nova',
  adminName: 'Fulano',
  adminEmail: 'rodrigo@exemplo.com',
} as never;

describe('ProvisioningService — e-mail único na plataforma', () => {
  it('conversão de lead: recusa e-mail que já existe em outra empresa', async () => {
    const { service, $transaction } = build('org-antiga');
    await expect(service.provisionFromProduct(doProduto)).rejects.toThrow(
      /já tem acesso à empresa "CRIVO teste 20 08 2026"/,
    );
    // A empresa NÃO pode nascer pela metade quando o admin é recusado.
    expect($transaction).not.toHaveBeenCalled();
  });

  it('criação manual: recusa o mesmo e-mail', async () => {
    const { service, $transaction } = build('org-antiga');
    await expect(service.provision(manual)).rejects.toThrow(/já tem acesso à empresa/);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('a mensagem diz o que fazer (informar outro e-mail)', async () => {
    const { service } = build('org-antiga');
    await expect(service.provisionFromProduct(doProduto)).rejects.toThrow(
      /informe outro e-mail para esta/,
    );
  });

  it('e-mail livre: provisiona normalmente', async () => {
    const { service, $transaction } = build(null);
    const r = await service.provisionFromProduct(doProduto);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(r.adminEmail).toBe('rodrigo@exemplo.com');
    expect(r.tempPassword).toHaveLength(16);
  });

  it('a busca ignora maiúsculas e espaços (o login normaliza igual)', async () => {
    const { service, prisma } = build(null);
    await service.provisionFromProduct({ ...doProduto, adminEmail: '  Rodrigo@Exemplo.COM ' });
    expect(prisma.admin.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'rodrigo@exemplo.com' } }),
    );
  });
});
