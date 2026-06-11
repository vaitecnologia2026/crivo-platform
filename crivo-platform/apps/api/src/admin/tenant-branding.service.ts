import { Injectable, NotFoundException } from '@nestjs/common';
import type { TenantBranding } from '@crivo/db';
import type { TenantBrandingData, UpdateBrandingRequest } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';

/** Converte a linha Prisma (ou ausência) no contrato compartilhado (nulls). */
function toBrandingData(b: TenantBranding | null): TenantBrandingData {
  return {
    logoUrl: b?.logoUrl ?? null,
    faviconUrl: b?.faviconUrl ?? null,
    primaryColor: b?.primaryColor ?? null,
    accentColor: b?.accentColor ?? null,
    emailFrom: b?.emailFrom ?? null,
    whatsapp: b?.whatsapp ?? null,
    footerText: b?.footerText ?? null,
  };
}

/**
 * White-label (F5) gerido pelo super admin (control plane). Escreve em
 * tenant_branding via conexão owner (escrita owner-only no rls.sql); a
 * plataforma lê a própria identidade sob RLS (ver /me/branding).
 */
@Injectable()
export class TenantBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string): Promise<TenantBrandingData> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');
    const row = await this.prisma.admin.tenantBranding.findUnique({
      where: { tenantId: tenant.organizationId },
    });
    return toBrandingData(row);
  }

  /** Atualiza (upsert) o branding. Campos ausentes não são alterados. */
  async update(
    tenantId: string,
    dto: UpdateBrandingRequest,
    actor?: AuditActor,
  ): Promise<TenantBrandingData> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');
    const orgId = tenant.organizationId;

    const row = await this.prisma.admin.tenantBranding.upsert({
      where: { tenantId: orgId },
      create: { tenantId: orgId, ...dto },
      update: { ...dto },
    });

    await this.audit.record({
      action: 'tenant.branding.update',
      actor,
      target: tenant.slug,
      tenantId: orgId,
      meta: { fields: Object.keys(dto) },
    });
    return toBrandingData(row);
  }
}
