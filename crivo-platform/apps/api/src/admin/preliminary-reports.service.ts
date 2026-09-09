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
      bandColor: mapa?.faixaColor ?? null,
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
  ): Promise<{
    filename: string;
    content: Buffer;
    faixaLabel: string;
    faixaColor: string | null;
  } | null> {
    try {
      const cfg = await loadActiveMethodologyConfig(this.prisma, 'PRE_DIAGNOSTIC').catch(() => null);
      const bands = cfg?.bands ?? [];
      const topo = (cfg?.dimensions ?? []).filter((d) => !d.parentSlug);
      const rotulos = new Map(topo.map((d) => [d.slug, d.label]));
      // O modelo oficial lista as dimensoes na ordem do questionario, nao por
      // score. Slug fora da metodologia vai para o fim, na ordem em que veio.
      const ordem = new Map(topo.map((d, i) => [d.slug, i]));
      const posicao = (slug: string) => ordem.get(slug) ?? Number.MAX_SAFE_INTEGER;

      const faixaDe = (v: number): { label: string; color?: string | null } => {
        const b = bands.length ? findBandForScore(bands, v) : null;
        if (b) return { label: b.label, color: b.color ?? null };
        return { label: MATURITY_LABEL[maturityOfScore(v)] ?? '', color: null };
      };

      const dimensoes = Object.entries(diagnostic.byDimension ?? {})
        .sort((a, b) => posicao(a[0]) - posicao(b[0]))
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

      const daIa = report ? sinteseECaminhoDaIa(report) : {};
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
        // O MAPA tem a forma do modelo aprovado: dois blocos de prosa. Com a
        // IA ligada é ela quem os escreve; senão valem os determinísticos.
        sintese: daIa.sintese ?? sinteseMapa(dimensoes, bands),
        caminho: daIa.caminho ?? caminhoMapa(dimensoes),
      };

      const content = await gerarMapaExecutivoPdf(dados);
      const filename = nomeArquivoMapa(nome, data);
      this.log.log(`MAPA Executivo anexado: ${filename} (${Math.round(content.length / 1024)} KB).`);
      return { filename, content, faixaLabel, faixaColor: geral.color ?? null };
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

export const umaCasa = (n: number) => n.toFixed(1).replace('.', ',');

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
export function panoramaMapa(score: number, faixa: string, qtdDimensoes: number): string {
  return (
    `A leitura preliminar da organização aponta índice ${umaCasa(score)} de 100, na faixa ` +
    `"${faixa}". O resultado resume ${qtdDimensoes} dimensões de gestão avaliadas a partir das ` +
    'respostas do MAPA Executivo e indica onde a estrutura já sustenta a operação e onde ela ' +
    'depende de esforço individual para funcionar.'
  );
}

/** Síntese executiva: o que sustenta e o que pressiona, sempre com números. */
/**
 * Extrai a Síntese executiva e o Caminho recomendado do texto da IA.
 *
 * Comparação sem acento é dispensável: "ntese" e "aminho" já identificam os
 * dois títulos sem depender de normalização.
 */
function sinteseECaminhoDaIa(markdown: string): { sintese?: string; caminho?: string } {
  const blocos = new Map<string, string[]>();
  let atual = '';
  for (const bruta of markdown.split(/\r?\n/)) {
    const linha = bruta.trim();
    const h = /^#{1,6}\s+(.*)$/.exec(linha) ?? /^\*\*(.+?)\*\*:?$/.exec(linha);
    if (h) {
      atual = (h[1] ?? '').toLowerCase().trim();
      blocos.set(atual, []);
      continue;
    }
    if (!atual || !linha || linha.startsWith('|')) continue;
    blocos.get(atual)?.push(linha.replace(/\*\*(.+?)\*\*/g, '$1'));
  }
  const pega = (chave: string) => {
    for (const [k, v] of blocos) {
      if (k.includes(chave)) return v.join(' ').trim() || undefined;
    }
    return undefined;
  };
  return { sintese: pega('ntese'), caminho: pega('aminho') };
}

/** "A", "A e B", "A, B e C" — enumeração em português, sem vírgula antes do "e". */
export function listarEmPortugues(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * TODAS as dimensões que empatam no extremo pedido.
 *
 * Pegar `sort(...)[0]` escondia empate: com duas dimensões em 87,5 o texto
 * nomeava uma e calava a outra, e o leitor confrontava a tabela — onde as duas
 * aparecem — com uma síntese que só cita metade.
 */
function extremosDoMapa(dimensoes: DimensaoMapa[], lado: 'max' | 'min'): DimensaoMapa[] {
  const alvo = dimensoes.reduce(
    (acc, d) => (lado === 'max' ? Math.max(acc, d.score) : Math.min(acc, d.score)),
    lado === 'max' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  );
  return dimensoes.filter((d) => d.score === alvo);
}

export function sinteseMapa(dimensoes: DimensaoMapa[], faixas: { min: number; max: number }[] = []): string {
  if (!dimensoes.length) return 'Sem dimensões avaliadas nesta leitura.';
  // Melhor e pior saem daqui, nao da posicao no array: desde que o MAPA passou
  // a listar as dimensoes na ordem do questionario, `dimensoes[0]` deixou de
  // ser a de maior nota.
  const melhores = extremosDoMapa(dimensoes, 'max');
  const piores = extremosDoMapa(dimensoes, 'min');
  const melhor = melhores[0];
  const pior = piores[0];
  if (dimensoes.length === 1) {
    return `A leitura concentra-se em ${melhor.label}, com ${umaCasa(melhor.score)} de 100 (${melhor.faixaLabel}).`;
  }
  // Tudo com a mesma nota: não existe "outro extremo" a apontar, e fingir que
  // existe seria inventar um contraste que os números não sustentam.
  if (melhor.score === pior.score) {
    return (
      `As ${dimensoes.length} dimensões avaliadas pontuaram igual, ${umaCasa(melhor.score)} de 100 ` +
      `(${melhor.faixaLabel}) — nesta leitura nenhuma frente se destaca das demais, para melhor ou ` +
      'para pior. O conjunto recomenda compreender causas, contexto e prioridades antes de ' +
      'estruturar intervenções.'
    );
  }
  // Dizer "ponto mais sustentado" de uma dimensão em faixa de atenção era ler
  // como força o que é apenas o menor desgaste. Só a faixa mais alta da régua
  // autoriza a leitura positiva.
  const topo = [...faixas].sort((a, b) => b.max - a.max)[0];
  const forte = topo ? melhor.score >= topo.min : melhor.score >= 80;
  const nomes = (ds: DimensaoMapa[]) => listarEmPortugues(ds.map((d) => d.label));
  const vMelhor = melhores.length > 1;
  const vPior = piores.length > 1;
  return (
    `${nomes(melhores)} ${vMelhor ? 'apresentam' : 'apresenta'} o melhor desempenho ` +
    `${forte ? '' : 'relativo '}do conjunto, ${vMelhor ? 'empatadas em' : 'com'} ` +
    `${umaCasa(melhor.score)} de 100 (${melhor.faixaLabel})` +
    (forte
      ? '. '
      : ` — ainda em faixa que exige atenção, portanto não ${vMelhor ? 'configuram' : 'configura'} ` +
        'ponto forte. ') +
    `No outro extremo, ${nomes(piores)} ${vPior ? 'respondem' : 'responde'} por ` +
    `${umaCasa(pior.score)} de 100 (${pior.faixaLabel})${vPior ? ', também em empate,' : ''} e é aí ` +
    'que a operação mais depende de correção informal. O conjunto recomenda compreender causas, ' +
    'contexto e prioridades antes de estruturar intervenções.'
  );
}

/** Caminho recomendado: próximo passo concreto, sem prometer conformidade. */
export function caminhoMapa(dimensoes: DimensaoMapa[]): string {
  if (!dimensoes.length) {
    return 'Aplique o CRIVO Diagnóstico™ para obter a leitura completa da organização.';
  }
  // Idem sinteseMapa: a ordem de exibicao e a do questionario, e o empate na
  // menor nota nomeia TODAS as dimensoes envolvidas.
  const piores = extremosDoMapa(dimensoes, 'min');
  const proximo =
    'O passo seguinte é aplicar o CRIVO Diagnóstico™ (Essencial ou Organizacional), que amplia ' +
    'esta leitura para o time inteiro, mede os fatores de risco psicossociais e transforma o ' +
    'achado em plano de ação com responsável, prazo e evidência.';
  // Empate geral: mandar "começar por todas" não é recomendação, é lista.
  if (dimensoes.length > 1 && piores.length === dimensoes.length) {
    return (
      `As ${dimensoes.length} dimensões estão no mesmo patamar, ${umaCasa(piores[0].score)} de 100, ` +
      `então não há uma frente isolada por onde começar. ${proximo}`
    );
  }
  const varios = piores.length > 1;
  return (
    `Comece por ${listarEmPortugues(piores.map((d) => d.label))}: ` +
    (varios
      ? 'são as dimensões de menor sustentação, empatadas, e as que mais devolvem resultado no curto prazo. '
      : 'é a dimensão de menor sustentação e a que mais devolve resultado no curto prazo. ') +
    proximo
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
DOIS blocos em Markdown, em português do Brasil, nesta ordem e com exatamente
estes títulos — nada além deles:

## Síntese executiva
Um parágrafo de 4 a 6 frases lendo o conjunto: em que faixa o índice geral
caiu, quantas dimensões estão na mesma faixa, qual dimensão puxa o resultado
para baixo e qual apresenta o melhor desempenho, sempre citando a faixa dessa
dimensão. Se a melhor dimensão NÃO estiver na faixa mais alta da régua, escreva
"melhor desempenho relativo" e diga que ela permanece em faixa que exige
atenção — nunca a trate como ponto forte, sinal positivo ou diferencial.
Encerre indicando o que o conjunto recomenda compreender antes de intervir.

## Caminho recomendado
Um parágrafo de 2 a 4 frases sobre o passo seguinte: aprofundar os sinais
identificados, transformar percepção em prioridade clara, compreender causas e
orientar decisões mais consistentes com a realidade da organização.

# Proibido nesta saída
- Criar qualquer outra seção. Nada de "Leitura Geral", "Sinais Positivos",
  "Próximos Passos", "Limites" ou tabela de dimensões: o documento já traz o
  panorama, a tabela de dimensões e a ressalva, e repetir isso o descaracteriza
  em relação ao modelo aprovado.
- Chamar de ponto forte, sinal positivo, diferencial ou base sólida qualquer
  dimensão que não esteja na faixa mais alta da régua.
- Usar bullets, listas numeradas, tabelas ou títulos além dos dois pedidos.
- Recomendar, citar ou escolher "Diagnóstico Essencial" ou "Diagnóstico
  Organizacional" — essa definição acontece depois, na análise consultiva.
- Prometer conformidade legal, garantia de resultado ou prazo específico.
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


