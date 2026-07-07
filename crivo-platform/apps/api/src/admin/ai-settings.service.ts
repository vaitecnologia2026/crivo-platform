import { Injectable } from '@nestjs/common';
import type {
  AiSettingsData,
  AiTestResult,
  UpsertAiSettingsRequest,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { decryptSecret, encryptSecret, hintOf } from './secret-crypto';
import { formatAiDirectives } from './ai-directives';

type Actor = { id: string; email: string };

/**
 * Configuração GLOBAL de IA (Super Admin · auditoria 2.3.1). Token OpenAI
 * criptografado em repouso, nunca retornado em claro. Permite escolher modelo,
 * ativar/desativar, definir quais módulos podem usar IA e testar a conexão.
 * Control plane (owner-only). Prompts por produto vivem em Product.aiConfig.
 */
@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async row() {
    return this.prisma.admin.aiSettings.findUnique({ where: { scope: 'global' } });
  }

  /** Config para exibição — SEM o token (só máscara + hasKey). */
  async get(): Promise<AiSettingsData> {
    const r = await this.row();
    return {
      provider: r?.provider ?? 'openai',
      model: r?.model ?? 'gpt-4o-mini',
      enabled: r?.enabled ?? false,
      enabledModules: Array.isArray(r?.enabledModules) ? (r!.enabledModules as string[]) : [],
      hasKey: !!r?.apiKeyEnc,
      keyHint: r?.apiKeyHint ?? null,
      lastStatus: r?.lastStatus ?? null,
      lastTestedAt: r?.lastTestedAt?.toISOString() ?? null,
    };
  }

  /**
   * IA2 (Caderno §10) — diretrizes APROVADAS do cliente para a IA personalizada.
   * Resolve o produto contratado pela empresa (organizationId = tenant do data
   * plane) → `Product.aiConfig` → bloco de contexto para anexar ao prompt técnico
   * fixo. Aditivo e permissivo: retorna '' se não houver contrato/produto/config
   * ou em qualquer falha (nunca quebra a IA; nunca deixa o cliente editar o prompt
   * técnico — só objetivo/regras/base/limitações aprovadas).
   */
  async buildTenantDirectives(organizationId?: string | null): Promise<string> {
    if (!organizationId) return '';
    try {
      const contract = await this.prisma.admin.contract.findFirst({
        where: { organizationId, status: { in: ['ATIVO', 'RASCUNHO'] } },
        orderBy: { updatedAt: 'desc' },
        select: { productId: true },
      });
      if (!contract?.productId) return '';
      const product = await this.prisma.admin.product.findUnique({
        where: { id: contract.productId },
        select: { aiConfig: true, allowsCustomAi: true },
      });
      // IA personalizada só quando o produto permite (allowsCustomAi) — senão o
      // aiConfig fica ignorado (a IA padrão do CRIVO segue funcionando normal).
      if (!product?.allowsCustomAi) return '';
      return formatAiDirectives(product.aiConfig);
    } catch {
      return '';
    }
  }

  /** Token decifrado — uso interno (test + futuros módulos de IA). */
  async getApiKey(): Promise<string | null> {
    const r = await this.row();
    if (!r?.apiKeyEnc || !r.apiKeyIv || !r.apiKeyTag) return null;
    try {
      return decryptSecret({ enc: r.apiKeyEnc, iv: r.apiKeyIv, tag: r.apiKeyTag });
    } catch {
      return null;
    }
  }

  async update(dto: UpsertAiSettingsRequest, actor: Actor): Promise<AiSettingsData> {
    const existing = await this.row();

    // Token: undefined = manter; '' = limpar; valor = criptografar.
    let keyFields: Record<string, string | null> | undefined;
    if (dto.apiKey !== undefined) {
      if (dto.apiKey.trim() === '') {
        keyFields = { apiKeyEnc: null, apiKeyIv: null, apiKeyTag: null, apiKeyHint: null };
      } else {
        const e = encryptSecret(dto.apiKey.trim());
        keyFields = { apiKeyEnc: e.enc, apiKeyIv: e.iv, apiKeyTag: e.tag, apiKeyHint: hintOf(dto.apiKey.trim()) };
      }
    }

    const data = {
      model: dto.model ?? existing?.model ?? 'gpt-4o-mini',
      enabled: dto.enabled ?? existing?.enabled ?? false,
      enabledModules: (dto.enabledModules ?? (existing?.enabledModules as string[]) ?? []) as object,
      ...(keyFields ?? {}),
      // novo token → status volta a "untested" até testar de novo
      ...(keyFields && keyFields.apiKeyEnc !== undefined ? { lastStatus: keyFields.apiKeyEnc ? 'untested' : null } : {}),
    };

    if (existing) {
      await this.prisma.admin.aiSettings.update({ where: { scope: 'global' }, data });
    } else {
      await this.prisma.admin.aiSettings.create({ data: { scope: 'global', provider: 'openai', ...data } });
    }

    await this.audit.record({
      action: 'ai.config.update',
      actor,
      meta: { model: data.model, enabled: data.enabled, keyChanged: keyFields !== undefined },
    });

    return this.get();
  }

  /** Testa a conexão com a OpenAI (token informado ou armazenado). */
  async test(apiKey: string | undefined, actor: Actor): Promise<AiTestResult> {
    const key = apiKey?.trim() || (await this.getApiKey());
    if (!key) return { ok: false, status: 'invalid', message: 'Nenhum token configurado.' };

    let status: string;
    let message: string | undefined;
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) status = 'ok';
      else if (res.status === 401) { status = 'invalid'; message = 'Token inválido ou sem permissão.'; }
      else if (res.status === 429) { status = 'rate_limited'; message = 'Limite de uso excedido.'; }
      else { status = 'error'; message = `HTTP ${res.status}`; }
    } catch (e) {
      status = 'error';
      message = e instanceof Error ? e.message : 'Falha de conexão';
    }

    // Persiste o status do último teste (se já existe config).
    await this.prisma.admin.aiSettings
      .update({ where: { scope: 'global' }, data: { lastStatus: status, lastTestedAt: new Date() } })
      .catch(() => undefined);

    await this.audit.record({ action: 'ai.test', actor, meta: { status } });
    return { ok: status === 'ok', status, message };
  }
}
