import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { PublicTenantResolution } from '@crivo/types';
import { DomainsService } from './domains.service';

/**
 * Resolução PÚBLICA de domínio → empresa (F5), usada antes do login para
 * aplicar o white-label (tema/logo) por host. Sem auth (dados não-sensíveis),
 * com rate limit. Vive no módulo Admin porque lê o control plane (owner).
 */
@Controller('public')
export class PublicResolutionController {
  constructor(private readonly domains: DomainsService) {}

  /** GET /api/public/tenant?domain=app.clientex.com → { slug, name, branding }. */
  @Get('tenant')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async resolve(@Query('domain') domain?: string): Promise<PublicTenantResolution> {
    const resolved = domain ? await this.domains.resolve(domain) : null;
    if (!resolved) throw new NotFoundException('Domínio não associado a uma empresa ativa');
    return resolved;
  }
}
