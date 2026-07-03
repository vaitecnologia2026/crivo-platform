import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { NotFoundException } from '@nestjs/common';
import { PlatformLeadsService } from './platform-leads.service';

/**
 * Regressão do #12 "Enviar acesso por e-mail" (sendAccess).
 *
 * A ARMADILHA: o admin do cliente vive no DATA PLANE escopado pela Organization
 * (User.tenantId → Organization.id), mas PlatformLead.convertedTenantId guarda o
 * id do registro Tenant do CONTROL PLANE (≠ organizationId). Buscar o user por
 * tenantId = convertedTenantId comparava Organization.id com Tenant.id → nunca
 * casava → 404 "Usuário admin do cliente não encontrado" mesmo com o admin
 * existindo. O fix resolve a Organization a partir do Tenant antes do lookup.
 */

// IDs que tornam o split Organization vs Tenant explícito.
const ORG_ID = '11111111-1111-1111-1111-111111111111'; // Organization.id (data plane)
const TENANT_ID = '22222222-2222-2222-2222-222222222222'; // Tenant.id (control plane)
const LEAD_ID = '33333333-3333-3333-3333-333333333333';
const ADMIN_USER_ID = '44444444-4444-4444-4444-444444444444';
const ADMIN_EMAIL = 'teste@crivolegacy.com.br';

/**
 * Fake do prisma.admin que reflete fielmente o banco provisionado por
 * provisionFromProduct: o user.tenantId = ORG_ID, o Tenant.id = TENANT_ID
 * (com organizationId = ORG_ID), e o lead.convertedTenantId = TENANT_ID.
 */
function buildPrismaFake() {
  const adminUser = {
    id: ADMIN_USER_ID,
    tenantId: ORG_ID, // === Organization.id, NUNCA o Tenant.id
    email: ADMIN_EMAIL,
    name: 'Admin Teste',
    role: 'ADMIN',
    passwordHash: bcrypt.hashSync('senha-antiga', 12),
  };
  const userFindFirst = vi.fn(async ({ where }: { where: { tenantId: string; email: string } }) => {
    // Casa só quando escopado pela Organization (como o banco real).
    if (where.tenantId === adminUser.tenantId && where.email === adminUser.email) return { ...adminUser };
    return null;
  });
  const userUpdate = vi.fn(async ({ data }: { where: { id: string }; data: { passwordHash: string } }) => {
    adminUser.passwordHash = data.passwordHash;
    return { ...adminUser };
  });
  const tenantFindFirst = vi.fn(
    async ({ where }: { where: { OR: { id?: string; organizationId?: string }[] } }) => {
      const val = where.OR[0]?.id ?? where.OR[1]?.organizationId;
      if (val === TENANT_ID || val === ORG_ID) return { organizationId: ORG_ID };
      return null;
    },
  );
  const platformLeadFindUnique = vi.fn(async ({ where }: { where: { id: string } }) => {
    if (where.id !== LEAD_ID) return null;
    return {
      id: LEAD_ID,
      name: 'Empresa Teste',
      email: ADMIN_EMAIL,
      convertedTenantId: TENANT_ID, // exatamente o que convert() grava (result.tenant.id)
    };
  });

  const prisma = {
    admin: {
      platformLead: { findUnique: platformLeadFindUnique },
      tenant: { findFirst: tenantFindFirst },
      user: { findFirst: userFindFirst, update: userUpdate },
    },
  };
  return { prisma, adminUser, userFindFirst, userUpdate, tenantFindFirst };
}

describe('PlatformLeadsService.sendAccess (org vs tenant id)', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Garante o caminho "stub" do mailer (sem provider) → retorna tempPassword
    // sem tentar conexão SMTP/Resend real durante o teste.
    savedEnv = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
    };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function buildService() {
    const { prisma, ...rest } = buildPrismaFake();
    const audit = { record: vi.fn(async () => {}) };
    const service = new PlatformLeadsService(
      prisma as never,
      audit as never,
      {} as never, // provisioning — não usado por sendAccess
      {} as never, // preliminaryReports — não usado por sendAccess
      {} as never, // contracts — não usado por sendAccess
    );
    return { service, audit, prisma, ...rest };
  }

  it('encontra o admin via Organization (não o Tenant.id) e retorna a senha temporária', async () => {
    const { service, userFindFirst, userUpdate, tenantFindFirst } = buildService();

    const res = await service.sendAccess(LEAD_ID, { id: 'super', email: 'super@crivo.platform' });

    // Resolveu a Organization a partir do Tenant (control plane → data plane).
    expect(tenantFindFirst).toHaveBeenCalledOnce();
    // O lookup do user usou o organizationId, NUNCA o convertedTenantId (Tenant.id).
    expect(userFindFirst).toHaveBeenCalledWith({ where: { tenantId: ORG_ID, email: ADMIN_EMAIL } });
    expect(userFindFirst.mock.calls.every(([arg]) => arg.where.tenantId !== TENANT_ID)).toBe(true);
    // Resetou a senha e devolveu a temporária (caminho stub, sem provider).
    expect(res.tempPassword).toHaveLength(16);
    expect(res.to).toBe(ADMIN_EMAIL);
    expect(res.sent).toBe(false);
    expect(res.provider).toBe('stub');
    expect(userUpdate).toHaveBeenCalledOnce();
  });

  it('persiste um hash da NOVA senha temporária retornada', async () => {
    const { service, adminUser } = buildService();

    const res = await service.sendAccess(LEAD_ID, { id: 'super', email: 'super@crivo.platform' });

    // O hash gravado é da senha temporária retornada — o e-mail leva uma senha válida.
    expect(bcrypt.compareSync(res.tempPassword, adminUser.passwordHash)).toBe(true);
    expect(bcrypt.compareSync('senha-antiga', adminUser.passwordHash)).toBe(false);
  });

  it('mantém o 404 quando o tenant convertido não tem usuário admin', async () => {
    const { service, prisma } = buildService();
    // Simula um tenant sem admin: user.findFirst sempre null.
    prisma.admin.user.findFirst = vi.fn(async () => null) as never;

    await expect(
      service.sendAccess(LEAD_ID, { id: 'super', email: 'super@crivo.platform' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
