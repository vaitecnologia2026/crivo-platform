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

export type AiChatArgs = {
  useCase: string; // copiloto | preliminary_report | pocket_summary | people_analytics
  tenantId?: string | null; // null = chamada sem tenant (ex.: relatório de lead)
  messages: { role: 'system' | 'user'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormat?: 'json_object';
  model?: string; // override pontual; default = modelo das Configurações de IA
};

export type AiChatResult =
  | { ok: true; content: string; model: string }
  | { ok: false; kind: 'no_key' | 'http' | 'timeout' | 'network' | 'empty'; httpStatus?: number; message?: string };

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

  /**
   * Chamada CENTRAL ao provedor de IA (motor "IA da Plataforma"). Todos os
   * consumidores passam por aqui: um único fetch, com telemetria em
   * ai_call_logs (tokens/latência/erro por chamada — best-effort, nunca
   * derruba a operação). Os GATES de enabled/enabledModules continuam em cada
   * consumidor (mensagens específicas por módulo); aqui é só executar e medir.
   */
  async chat(args: AiChatArgs): Promise<AiChatResult> {
    const key = await this.getApiKey();
    if (!key) return { ok: false, kind: 'no_key' };

    const settings = await this.get();
    const model = args.model || settings.model || 'gpt-4o-mini';
    const started = Date.now();

    const log = (fields: {
      ok: boolean;
      errorReason?: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    }) =>
      this.prisma.admin.aiCallLog
        .create({
          data: {
            tenantId: args.tenantId ?? null,
            useCase: args.useCase,
            model,
            ok: fields.ok,
            errorReason: fields.errorReason ?? null,
            promptTokens: fields.promptTokens ?? null,
            completionTokens: fields.completionTokens ?? null,
            totalTokens: fields.totalTokens ?? null,
            latencyMs: Date.now() - started,
          },
        })
        .catch(() => undefined);

    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
          ...(args.maxTokens !== undefined ? { max_tokens: args.maxTokens } : {}),
          ...(args.responseFormat ? { response_format: { type: args.responseFormat } } : {}),
          messages: args.messages,
        }),
        signal: AbortSignal.timeout(args.timeoutMs ?? 30000),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      const message = e instanceof Error ? e.message : 'Falha de conexão';
      await log({ ok: false, errorReason: timeout ? `timeout ${args.timeoutMs ?? 30000}ms` : message });
      return { ok: false, kind: timeout ? 'timeout' : 'network', message };
    }

    if (!res.ok) {
      await log({ ok: false, errorReason: `HTTP ${res.status}` });
      return { ok: false, kind: 'http', httpStatus: res.status };
    }

    // O corpo também pode falhar (conexão cai no meio, resposta não-JSON, ou o
    // AbortSignal dispara durante a leitura) — sem este guard a exceção escaparia
    // de chat() sem telemetria e viraria 500 em quem não trata (ex.: Copiloto).
    let data: {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    try {
      data = (await res.json()) as typeof data;
    } catch (e) {
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      const message = e instanceof Error ? e.message : 'Resposta ilegível da IA';
      await log({ ok: false, errorReason: `corpo inválido: ${message}` });
      return { ok: false, kind: timeout ? 'timeout' : 'network', message };
    }
    const content = data.choices?.[0]?.message?.content?.trim();
    const usage = {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    };
    if (!content) {
      await log({ ok: false, errorReason: 'resposta vazia', ...usage });
      return { ok: false, kind: 'empty' };
    }
    await log({ ok: true, ...usage });
    return { ok: true, content, model };
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
