import { Injectable } from '@nestjs/common';
import {
  DOMINANT_PATTERNS,
  type CopilotoAskRequest,
  type CopilotoAskResponse,
} from '@crivo/types';
import { AiSettingsService } from '../admin/ai-settings.service';
import { AiPromptsService } from '../admin/ai-prompts.service';

const COPILOTO_MODULE_KEYS = ['copiloto', 'lider'];

/**
 * Copiloto CRIVO (Área do Líder · Briefing §6/§7) — apoio reflexivo por IA. Usa a
 * configuração GLOBAL de IA (token OpenAI criptografado do Super Admin). É um
 * copiloto de COERÊNCIA DECISÓRIA (4 Rs), não um diagnóstico de saúde mental.
 * Quando a IA não está configurada/ativa, responde de forma honesta (sem mock).
 */
@Injectable()
export class CopilotoService {
  constructor(
    private readonly ai: AiSettingsService,
    private readonly prompts: AiPromptsService,
  ) {}

  async ask(dto: CopilotoAskRequest, tenantId?: string): Promise<CopilotoAskResponse> {
    const question = dto.question?.trim();
    if (!question) return { ok: false, reason: 'Faça uma pergunta ao copiloto.' };

    const settings = await this.ai.get();
    if (!settings.enabled || !settings.hasKey) {
      return {
        ok: false,
        reason:
          'O Copiloto CRIVO ainda não está ativo. Peça ao administrador para configurar e ativar a IA em Super Admin · Configurações de IA.',
      };
    }
    // Respeita o escopo de módulos definido pelo Super Admin (vazio = liberado).
    if (
      settings.enabledModules.length > 0 &&
      !settings.enabledModules.some((m) => COPILOTO_MODULE_KEYS.includes(m))
    ) {
      return { ok: false, reason: 'A IA não está habilitada para o Copiloto do líder.' };
    }

    const key = await this.ai.getApiKey();
    if (!key) return { ok: false, reason: 'Token de IA indisponível.' };

    // Prompt-base vem da Central de Prompts (Configurações de IA); IA2: + diretrizes
    // aprovadas do cliente (se o produto contratado permitir IA personalizada).
    const base = await this.prompts.resolve('copiloto');
    const directives = await this.ai.buildTenantDirectives(tenantId);
    const system = this.systemPrompt(base, dto.context) + directives;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          temperature: 0.5,
          max_tokens: 600,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: question },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const reason =
          res.status === 401
            ? 'Token de IA inválido. Verifique a configuração no Super Admin.'
            : res.status === 429
              ? 'Limite de uso da IA excedido. Tente novamente em instantes.'
              : `Falha ao consultar a IA (HTTP ${res.status}).`;
        return { ok: false, reason };
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (!answer) return { ok: false, reason: 'A IA não retornou resposta.' };
      return { ok: true, answer };
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Error ? `Falha de conexão com a IA: ${e.message}` : 'Falha de conexão com a IA.',
      };
    }
  }

  private systemPrompt(base: string, context: CopilotoAskRequest['context']): string {
    // `base` = prompt técnico configurável (Central de Prompts). As linhas abaixo
    // são o CONTEXTO dinâmico do líder, anexadas ao prompt.
    const lines = [base];
    if (context?.dominantPattern && DOMINANT_PATTERNS.includes(context.dominantPattern)) {
      lines.push(`Tensão dominante atual do líder: ${context.dominantPattern}.`);
    }
    if (typeof context?.score === 'number') {
      lines.push(`Índice de Coerência Decisória (ICD) atual: ${context.score}/100.`);
    }
    if (context?.dimensions) {
      const dims = Object.entries(context.dimensions)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (dims) lines.push(`Coerência por dimensão (0–100): ${dims}.`);
    }
    return lines.join(' ');
  }
}
