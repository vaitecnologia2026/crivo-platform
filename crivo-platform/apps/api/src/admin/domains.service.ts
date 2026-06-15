import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
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
  return {
    id: d.id,
    domain: d.domain,
    verified: d.verified,
    primary: d.primary,
    verificationToken: d.verificationToken,
    verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
    lastVerifyAttempt: d.lastVerifyAttempt ? d.lastVerifyAttempt.toISOString() : null,
    lastVerifyError: d.lastVerifyError,
  };
}

/** Token TXT de 32 hex chars (~128 bits de entropia). */
function makeVerificationToken(): string {
  return crypto.randomBytes(16).toString('hex');
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
    // Super admin adiciona = já confiável (verified: true). Mas geramos token
    // para permitir verificação DNS manual posterior (auditoria/re-validação).
    await this.prisma.admin.tenantDomain.create({
      data: {
        organizationId: orgId,
        domain,
        verified: true,
        primary: count === 0,
        verificationToken: makeVerificationToken(),
        verifiedAt: new Date(),
      },
    });
    await this.audit.record({ action: 'tenant.domain.add', actor, tenantId: orgId, target: domain });
    return this.list(tenantId);
  }

  /**
   * Verifica posse do domínio via lookup TXT em `_crivo.<domain>`. O cliente
   * publica o token gerado em add() como registro TXT. Update best-effort:
   * - se token bate → verified=true + verifiedAt
   * - se token não bate ou DNS falha → verified=false + lastVerifyError
   * Em qualquer caso, marca lastVerifyAttempt e devolve a lista atualizada.
   */
  async verify(tenantId: string, domainId: string, actor?: AuditActor): Promise<TenantDomainData[]> {
    const orgId = await this.orgIdOf(tenantId);
    const dom = await this.prisma.admin.tenantDomain.findFirst({
      where: { id: domainId, organizationId: orgId },
    });
    if (!dom) throw new NotFoundException('Domínio não encontrado');

    // Garante token (se vier de migration legada, gera agora).
    const token = dom.verificationToken ?? makeVerificationToken();
    if (!dom.verificationToken) {
      await this.prisma.admin.tenantDomain.update({
        where: { id: domainId },
        data: { verificationToken: token },
      });
    }

    const txtHost = `_crivo.${dom.domain}`;
    const now = new Date();
    let verified = false;
    let lastVerifyError: string | null = null;

    try {
      const records = await resolveTxt(txtHost);
      // resolveTxt devolve string[][] (cada TXT pode ter múltiplos chunks).
      const flat = records.map((parts) => parts.join('').trim());
      verified = flat.some((v) => v === token);
      if (!verified) {
        lastVerifyError = `TXT em ${txtHost} não contém o token esperado (encontrados ${flat.length} registros).`;
      }
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      lastVerifyError =
        err.code === 'ENOTFOUND' || err.code === 'ENODATA'
          ? `Nenhum registro TXT encontrado em ${txtHost}.`
          : `Falha na consulta DNS: ${err.message ?? err.code ?? 'erro desconhecido'}.`;
    }

    await this.prisma.admin.tenantDomain.update({
      where: { id: domainId },
      data: {
        verified,
        verifiedAt: verified ? now : dom.verifiedAt,
        lastVerifyAttempt: now,
        lastVerifyError,
      },
    });
    await this.audit.record({
      action: verified ? 'tenant.domain.verify.ok' : 'tenant.domain.verify.fail',
      actor,
      tenantId: orgId,
      target: dom.domain,
      meta: { txtHost, error: lastVerifyError },
    });
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
