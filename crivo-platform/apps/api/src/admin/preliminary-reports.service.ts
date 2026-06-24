import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { sendMail } from '../common/mailer';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import { EditableTextsService } from './editable-texts.service';
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
 * é graceful: usa SMTP (Hostinger) ou Resend, conforme configurado (ver
 * common/mailer); sem provider, marca como PRONTO (não envia) e o operador
 * dispara manualmente depois. Disparo automático no intake do Diagnóstico
 * Inicial da LP (PlatformLeadsService.intakeDiagnostic).
 *
 * Control plane — sem RLS. Acesso restrito ao Super Admin (SuperAdminGuard).
 */
@Injectable()
export class PreliminaryReportsService {
  private readonly log = new Logger(PreliminaryReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiSettingsService,
    private readonly texts: EditableTextsService,
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
    // Relatório é curto (600–900 palavras) → modelo RÁPIDO para caber no limite
    // da função serverless (60s). Mantém o configurado só se for da família "4o"
    // (rápida); gpt-4/gpt-4-turbo legados (lentos → timeout) caem p/ gpt-4o-mini.
    const cfg = settings.model || 'gpt-4o-mini';
    const reportModel = cfg.includes('4o') ? cfg : 'gpt-4o-mini';

    // Cria registro em GERANDO para acompanhamento (UI pode polar).
    const report = await this.prisma.admin.preliminaryReport.create({
      data: {
        platformLeadId: lead.id,
        diagnosticScore: diagnostic.score,
        diagnosticLevel: diagnostic.level,
        diagnosticDimensions: diagnostic.byDimension as unknown as object,
        topAttention: diagnostic.topAttention,
        content: '',
        modelVersion: reportModel,
        promptVersion: PROMPT_VERSION,
        status: 'GERANDO',
      },
    });

    let content: string;
    try {
      content = await this.callAi(lead, diagnostic, reportModel);
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
      // #60 — Rodapé do e-mail editável pelo Super Admin sem deploy.
      const footer = await this.texts.render(
        'EMAIL_PRELIMINARY_FOOTER',
        'Este é um relatório preliminar gerado por IA a partir do Diagnóstico Inicial CRIVO. Não substitui o CRIVO Diagnóstico™ Essencial ou Organizacional, nem é avaliação individual de performance ou diagnóstico clínico. Para análise completa, agende uma conversa com nosso time.',
      );
      const send = await this.sendEmail({
        to: recipient,
        leadName: lead.name,
        company: lead.company ?? null,
        markdown: content,
        footer,
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
    const footer = await this.texts.render(
      'EMAIL_PRELIMINARY_FOOTER',
      'Este é um relatório preliminar gerado por IA a partir do Diagnóstico Inicial CRIVO. Não substitui o CRIVO Diagnóstico™ Essencial ou Organizacional, nem é avaliação individual de performance ou diagnóstico clínico. Para análise completa, agende uma conversa com nosso time.',
    );
    const send = await this.sendEmail({
      to: sendTo,
      leadName: lead?.name ?? 'Cliente',
      company: lead?.company ?? null,
      markdown: report.content,
      footer,
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

    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(55000),
      });
    } catch (e) {
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        throw new Error(
          'A IA demorou demais para responder. Tente novamente; se persistir, escolha um modelo mais rápido (gpt-4o-mini) em Configurações de IA.',
        );
      }
      throw e;
    }

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
    footer: string;
  }): Promise<{ ok: boolean; provider: string; reason?: string }> {
    const subject = input.company
      ? `Seu Relatório Preliminar CRIVO — ${input.company}`
      : 'Seu Relatório Preliminar CRIVO';
    const html = renderEmailHtml(input.leadName, input.markdown, input.footer);

    // #5 — anexa o e-book complementar ao relatório (busca do /public da LP).
    let ebook: Buffer | null = null;
    try {
      const url = process.env.EBOOK_URL ?? 'https://crivo.vai-sistema.com/ebook-crivo.pdf';
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (r.ok) ebook = Buffer.from(await r.arrayBuffer());
    } catch {
      /* segue sem o e-book — nunca trava o envio do relatório */
    }
    const result = await sendMail({
      to: input.to,
      subject,
      html,
      text: input.markdown,
      attachments: ebook
        ? [{ filename: 'E-book CRIVO - Lideranca que sustenta decisoes.pdf', content: ebook, contentType: 'application/pdf' }]
        : undefined,
    });

    if (result.provider === 'stub') {
      // Sem provider: não envia, só registra. Permite operar sem e-mail configurado.
      this.log.warn(
        `Nenhum provider de e-mail configurado. Relatório de "${input.leadName}" não foi enviado a ${input.to}. Configure SMTP_* (Hostinger) ou RESEND_API_KEY.`,
      );
    } else if (!result.ok) {
      this.log.warn(
        `Falha ao enviar relatório de "${input.leadName}" a ${input.to} via ${result.provider}: ${result.reason}`,
      );
    }
    return result;
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
   - 3 itens em bullet. O PRIMEIRO deve transmitir EXATAMENTE esta ideia, sem
     escolher produto: "Com base nas respostas iniciais, a equipe CRIVO poderá
     avaliar o diagnóstico mais adequado para a realidade da empresa."
     PROIBIDO recomendar, citar ou escolher "Diagnóstico Essencial" ou
     "Diagnóstico Organizacional" — essa definição acontece DEPOIS, na análise
     comercial/consultiva da CRIVO, não neste relatório preliminar.
   - Os outros 2 itens: ativação do App CRIVO/ICD, mentoria de liderança ou
     plano de ação, conforme fizer sentido para o quadro observado.
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
- Dimensão(ões) de maior atenção: ${(diagnostic.topAttentions ?? [diagnostic.topAttention]).map((d) => PRE_DIAGNOSTIC_DIMENSION_LABEL[d]).join(', ')}

Pontuações por dimensão:
${dimsText}

Produza agora o Relatório Preliminar CRIVO conforme a estrutura definida.
`.trim();
}

function renderEmailHtml(leadName: string, markdown: string, footer: string): string {
  // Renderização HTML simples — preserva quebras e parágrafos. Não usa lib
  // de markdown para manter o serviço sem dependências adicionais.
  // Escapa entradas controladas (leadName do formulário público, footer do
  // super admin) p/ evitar injeção de HTML no e-mail.
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escaped = esc(markdown);
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
  <p>Olá, ${esc(leadName.split(' ')[0] ?? '')}.</p>
  <p>Segue o <strong>seu Relatório Preliminar CRIVO</strong> — leitura executiva e prioridades.</p>
  <hr style="border:0;border-top:1px solid #e6e3dc;margin:20px 0"/>
  <div><p>${html}</p></div>
  <hr style="border:0;border-top:1px solid #e6e3dc;margin:20px 0"/>
  <p style="font-size:12px;color:#727a8c">${esc(footer)}</p>
</body></html>`.trim();
}
