import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { sendMail } from '../common/mailer';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import { AiPromptsService } from './ai-prompts.service';
import { EditableTextsService } from './editable-texts.service';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import {
  MATURITY_LABEL,
  PRE_DIAGNOSTIC_DIMENSION_LABEL,
  type MaturityLevel,
  type PreDiagnosticDimension,
  type PreDiagnosticResult,
  type PreliminaryReportData,
  type LeadEmailAttachmentLine,
  findBandForScore,
  leadEmailSubject,
  renderLeadEmailHtml,
  renderLeadEmailText,
} from '@crivo/types';
import { loadActiveMethodologyConfig } from './methodology.service';
import {
  gerarMapaExecutivoPdf,
  leituraParaBlocos,
  nomeArquivoMapa,
  type DadosMapaExecutivo,
} from './mapa-executivo-pdf';


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
    private readonly prompts: AiPromptsService,
    private readonly texts: EditableTextsService,
    private readonly notifications: NotificationSettingsService,
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
    // As três saídas abaixo lançam ANTES de criar a linha em `preliminary_reports`:
    // sem log, o lead ficava sem relatório, sem registro em banco e sem nenhum
    // rastro do motivo — e quem dispara isto é o intake, em background.
    if (!settings.enabled || !settings.hasKey) {
      this.log.warn(
        `Relatório do lead ${lead.id} não será gerado: IA ${settings.enabled ? 'sem chave' : 'desativada'} nas Configurações de IA.`,
      );
      throw new BadRequestException(
        'IA não está configurada/ativa. Configure em Super Admin · Configurações de IA.',
      );
    }
    // Respeita o escopo de módulos da IA (vazio = todos liberados).
    if (settings.enabledModules.length > 0 && !settings.enabledModules.includes('relatorios')) {
      this.log.warn(
        `Relatório do lead ${lead.id} não será gerado: IA habilitada só para [${settings.enabledModules.join(', ')}], sem "relatorios".`,
      );
      throw new BadRequestException(
        'IA não está habilitada para Relatórios em Configurações de IA (Super Admin).',
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
        promptVersion: await this.prompts.resolveVersionLabel('preliminary_report'),
        status: 'GERANDO',
      },
    });

    let content: string;
    try {
      content = await this.callAi(lead, diagnostic, reportModel);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Falha desconhecida ao gerar relatório.';
      // Gravar `ERRO` no banco não bastava: só quem abrisse o modal daquele lead
      // no CRM veria. Em 24/08 um lead ficou sem nenhum e-mail por "HTTP 429" do
      // provedor de IA e isso não aparecia em lugar nenhum do servidor.
      this.log.error(`IA falhou no relatório do lead ${lead.id} (${reportModel}): ${reason}`);
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
        'O MAPA Executivo CRIVO™ oferece uma leitura preliminar a partir das informações fornecidas e não substitui diagnóstico técnico ou avaliação especializada. Não é avaliação individual de performance nem diagnóstico clínico. Para uma análise completa, agende uma conversa com nosso time.',
      );
      const send = await this.sendEmail({
        to: recipient,
        leadName: lead.name,
        company: lead.company ?? null,
        report: content,
        footer,
        diagnostic,
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
      'O MAPA Executivo CRIVO™ oferece uma leitura preliminar a partir das informações fornecidas e não substitui diagnóstico técnico ou avaliação especializada. Não é avaliação individual de performance nem diagnóstico clínico. Para uma análise completa, agende uma conversa com nosso time.',
    );
    const send = await this.sendEmail({
      to: sendTo,
      leadName: lead?.name ?? 'Cliente',
      company: lead?.company ?? null,
      report: report.content,
      footer,
      diagnostic: (lead?.diagnosticResult as unknown as PreDiagnosticResult) ?? null,
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
    const system = await this.prompts.resolve('preliminary_report');
    const user = buildUserMessage(lead, diagnostic);

    // Relatório é de LEAD da LP (sem tenant) → tenantId null na telemetria.
    const r = await this.ai.chat({
      useCase: 'preliminary_report',
      tenantId: null,
      model,
      temperature: 0.4,
      maxTokens: 2000,
      timeoutMs: 55000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    if (r.ok) return r.content;
    switch (r.kind) {
      case 'no_key':
        throw new Error('Token de IA indisponível.');
      case 'timeout':
        throw new Error(
          'A IA demorou demais para responder. Tente novamente; se persistir, escolha um modelo mais rápido (gpt-4o-mini) em Configurações de IA.',
        );
      case 'http':
        if (r.httpStatus === 401) throw new Error('Token de IA inválido.');
        if (r.httpStatus === 429) throw new Error('Limite da IA excedido. Tente novamente em instantes.');
        throw new Error(`Falha na IA (HTTP ${r.httpStatus}).`);
      case 'empty':
        throw new Error('A IA não retornou conteúdo.');
      default:
        throw new Error(r.message ?? 'Falha de conexão com a IA.');
    }
  }

  // ── E-mail (Resend OU stub log) ──────────────────────────────────────

  private async sendEmail(input: {
    to: string;
    leadName: string;
    company: string | null;
    /**
     * Relatório escrito pela IA. Vai DENTRO do PDF do MAPA — o corpo do e-mail
     * ficou enxuto (índice + leitura + anexos), decisão do cliente em
     * 2026-09-04. Ausente = o PDF usa os blocos determinísticos de reserva.
     */
    report?: string | null;
    footer: string;
    /** Assunto próprio — usado pelo envio de garantia, sem a leitura da IA. */
    subject?: string;
    /** Resultado do MAPA. Presente = o PDF do MAPA Executivo vai anexado. */
    diagnostic?: PreDiagnosticResult | null;
  }): Promise<{ ok: boolean; provider: string; reason?: string }> {
    const subject = input.subject ?? leadEmailSubject(input.company);
    // Push para a equipe CRIVO (self-gate no pushEnabled do painel).
    await this.notifications.dispatchPush('relatorio_preliminar.enviado', {
      title: 'Relatório preliminar enviado',
      body: input.company ? `${input.leadName} — ${input.company}` : input.leadName,
    });

    // Gate de e-mail do painel de Notificações (respeitado no disparo).
    if (!(await this.notifications.isEnabled('relatorio_preliminar.enviado', 'email'))) {
      this.log.warn(
        `E-mail do relatório de "${input.leadName}" desativado no painel de Notificações — não enviado.`,
      );
      return {
        ok: false,
        provider: 'disabled',
        reason: 'Canal de e-mail deste gatilho desativado no painel de Notificações.',
      };
    }

    // O e-book vai ANEXADO neste mesmo e-mail: é a entrega única prometida ao
    // lead (diagnóstico + e-book numa mensagem só). O texto só menciona o anexo
    // quando ele realmente existe — prometer arquivo que não foi era o defeito.
    const ebook = await this.loadEbook();
    // O MAPA Executivo vai como PDF anexo, no layout do modelo aprovado pelo
    // cliente. Antes ele ia só no corpo do e-mail, e as tabelas chegavam em
    // markdown cru no leitor.
    const mapa = input.diagnostic
      ? await this.loadMapaPdf(
          input.diagnostic,
          input.company,
          input.leadName,
          input.report ?? null,
        )
      : null;
    const anexos = [
      ...(mapa ? [{ filename: mapa.filename, content: mapa.content, contentType: 'application/pdf' }] : []),
      ...(ebook ? [{ filename: ebook.filename, content: ebook.content, contentType: 'application/pdf' }] : []),
    ];
    // Só lista o que realmente foi anexado — prometer arquivo ausente era o
    // defeito original desta mensagem.
    const linhasAnexo: LeadEmailAttachmentLine[] = [
      ...(mapa ? [{ label: 'seu Relatório Preliminar do MAPA Executivo CRIVO™' }] : []),
      ...(ebook
        ? [
            {
              label: 'o e-book complementar CRIVO',
              detail:
                'com uma leitura ampliada sobre os temas que estão transformando a gestão das organizações',
            },
          ]
        : []),
    ];
    const corpo = {
      firstName: input.leadName.split(' ')[0] ?? input.leadName,
      company: input.company,
      score: input.diagnostic?.score ?? null,
      bandLabel: mapa?.faixaLabel ?? null,
      attachments: linhasAnexo,
      note: input.footer,
    };
    const result = await sendMail({
      to: input.to,
      subject,
      html: renderLeadEmailHtml(corpo),
      text: renderLeadEmailText(corpo),
      attachments: anexos.length ? anexos : undefined,
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

  /**
   * O e-book complementar, para anexar no e-mail do lead.
   *
   * 1º) o arquivo IMPORTADO no painel (Governança · E-book), lido do banco —
   *     sem ida à rede, é o caminho mais rápido e o mais confiável;
   * 2º) senão, o PDF publicado (EBOOK_URL) por HTTP.
   *
   * Nunca lança. Devolve null quando os dois falham — mas AGORA registra no
   * log: antes os dois `catch` eram mudos e o e-mail saía sem o anexo sem
   * deixar rastro nenhum, que foi exatamente o que o cliente reportou.
   */
  private async loadEbook(): Promise<{ filename: string; content: Buffer } | null> {
    try {
      const imported = await this.prisma.admin.ebookAsset.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
      if (imported) {
        const content = Buffer.from(imported.data, 'base64');
        // `Buffer.from(..., 'base64')` NUNCA falha: base64 truncado ou com
        // prefixo `data:` vira lixo silenciosamente, e o lead recebia um PDF
        // ilegível com o relatório marcado como ENVIADO. Conferir o cabeçalho
        // custa nada e transforma isso num aviso + tentativa pela URL.
        //
        // O piso é deliberadamente baixo (200 bytes): rejeitar um PDF pequeno
        // porém VÁLIDO seria pior que o defeito original — o lead deixaria de
        // receber um anexo que existe. Truncamento real aparece no tamanho
        // registrado na linha de sucesso abaixo.
        if (content.length >= 200 && content.subarray(0, 5).toString('latin1') === '%PDF-') {
          this.log.log(
            `E-book anexado do painel: ${imported.fileName} (${Math.round(content.length / 1024)} KB).`,
          );
          return { filename: imported.fileName, content };
        }
        this.log.warn(
          `E-book do painel (${imported.fileName}) não é um PDF válido — ${content.length} bytes, sem cabeçalho %PDF. Tentando o PDF publicado.`,
        );
      } else {
        this.log.warn(
          'Nenhum e-book importado no painel (Governança · E-book) — tentando o PDF publicado.',
        );
      }
    } catch (e) {
      this.log.warn(
        `E-book do painel indisponível (${e instanceof Error ? e.message : e}) — tentando o PDF publicado.`,
      );
    }

    const url = process.env.EBOOK_URL ?? 'https://crivolegacy.com.br/ebook-crivo.pdf';
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) {
        this.log.warn(`E-book em ${url} respondeu HTTP ${r.status} — e-mail seguirá SEM o anexo.`);
        return null;
      }
      const content = Buffer.from(await r.arrayBuffer());
      if (content.length === 0) {
        this.log.warn(`E-book em ${url} veio vazio — e-mail seguirá SEM o anexo.`);
        return null;
      }
      this.log.log(
        `E-book anexado de ${url} (${Math.round(content.length / 1024)} KB).`,
      );
      return { filename: 'E-book CRIVO.pdf', content };
    } catch (e) {
      this.log.warn(
        `Falha ao buscar o e-book em ${url} (${e instanceof Error ? e.message : e}) — e-mail seguirá SEM o anexo.`,
      );
      return null;
    }
  }

  /**
   * O MAPA Executivo do lead em PDF, no layout do modelo aprovado pelo cliente.
   *
   * As faixas (rotulo e cor) saem da versao ATIVA do PRE_DIAGNOSTIC no Motor de
   * Diagnosticos — o mesmo lugar que o admin edita e que a LP ja usa. Sem
   * metodologia publicada, cai nos rotulos de maturidade embutidos, para o
   * anexo nunca deixar de sair por falta de parametrizacao.
   *
   * Nunca lanca: o e-mail do lead vale mais que o anexo. Falhou, sai sem o PDF
   * (com aviso no log) e o corpo do e-mail nao promete o que nao foi.
   */
  private async loadMapaPdf(
    diagnostic: PreDiagnosticResult,
    empresa: string | null,
    respondente: string,
    /** Relatório da IA, para virar as seções de leitura do PDF. */
    report?: string | null,
  ): Promise<{ filename: string; content: Buffer; faixaLabel: string } | null> {
    try {
      const cfg = await loadActiveMethodologyConfig(this.prisma, 'PRE_DIAGNOSTIC').catch(() => null);
      const bands = cfg?.bands ?? [];
      const rotulos = new Map(
        (cfg?.dimensions ?? []).filter((d) => !d.parentSlug).map((d) => [d.slug, d.label]),
      );

      const faixaDe = (v: number): { label: string; color?: string | null } => {
        const b = bands.length ? findBandForScore(bands, v) : null;
        if (b) return { label: b.label, color: b.color ?? null };
        return { label: MATURITY_LABEL[maturityOfScore(v)] ?? '', color: null };
      };

      const dimensoes = Object.entries(diagnostic.byDimension ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([slug, v]) => {
          const f = faixaDe(v);
          return {
            label:
              rotulos.get(slug) ??
              PRE_DIAGNOSTIC_DIMENSION_LABEL[slug as PreDiagnosticDimension] ??
              slug,
            score: v,
            faixaLabel: f.label,
            faixaColor: f.color,
          };
        });

      const geral = faixaDe(diagnostic.score);
      const faixaLabel = geral.label || (MATURITY_LABEL[diagnostic.level] ?? diagnostic.level);
      const nome = (empresa ?? '').trim() || respondente;
      const data = new Date();

      const dados: DadosMapaExecutivo = {
        empresa: nome,
        respondente,
        data,
        score: diagnostic.score,
        faixaLabel,
        faixaColor: geral.color,
        panorama: panoramaMapa(diagnostic.score, faixaLabel, dimensoes.length),
        dimensoes,
        faixas: bands.length
          ? bands.map((b) => ({ label: b.label, min: b.min, max: b.max, color: b.color ?? null }))
          : [],
        sintese: sinteseMapa(dimensoes),
        caminho: caminhoMapa(dimensoes),
        leitura: report ? leituraParaBlocos(report) : [],
      };

      const content = await gerarMapaExecutivoPdf(dados);
      const filename = nomeArquivoMapa(nome, data);
      this.log.log(`MAPA Executivo anexado: ${filename} (${Math.round(content.length / 1024)} KB).`);
      return { filename, content, faixaLabel };
    } catch (e) {
      this.log.warn(
        `Falha ao gerar o PDF do MAPA Executivo (${e instanceof Error ? e.message : e}) — e-mail seguira SEM o anexo do MAPA.`,
      );
      return null;
    }
  }

  /**
   * Envio de GARANTIA: a leitura do MAPA Executivo + o e-book, sem depender da
   * IA. É o que sai quando a geração do relatório falha ou a IA está desligada
   * — antes, nesses casos, o lead simplesmente não recebia nada, porque o site
   * deixou de mandar o e-mail dele (a entrega é única, por decisão de produto).
   *
   * Best-effort: nunca lança, para não derrubar o intake do lead.
   */
  async sendDiagnosticEmail(platformLeadId: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const lead = await this.prisma.admin.platformLead.findUnique({
        where: { id: platformLeadId },
      });
      const to = lead?.email?.trim();
      // Os dois returns abaixo eram mudos — e são os motivos mais banais de o
      // lead não receber nada. Sem log, pareciam falha de envio.
      if (!lead || !to) {
        this.log.warn(`Lead ${platformLeadId} sem e-mail: leitura do MAPA não enviada.`);
        return { ok: false, reason: 'Lead sem e-mail.' };
      }
      if (!lead.diagnosticResult) {
        this.log.warn(`Lead ${platformLeadId} sem diagnóstico: leitura do MAPA não enviada.`);
        return { ok: false, reason: 'Lead sem diagnóstico.' };
      }

      const footer = await this.texts.render(
        'EMAIL_PRELIMINARY_FOOTER',
        'O MAPA Executivo CRIVO™ oferece uma leitura preliminar a partir das informações fornecidas e não substitui diagnóstico técnico ou avaliação especializada. Não é avaliação individual de performance nem diagnóstico clínico. Para uma análise completa, agende uma conversa com nosso time.',
      );
      const send = await this.sendEmail({
        to,
        leadName: lead.name,
        company: lead.company ?? null,
        footer,
        diagnostic: lead.diagnosticResult as unknown as PreDiagnosticResult,
        subject: leadEmailSubject(lead.company),
      });
      if (send.ok) {
        // O envio de GARANTIA não escrevia nada em banco nem no log quando dava
        // certo: era impossível responder "esse lead recebeu o MAPA?".
        this.log.log(`Leitura do MAPA entregue a ${to} (lead ${platformLeadId}, via ${send.provider}).`);
      } else {
        this.log.warn(`Leitura do MAPA não entregue a ${to}: ${send.reason ?? send.provider}`);
      }
      return { ok: send.ok, reason: send.reason };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Falha ao enviar a leitura do MAPA.';
      this.log.warn(`Envio de garantia do MAPA falhou: ${reason}`);
      return { ok: false, reason };
    }
  }
}

/**
 * Leitura do MAPA em markdown, a partir do diagnóstico já calculado. Mesmo
 * conteúdo que o e-mail do site levava (índice, nível, dimensões e pontos de
 * atenção) — agora do lado da plataforma, que passou a ser a dona do envio.
 */
type DimensaoMapa = DadosMapaExecutivo['dimensoes'][number];

const umaCasa = (n: number) => n.toFixed(1).replace('.', ',');

/** Mesmas fronteiras de `computePreDiagnostic` — usado só quando o Motor não
 *  tem faixas publicadas para o PRE_DIAGNOSTIC. */
function maturityOfScore(score: number): MaturityLevel {
  return score >= 80
    ? 'AVANCADO'
    : score >= 60
      ? 'ESTRUTURADO'
      : score >= 40
        ? 'EM_ESTRUTURACAO'
        : 'INICIAL';
}

/** Texto do bloco "Panorama" — descreve o número, sem prometer conclusão técnica. */
function panoramaMapa(score: number, faixa: string, qtdDimensoes: number): string {
  return (
    `A leitura preliminar da organização aponta índice ${umaCasa(score)} de 100, na faixa ` +
    `"${faixa}". O resultado resume ${qtdDimensoes} dimensões de gestão avaliadas a partir das ` +
    'respostas do MAPA Executivo e indica onde a estrutura já sustenta a operação e onde ela ' +
    'depende de esforço individual para funcionar.'
  );
}

/** Síntese executiva: o que sustenta e o que pressiona, sempre com números. */
function sinteseMapa(dimensoes: DimensaoMapa[]): string {
  if (!dimensoes.length) return 'Sem dimensões avaliadas nesta leitura.';
  const melhor = dimensoes[0];
  const pior = dimensoes[dimensoes.length - 1];
  if (dimensoes.length === 1) {
    return `A leitura concentra-se em ${melhor.label}, com ${umaCasa(melhor.score)} de 100 (${melhor.faixaLabel}).`;
  }
  return (
    `${melhor.label} é hoje o ponto mais sustentado da organização, com ${umaCasa(melhor.score)} ` +
    `de 100 (${melhor.faixaLabel}). No outro extremo, ${pior.label} responde por ` +
    `${umaCasa(pior.score)} de 100 (${pior.faixaLabel}) e é onde a operação mais depende de ` +
    'correção informal. A diferença entre as duas mostra o quanto o resultado atual está ' +
    'apoiado em pessoas, e não em processo.'
  );
}

/** Caminho recomendado: próximo passo concreto, sem prometer conformidade. */
function caminhoMapa(dimensoes: DimensaoMapa[]): string {
  if (!dimensoes.length) {
    return 'Aplique o CRIVO Diagnóstico™ para obter a leitura completa da organização.';
  }
  const pior = dimensoes[dimensoes.length - 1];
  return (
    `Comece por ${pior.label}: é a dimensão de menor sustentação e a que mais devolve resultado ` +
    'no curto prazo. O passo seguinte é aplicar o CRIVO Diagnóstico™ (Essencial ou ' +
    'Organizacional), que amplia esta leitura para o time inteiro, mede os fatores de risco ' +
    'psicossociais e transforma o achado em plano de ação com responsável, prazo e evidência.'
  );
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
// PROMPT — Briefing §5/§7. ⚠️ SUPERSEDIDO: o prompt em produção agora vem da
// Central de Prompts (Configurações de IA → useCase 'preliminary_report',
// padrão em ai-prompt-defaults.ts). Esta função NÃO é mais chamada — mantida
// só como referência histórica; NÃO edite aqui.
// ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  diagnostic: PreDiagnosticResult & { dimensionLabels?: Record<string, string>; levelLabel?: string },
): string {
  // Rótulo da dimensão: prioriza a metodologia ATIVA (Fase 1C); fallback ao padrão.
  const labelOf = (d: string) =>
    diagnostic.dimensionLabels?.[d] ?? PRE_DIAGNOSTIC_DIMENSION_LABEL[d as PreDiagnosticDimension] ?? d;
  const dimsText = (Object.entries(diagnostic.byDimension) as [string, number][])
    .map(([d, v]) => `- ${labelOf(d)}: ${v}`)
    .join('\n');

  return `
Empresa / Líder solicitante: ${lead.name}${lead.company ? ` (${lead.company})` : ''}
Segmento: ${lead.segment ?? 'não informado'}
Porte aproximado: ${lead.employeesCount ?? 'não informado'}

Diagnóstico Inicial (escala 0–100):
- Score geral: ${diagnostic.score}
- Nível de maturidade: ${diagnostic.levelLabel ?? diagnostic.level}
- Dimensão(ões) de maior atenção: ${(diagnostic.topAttentions ?? [diagnostic.topAttention]).map(labelOf).join(', ')}

Pontuações por dimensão:
${dimsText}

Produza agora o Relatório Preliminar CRIVO conforme a estrutura definida.
`.trim();
}


