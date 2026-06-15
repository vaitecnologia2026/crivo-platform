import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import {
  PRE_DIAGNOSTIC_DIMENSION_LABEL,
  type MaturityLevel,
  type PreDiagnosticDimension,
  type PreDiagnosticResult,
  type PreliminaryReportData,
} from '@crivo/types';

const PROMPT_VERSION = 'v1';

/**
 * Relatório Preliminar CRIVO (Briefing §5, Portal §7).
 *
 * Geração via IA (mesmo provider configurado para o Copiloto). Envio por e-mail
 * é graceful: se RESEND_API_KEY estiver no env, envia via Resend; senão marca
 * como PRONTO (não envia) e o operador pode disparar manualmente depois.
 *
 * Control plane — sem RLS. Acesso restrito ao Super Admin (SuperAdminGuard).
 */
@Injectable()
export class PreliminaryReportsService {
  private readonly log = new Logger(PreliminaryReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiSettingsService,
  ) {}

  /** Lista os relatórios de um lead. */
  async listByLead(platformLeadId: string): Promise<PreliminaryReportData[]> {
    const rows = await this.prisma.admin.preliminaryReport.findMany({
      where: { platformLeadId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toData);
  }

  async getById(id: string): Promise<PreliminaryReportData> {
    const row = await this.prisma.admin.preliminaryReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Relatório não encontrado.');
    return toData(row);
  }

  /** Gera um novo relatório a partir do diagnóstico do lead.
   *  Pipeline: cria PreliminaryReport(GERANDO) → chama IA → marca PRONTO →
   *  tenta enviar e-mail (best-effort) → marca ENVIADO. Em qualquer falha,
   *  marca ERRO com errorReason e devolve mesmo assim (o operador trata). */
  async generate(input: { platformLeadId: string; sendTo?: string }): Promise<PreliminaryReportData> {
    const lead = await this.prisma.admin.platformLead.findUnique({
      where: { id: input.platformLeadId },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado.');
    if (!lead.diagnosticResult || lead.diagnosticScore == null) {
      throw new BadRequestException(
        'Este lead ainda não tem Diagnóstico Inicial preenchido. Aplique o diagnóstico primeiro.',
      );
    }

    const diagnostic = lead.diagnosticResult as unknown as PreDiagnosticResult;
    const recipient = (input.sendTo ?? lead.email ?? '').trim();

    const settings = await this.ai.get();
    if (!settings.enabled || !settings.hasKey) {
      throw new BadRequestException(
        'IA não está configurada/ativa. Configure em Super Admin · Configurações de IA.',
      );
    }

    // Cria registro em GERANDO para acompanhamento (UI pode polar).
    const report = await this.prisma.admin.preliminaryReport.create({
      data: {
        platformLeadId: lead.id,
        diagnosticScore: diagnostic.score,
        diagnosticLevel: diagnostic.level,
        diagnosticDimensions: diagnostic.byDimension as unknown as object,
        topAttention: diagnostic.topAttention,
        content: '',
        modelVersion: settings.model || 'gpt-4o-mini',
        promptVersion: PROMPT_VERSION,
        status: 'GERANDO',
      },
    });

    let content: string;
    try {
      content = await this.callAi(lead, diagnostic, settings.model || 'gpt-4o-mini');
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Falha desconhecida ao gerar relatório.';
      const errored = await this.prisma.admin.preliminaryReport.update({
        where: { id: report.id },
        data: { status: 'ERRO', errorReason: reason },
      });
      return toData(errored);
    }

    // Persiste conteúdo (PRONTO).
    const ready = await this.prisma.admin.preliminaryReport.update({
      where: { id: report.id },
      data: { status: 'PRONTO', content },
    });

    // Tenta enviar (best-effort).
    if (recipient) {
      const send = await this.sendEmail({
        to: recipient,
        leadName: lead.name,
        company: lead.company ?? null,
        markdown: content,
      });
      const final = await this.prisma.admin.preliminaryReport.update({
        where: { id: report.id },
        data: {
          status: send.ok ? 'ENVIADO' : 'PRONTO',
          sentTo: send.ok ? recipient : null,
          sentAt: send.ok ? new Date() : null,
          emailProvider: send.provider,
          errorReason: send.ok ? null : send.reason,
        },
      });
      return toData(final);
    }
    return toData(ready);
  }

  /** Reenvia um relatório PRONTO ou ENVIADO. */
  async resend(id: string, sendTo: string): Promise<PreliminaryReportData> {
    const report = await this.prisma.admin.preliminaryReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Relatório não encontrado.');
    if (report.status === 'GERANDO') {
      throw new BadRequestException('Relatório ainda está sendo gerado.');
    }
    if (report.status === 'ERRO') {
      throw new BadRequestException('Relatório está em erro. Gere novamente.');
    }
    const lead = await this.prisma.admin.platformLead.findUnique({
      where: { id: report.platformLeadId },
    });
    const send = await this.sendEmail({
      to: sendTo,
      leadName: lead?.name ?? 'Cliente',
      company: lead?.company ?? null,
      markdown: report.content,
    });
    const updated = await this.prisma.admin.preliminaryReport.update({
      where: { id },
      data: {
        status: send.ok ? 'ENVIADO' : 'PRONTO',
        sentTo: send.ok ? sendTo : report.sentTo,
        sentAt: send.ok ? new Date() : report.sentAt,
        emailProvider: send.provider,
        errorReason: send.ok ? null : send.reason,
      },
    });
    return toData(updated);
  }

  // ── IA ────────────────────────────────────────────────────────────────

  private async callAi(
    lead: { name: string; company: string | null; segment: string | null; employeesCount: string | null },
    diagnostic: PreDiagnosticResult,
    model: string,
  ): Promise<string> {
    const key = await this.ai.getApiKey();
    if (!key) throw new Error('Token de IA indisponível.');

    const system = buildSystemPrompt();
    const user = buildUserMessage(lead, diagnostic);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 2400,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('Token de IA inválido.');
      if (res.status === 429) throw new Error('Limite da IA excedido. Tente novamente em instantes.');
      throw new Error(`Falha na IA (HTTP ${res.status}).`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('A IA não retornou conteúdo.');
    return content;
  }

  // ── E-mail (Resend OU stub log) ──────────────────────────────────────

  private async sendEmail(input: {
    to: string;
    leadName: string;
    company: string | null;
    markdown: string;
  }): Promise<{ ok: boolean; provider: string; reason?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM ?? 'CRIVO <noreply@crivolegacy.com.br>';

    if (!apiKey) {
      // Modo stub: não envia, só registra. Permite operar sem provider configurado.
      this.log.warn(
        `RESEND_API_KEY não configurada. Relatório de "${input.leadName}" não foi enviado a ${input.to}. Configure RESEND_API_KEY no env.`,
      );
      return {
        ok: false,
        provider: 'stub',
        reason: 'Envio de e-mail desabilitado (RESEND_API_KEY ausente).',
      };
    }

    const subject = input.company
      ? `Seu Relatório Preliminar CRIVO — ${input.company}`
      : 'Seu Relatório Preliminar CRIVO';
    const html = renderEmailHtml(input.leadName, input.markdown);
    const text = input.markdown;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: input.to, subject, html, text }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        return { ok: false, provider: 'resend', reason: `HTTP ${res.status}: ${detail}` };
      }
      return { ok: true, provider: 'resend' };
    } catch (e) {
      return {
        ok: false,
        provider: 'resend',
        reason: e instanceof Error ? e.message : 'Falha de conexão Resend.',
      };
    }
  }
}

function toData(row: any): PreliminaryReportData {
  return {
    id: row.id,
    platformLeadId: row.platformLeadId,
    diagnosticScore: row.diagnosticScore,
    diagnosticLevel: row.diagnosticLevel as MaturityLevel,
    diagnosticDimensions: row.diagnosticDimensions as Record<PreDiagnosticDimension, number>,
    topAttention: row.topAttention as PreDiagnosticDimension,
    content: row.content,
    modelVersion: row.modelVersion,
    promptVersion: row.promptVersion,
    status: row.status,
    errorReason: row.errorReason,
    sentTo: row.sentTo,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    emailProvider: row.emailProvider,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// PROMPT — Briefing §5/§7. ~150 linhas com regras claras de tom, estrutura
// e disclaimers. Não inventa números; baseia-se exclusivamente nos dados.
// ─────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `
Você é o "Relator Preliminar CRIVO", responsável por produzir um relatório
executivo curto e acionável a partir do Diagnóstico Inicial de uma empresa.

# Quem é a CRIVO
A CRIVO é uma plataforma e metodologia para mapear, sustentar e desenvolver
a qualidade da decisão e da liderança nas organizações. Trabalha com 5
dimensões da maturidade decisória:
- Pressão & Rotina: como a empresa lida com sobrecarga, urgência e ritmo.
- Liderança & Sustentação: clareza de papéis, suporte ao líder, coerência.
- Cultura & Comunicação: confiança, segurança psicológica, fluxo de
  informações.
- Fatores Psicossociais: riscos relacionados ao trabalho (alinhados à NR-1
  do MTE — sem substituir AEP/PGR).
- Governança & Plano de Ação: responsáveis, prazos, evidências e revisão.

# O que você deve produzir
Um RELATÓRIO PRELIMINAR em Markdown (sem código), em português do Brasil,
com a seguinte estrutura — use exatamente esses títulos e ordem:

1. **Leitura Geral** (1 parágrafo)
   - Resuma o nível de maturidade e a leitura executiva.
   - NÃO repita literalmente o nome do nível; explique-o em linguagem do
     negócio.

2. **Onde a empresa está hoje**
   - Tabela em Markdown com as 5 dimensões e suas pontuações.
   - Use 1 frase descritiva por dimensão (clara, prática, sem jargão).

3. **Prioridade do momento**
   - Indique a dimensão de MAIOR ATENÇÃO (a com menor pontuação).
   - Explique o impacto operacional típico dessa lacuna em 2-3 frases.
   - Liste 3 recomendações práticas para os próximos 30 dias.

4. **Sinais Positivos**
   - 2-3 pontos fortes a preservar (use a(s) dimensão(ões) com maior pontuação).

5. **Próximos Passos com a CRIVO**
   - 3 itens em bullet, indicando o que o time CRIVO pode estruturar (ex.:
     campanha de Diagnóstico Essencial, ativação do App CRIVO/ICD, mentoria).
   - NÃO prometa entrega imediata nem prazo específico — fale em termos
     de "podemos estruturar", "podemos avaliar em conjunto".

6. **Limites desta leitura preliminar**
   - Bullets explicando o que ESTE relatório NÃO é:
     - Não é AEP nem PGR;
     - Não substitui Diagnóstico Essencial ou Organizacional;
     - Não é diagnóstico clínico nem avalia pessoas individualmente;
     - É uma leitura preliminar baseada nas respostas do Diagnóstico Inicial.

# Regras de tom e estilo
- Profissional, acolhedor, executivo. Sem alarde, sem suavização excessiva.
- Frases curtas. Voz ativa. Evite "vocês podem" ou "você pode" — fale como
  consultor de confiança: "recomendamos", "vale começar por", "convém revisar".
- Não use emojis. Sem exclamações.
- Não invente nomes, marcos, indicadores, métricas ou números além dos
  fornecidos. Se algo não foi medido, diga isso explicitamente.
- Nada de "score X em uma escala de 100" repetidamente; intercale leituras
  qualitativas e referência ao número quando ajudar.

# Restrições importantes
- NÃO mencione concorrentes nem outros frameworks.
- NÃO dê garantias regulatórias automáticas (NR-1/PGR/AEP).
- NÃO use bordões como "transforme", "revolucionário", "mude para sempre".
- Mantenha o tamanho enxuto: 600 a 900 palavras no total.
`.trim();
}

function buildUserMessage(
  lead: { name: string; company: string | null; segment: string | null; employeesCount: string | null },
  diagnostic: PreDiagnosticResult,
): string {
  const dimsText = (Object.entries(diagnostic.byDimension) as [PreDiagnosticDimension, number][])
    .map(([d, v]) => `- ${PRE_DIAGNOSTIC_DIMENSION_LABEL[d]}: ${v}`)
    .join('\n');

  return `
Empresa / Líder solicitante: ${lead.name}${lead.company ? ` (${lead.company})` : ''}
Segmento: ${lead.segment ?? 'não informado'}
Porte aproximado: ${lead.employeesCount ?? 'não informado'}

Diagnóstico Inicial (escala 0–100):
- Score geral: ${diagnostic.score}
- Nível de maturidade: ${diagnostic.level}
- Dimensão de maior atenção: ${PRE_DIAGNOSTIC_DIMENSION_LABEL[diagnostic.topAttention]}

Pontuações por dimensão:
${dimsText}

Produza agora o Relatório Preliminar CRIVO conforme a estrutura definida.
`.trim();
}

function renderEmailHtml(leadName: string, markdown: string): string {
  // Renderização HTML simples — preserva quebras e parágrafos. Não usa lib
  // de markdown para manter o serviço sem dependências adicionais.
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = escaped
    .replace(/^# (.*)$/gm, '<h2 style="color:#0d1f3c">$1</h2>')
    .replace(/^## (.*)$/gm, '<h3 style="color:#0d1f3c">$1</h3>')
    .replace(/^### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^\* (.*)$/gm, '<li>$1</li>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
  return `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#1c2540;line-height:1.55">
  <p>Olá, ${leadName.split(' ')[0]}.</p>
  <p>Segue o <strong>seu Relatório Preliminar CRIVO</strong> — leitura executiva e prioridades.</p>
  <hr style="border:0;border-top:1px solid #e6e3dc;margin:20px 0"/>
  <div><p>${html}</p></div>
  <hr style="border:0;border-top:1px solid #e6e3dc;margin:20px 0"/>
  <p style="font-size:12px;color:#727a8c">Este é um relatório preliminar gerado a partir do Diagnóstico Inicial CRIVO. Não substitui AEP/PGR nem Diagnóstico Essencial/Organizacional.</p>
</body></html>`.trim();
}
