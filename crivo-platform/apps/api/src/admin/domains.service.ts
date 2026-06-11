import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantDomain } from '@crivo/db';
import type { PublicTenantResolution, TenantDomainData } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { toBrandingData } from './tenant-branding.service';

/** Normaliza um host: minúsculas, sem protocolo, caminho ou porta. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

function toDomainData(d: TenantDomain): TenantDomainData {
  return { id: d.id, domain: d.domain, verified: d.verified, primary: d.primary };
}

/**
 * Domínios próprios por empresa (F5). tenant_domains é control plane (owner):
 * a resolução por domínio é pré-login (sem tenant no contexto). Gestão pelo
 * super admin; resolução pública expõe só dados não-sensíveis.
 */
@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async orgIdOf(tenantId: string): Promise<string> {
    const tenant = await this.prisma.admin.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Empresa não encontrada');
    return tenant.organizationId;
  }

  async list(tenantId: string): Promise<TenantDomainData[]> {
    const orgId = await this.orgIdOf(tenantId);
    const rows = await this.prisma.admin.tenantDomain.findMany({
      where: { organizationId: orgId },
      orderBy: [{ primary: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDomainData);
  }

  /** Adiciona um domínio. O 1º vira primary; super admin = verified. */
  async add(tenantId: string, rawDomain: string, actor?: AuditActor): Promise<TenantDomainData[]> {
    const orgId = await this.orgIdOf(tenantId);
    const domain = normalizeDomain(rawDomain);
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
      throw new BadRequestException('Domínio inválido');
    }
    const taken = await this.prisma.admin.tenantDomain.findUnique({ where: { domain } });
    if (taken) throw new ConflictException('Domínio já está em uso');

    const count = await this.prisma.admin.tenantDomain.count({ where: { organizationId: orgId } });
    await this.prisma.admin.tenantDomain.create({
      data: { organizationId: orgId, domain, verified: true, primary: count === 0 },
    });
    await this.audit.record({ action: 'tenant.domain.add', actor, tenantId: orgId, target: domain });
    return this.list(tenantId);
  }

  async remove(tenantId: string, domainId: string, actor?: AuditActor): Promise<TenantDomainData[]> {
    const orgId = await this.orgIdOf(tenantId);
    const dom = await this.prisma.admin.tenantDomain.findFirst({
      where: { id: domainId, organizationId: orgId },
    });
    if (!dom) throw new NotFoundException('Domínio não encontrado');
    await this.prisma.admin.tenantDomain.delete({ where: { id: domainId } });
    await this.audit.record({ action: 'tenant.domain.remove', actor, tenantId: orgId, target: dom.domain });
    return this.list(tenantId);
  }

  /** Define o domínio canônico (primary), desmarcando os demais da empresa. */
  async setPrimary(tenantId: string, domainId: string, actor?: AuditActor): Promise<TenantDomainData[]> {
    const orgId = await this.orgIdOf(tenantId);
    const dom = await this.prisma.admin.tenantDomain.findFirst({
      where: { id: domainId, organizationId: orgId },
    });
    if (!dom) throw new NotFoundException('Domínio não encontrado');
    await this.prisma.admin.$transaction([
      this.prisma.admin.tenantDomain.updateMany({
        where: { organizationId: orgId },
        data: { primary: false },
      }),
      this.prisma.admin.tenantDomain.update({ where: { id: domainId }, data: { primary: true } }),
    ]);
    await this.audit.record({ action: 'tenant.domain.primary', actor, tenantId: orgId, target: dom.domain });
    return this.list(tenantId);
  }

  /**
   * Resolução PÚBLICA (pré-login): host → empresa + branding. Só resolve tenant
   * ACTIVE. Retorna null se o domínio não existir ou a empresa não estiver ativa.
   */
  async resolve(rawHost: string): Promise<PublicTenantResolution | null> {
    const domain = normalizeDomain(rawHost);
    if (!domain) return null;
    const dom = await this.prisma.admin.tenantDomain.findUnique({ where: { domain } });
    if (!dom) return null;

    const tenant = await this.prisma.admin.tenant.findUnique({
      where: { organizationId: dom.organizationId },
    });
    if (!tenant || tenant.status !== 'ACTIVE') return null;

    const branding = await this.prisma.admin.tenantBranding.findUnique({
      where: { tenantId: dom.organizationId },
    });
    return { slug: tenant.slug, name: tenant.name, branding: toBrandingData(branding) };
  }
}
