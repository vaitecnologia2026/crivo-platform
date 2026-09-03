import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  computePreDiagnostic,
  scoreWithMethodology,
  PRE_DIAGNOSTIC_QUESTIONS,
  type CreateDiagnosticLeadRequest,
  type LeadUserSummary,
  type MethodologyConfig,
  type Plan,
  type PlatformLeadStage,
  type PlatformLeadSummary,
  type PreDiagnosticResult,
  type ProductDiagnostic,
  type ProvisionResult,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { ContractsService } from './contracts.service';
import { loadActiveMethodologyConfig } from './methodology.service';
import { PreliminaryReportsService } from './preliminary-reports.service';
import { ProvisioningService } from './provisioning.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { mailConfigured, sendMail } from '../common/mailer';
import { sendWhatsapp, whatsappConfigured } from '../common/whatsapp';
import { consultarCnpj, grauDeRiscoCnpj } from '../common/cnpj';
import { ebookPublicUrl } from './ebook.service';

type Actor = { id: string; email: string };

/**
 * CRM do SUPER ADMIN (funil comercial da CRIVO). Os leads nascem do Diagnóstico
 * Inicial da LP (intakeDiagnostic, público) ou de cadastro manual, e pertencem
 * ao super admin — NÃO a uma empresa. Control plane (owner-only): acesso via
 * prisma.admin. Ao fechar a venda, o lead vira Tenant (FASE 3 — conversão).
 */
@Injectable()
export class PlatformLeadsService {
  private readonly log = new Logger(PlatformLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly provisioning: ProvisioningService,
    private readonly preliminaryReports: PreliminaryReportsService,
    private readonly contracts: ContractsService,
  ) {}

  async list(): Promise<PlatformLeadSummary[]> {
    const rows = await this.prisma.admin.platformLead.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((l) => this.toSummary(l));
  }

  /**
   * PÚBLICO — lead da LP SEM diagnóstico (form de contato / e-book). Cria direto
   * no funil do CRM (platform_leads) como NOVO. Rate-limited no controller.
   */
  async intakeLead(dto: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    segment?: string;
    employeesCount?: string;
    origin?: string;
    notes?: string;
  }): Promise<{ ok: true; id: string }> {
    const name = dto.name?.trim() || dto.company?.trim() || dto.email?.trim();
    if (!name) throw new BadRequestException('Informe ao menos nome, empresa ou e-mail.');
    const lead = await this.prisma.admin.platformLead.create({
      data: {
        name,
        company: dto.company?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        segment: dto.segment?.trim() || null,
        employeesCount: dto.employeesCount?.trim() || null,
        origin: dto.origin?.trim() || 'lp',
        notes: dto.notes?.trim() || null,
        stage: 'NOVO',
      },
    });
    await this.audit.record({
      action: 'lead.intake',
      target: dto.email?.trim() || name,
      meta: { origin: dto.origin ?? 'lp', kind: 'form' },
    });
    return { ok: true, id: lead.id };
  }

  /**
   * PÚBLICO — porta de entrada do funil. Recebe o form + respostas do
   * Diagnóstico Inicial, calcula o resultado preliminar e cria o lead NOVO no
   * CRM do super admin, vinculado ao produto de captura (PRÉ-DIAGNÓSTICO).
   */
  /** Lead "aberto" (não convertido, não perdido) com o mesmo CNPJ — para não
   * duplicar o card a cada reenvio/teste do mesmo CNPJ. */
  private findOpenLeadByCnpj(cnpj: string | null) {
    if (!cnpj) return Promise.resolve(null);
    return this.prisma.admin.platformLead.findFirst({
      where: { cnpj, convertedTenantId: null, stage: { not: 'PERDIDO' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async intakeDiagnostic(
    dto: CreateDiagnosticLeadRequest,
  ): Promise<{ ok: true; result: PreDiagnosticResult }> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Nome é obrigatório');

    // Pontuação dirigida pela metodologia ATIVA (Fase 1C) — com fallback ao
    // padrão hardcoded. Armazena um superset compatível: byDimension como Record
    // (slug→valor) + rótulos, para o relatório/CRM antigos seguirem lendo.
    type DiagResult = {
      score: number;
      level: string;
      levelLabel?: string;
      byDimension: Record<string, number>;
      dimensionLabels?: Record<string, string>;
      topAttention: string;
      topAttentions: string[];
    };
    let result: DiagResult;
    try {
      const cfg = await loadActiveMethodologyConfig(this.prisma, 'PRE_DIAGNOSTIC');
      if (cfg) {
        const r = scoreWithMethodology(dto.answers ?? [], cfg);
        const byDimension: Record<string, number> = {};
        const dimensionLabels: Record<string, string> = {};
        for (const d of r.byDimension) {
          byDimension[d.slug] = d.value;
          dimensionLabels[d.slug] = d.label;
        }
        result = {
          score: r.score,
          level: r.levelCode,
          levelLabel: r.levelLabel,
          byDimension,
          dimensionLabels,
          topAttention: r.topAttentions[0] ?? '',
          topAttentions: r.topAttentions,
        };
      } else {
        const r = computePreDiagnostic(dto.answers ?? []);
        result = {
          score: r.score,
          level: r.level,
          byDimension: r.byDimension as Record<string, number>,
          topAttention: r.topAttention,
          topAttentions: r.topAttentions ?? [r.topAttention],
        };
      }
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Respostas do diagnóstico inválidas',
      );
    }

    // Produto de captura (pré-diagnóstico) — origem do lead, se cadastrado.
    const captureProduct = await this.prisma.admin.product.findFirst({
      where: { isLeadCapture: true },
      orderBy: { createdAt: 'asc' },
    });

    // Cargo + principais desafios entram nas observações do lead (visíveis no
    // funil do CRM). Doc do cliente: o lead deve trazer porte/segmento/desafios.
    // O quiz do site mostra o campo livre quando o desafio começa com "Outro"
    // (a opção real é "Outro desafio relevante"); comparar por igualdade exata
    // com 'Outro' descartava silenciosamente o texto digitado pelo lead.
    const challengesText = (dto.challenges ?? [])
      .map((c) =>
        c.startsWith('Outro') && dto.challengeOther?.trim() ? `Outro: ${dto.challengeOther.trim()}` : c,
      )
      .join('; ');
    const noteParts: string[] = [];
    if (dto.role?.trim()) noteParts.push(`Cargo/função: ${dto.role.trim()}`);
    if (challengesText) noteParts.push(`Principais desafios: ${challengesText}`);
    const notes = noteParts.length ? noteParts.join('\n') : null;

    // Enriquecimento por CNPJ (BrasilAPI) — base do grau de risco. Best-effort:
    // se a API falhar/ausente, segue sem (cnpjData null) e não trava o cadastro.
    const cnpjLimpo = (dto.cnpj ?? '').replace(/\D/g, '') || null;
    const cnpjData = await consultarCnpj(cnpjLimpo);
    // Grau de risco = classificação da DIVISÃO CNAE (motor CNAE/NR-1 = fonte única).
    // Fallback p/ a heurística porte×setor se a divisão não estiver cadastrada.
    let riskGrade: string | null = grauDeRiscoCnpj(cnpjData);
    if (cnpjData?.cnaeCodigo != null) {
      const div = String(cnpjData.cnaeCodigo).padStart(7, '0').slice(0, 2);
      const rule = await this.prisma.admin.cnaeDivisionRule.findUnique({
        where: { divisionCode: div },
        select: { preliminaryRiskLevel: true },
      });
      if (rule) riskGrade = rule.preliminaryRiskLevel;
    }

    const base = {
      name,
      company: dto.company?.trim() || cnpjData?.razaoSocial || null,
      email: dto.email?.trim() || null,
      phone: dto.phone?.trim() || null,
      segment: dto.segment?.trim() || null,
      employeesCount: dto.employeesCount?.trim() || null,
      origin: dto.origin?.trim() || 'lp-diagnostico',
      // §11/§15 — qual campanha gerou este lead. Vem da 1a visita da sessao no
      // site; visita direta simplesmente nao traz nada e as colunas ficam nulas.
      utmSource: dto.atribuicao?.utm_source ?? null,
      utmMedium: dto.atribuicao?.utm_medium ?? null,
      utmCampaign: dto.atribuicao?.utm_campaign ?? null,
      utmContent: dto.atribuicao?.utm_content ?? null,
      utmTerm: dto.atribuicao?.utm_term ?? null,
      referrer: dto.atribuicao?.referrer ?? null,
      landingPage: dto.atribuicao?.landing ?? null,
      notes,
      cnpj: cnpjLimpo,
      cnpjData: (cnpjData as object) ?? undefined,
      riskGrade,
      productId: captureProduct?.id ?? null,
      diagnosticScore: result.score,
      diagnosticResult: result as unknown as object,
    };
    // CADA resposta do MAPA Executivo cria um card NOVO, sempre em "Novos"
    // (decisão do cliente em 17/08/2026).
    //
    // Antes havia dedup por CNPJ aqui: existindo um lead ABERTO com o mesmo CNPJ,
    // a resposta ATUALIZAVA aquele card e MANTINHA o estágio dele. A empresa não
    // se repetia no funil, mas quem respondia o MAPA de novo não aparecia como
    // lead novo — o card seguia na coluna em que já estava, e quem olhava "Novos"
    // concluía que o cadastro não tinha entrado.
    //
    // Consequência assumida: a mesma empresa pode ocupar mais de um card. A
    // limpeza continua no botão "Limpar duplicados", no topo do CRM — Funil, que
    // mantém o lead mais avançado de cada CNPJ.
    //
    // `findOpenLeadByCnpj` NÃO foi removido: segue servindo o cadastro por CNPJ
    // do Dashboard (`createFromCnpj`), que não foi tocado.
    const lead = await this.prisma.admin.platformLead.create({
      data: { ...base, stage: 'NOVO' },
    });

    await this.audit.record({
      action: 'lead.intake',
      target: dto.email?.trim() || name,
      meta: { origin: dto.origin ?? 'lp-diagnostico', score: result.score },
    });

    // Relatório Preliminar automático: gera com IA e envia ao lead por e-mail.
    // Best-effort e em background — NÃO bloqueia a resposta da LP (a IA leva
    // alguns segundos) e nunca derruba o intake se a IA estiver desligada.
    if (!lead.email) {
      // Sem e-mail não há o que enviar — mas isso precisa aparecer, senão fica
      // idêntico a uma falha de entrega para quem investiga depois.
      this.log.warn(`Lead ${lead.id} entrou SEM e-mail: nenhum envio ao lead será feito.`);
    }
    if (lead.email) {
      void this.preliminaryReports
        .generate({ platformLeadId: lead.id })
        .then(async (r) => {
          this.log.log(
            `Relatório preliminar do lead ${lead.id} (${lead.email}): status=${r.status}`,
          );
          // Gerou mas não saiu (e-mail recusado, IA em erro): o lead NÃO pode
          // ficar sem nada. A entrega ao lead é única e é da plataforma — o
          // site só envia quando o intake falha —, então aqui vai a leitura do
          // MAPA com o e-book anexado.
          if (r.status !== 'ENVIADO') {
            // O retorno era descartado nos dois pontos — e este é o ÚLTIMO
            // recurso do lead. Se ele falhar em silêncio, ninguém recebe nada e
            // não sobra rastro de que a garantia sequer foi tentada.
            // O try/catch é obrigatório: uma exceção aqui dentro cairia no
            // `.catch` abaixo e dispararia um SEGUNDO envio ao mesmo lead.
            try {
              const fallback = await this.preliminaryReports.sendDiagnosticEmail(lead.id);
              this.logFallback(lead.id, fallback);
            } catch (e) {
              this.log.error(
                `Envio de garantia do lead ${lead.id} lançou: ${e instanceof Error ? e.message : e}`,
              );
            }
          }
        })
        .catch(async (e) => {
          this.log.warn(
            `Relatório preliminar automático falhou para ${lead.email}: ${
              e instanceof Error ? e.message : e
            } — enviando a leitura do MAPA com o e-book.`,
          );
          const fallback = await this.preliminaryReports.sendDiagnosticEmail(lead.id);
          this.logFallback(lead.id, fallback);
        });
    }

    // WhatsApp (VAI) — confirmação + link do e-book. Best-effort: só envia se
    // VAI_API_EMAIL/VAI_API_PASSWORD existirem; nunca bloqueia/derruba o intake.
    if (lead.phone && whatsappConfigured()) {
      // Link do e-book: se o super admin IMPORTOU um arquivo (Governança ·
      // E-book), manda a rota pública — que serve o arquivo importado. Se nada
      // foi importado, mantém EXATAMENTE o link de antes (EBOOK_URL / PDF da
      // LP). A consulta é só de existência: não carrega o base64 à toa.
      let ebookUrl = process.env.EBOOK_URL ?? 'https://crivolegacy.com.br/ebook-crivo.pdf';
      try {
        const imported = await this.prisma.admin.ebookAsset.findFirst({ select: { id: true } });
        if (imported) ebookUrl = ebookPublicUrl();
      } catch {
        /* segue com o link padrão — o WhatsApp nunca trava por causa disto */
      }
      void sendWhatsapp({
        to: lead.phone,
        name,
        message:
          `Olá, ${name}! Recebemos seu Diagnóstico Inicial CRIVO™. Em instantes você recebe o ` +
          `Relatório Preliminar. Enquanto isso, baixe o e-book complementar: ${ebookUrl}`,
      })
        .then((r) =>
          r.ok
            ? this.log.log(`WhatsApp do lead ${lead.id}: ok=true provider=${r.provider}`)
            : this.log.warn(
                `WhatsApp do lead ${lead.id} NÃO saiu (provider=${r.provider})${
                  'reason' in r && r.reason ? `: ${r.reason}` : ''
                }`,
              ),
        )
        // O catch era vazio enquanto o `then` logava: o arquivo mostrava só o
        // que dava certo, e uma exceção do canal sumia por completo.
        .catch((e) =>
          this.log.warn(
            `WhatsApp do lead ${lead.id} falhou: ${e instanceof Error ? e.message : e}`,
          ),
        );
    }

    return { ok: true, result: result as unknown as PreDiagnosticResult };
  }

  /**
   * Resultado do envio de GARANTIA (a leitura do MAPA com o e-book, quando o
   * relatório com IA não saiu). Falha aqui significa lead sem nada: é erro, não
   * aviso — o site deixou de mandar o e-mail dele por decisão de produto.
   */
  private logFallback(leadId: string, r: { ok: boolean; reason?: string }): void {
    if (r.ok) {
      this.log.log(`Envio de garantia do lead ${leadId}: entregue.`);
    } else {
      this.log.error(
        `Envio de garantia do lead ${leadId} FALHOU: ${r.reason ?? 'motivo não informado'} — o lead não recebeu nada.`,
      );
    }
  }

  /**
   * Cria um lead a partir de uma consulta de CNPJ (Dashboard) — sem diagnóstico.
   * Enriquece com os dados cadastrais + grau de risco (divisão CNAE). Se vier
   * `productId`, já converte o lead em empresa-cliente (provisiona o tenant).
   */
  async createFromCnpj(
    dto: { cnpj?: string; numeroColaboradores?: number; name?: string; email?: string; productId?: string },
    actor: Actor,
  ): Promise<{ lead: PlatformLeadSummary } & Partial<ProvisionResult>> {
    const cnpjLimpo = (dto.cnpj ?? '').replace(/\D/g, '') || null;
    if (!cnpjLimpo || cnpjLimpo.length !== 14) throw new BadRequestException('CNPJ inválido.');
    const cnpjData = await consultarCnpj(cnpjLimpo);
    if (!cnpjData) throw new BadRequestException('CNPJ não encontrado ou indisponível no provedor.');

    // Grau de risco pela divisão CNAE (fonte única); fallback heurístico.
    let riskGrade: string | null = grauDeRiscoCnpj(cnpjData);
    if (cnpjData.cnaeCodigo != null) {
      const div = String(cnpjData.cnaeCodigo).padStart(7, '0').slice(0, 2);
      const rule = await this.prisma.admin.cnaeDivisionRule.findUnique({
        where: { divisionCode: div },
        select: { preliminaryRiskLevel: true },
      });
      if (rule) riskGrade = rule.preliminaryRiskLevel;
    }

    const captureProduct = await this.prisma.admin.product.findFirst({
      where: { isLeadCapture: true },
      orderBy: { createdAt: 'asc' },
    });

    const base = {
      name: dto.name?.trim() || cnpjData.razaoSocial || 'Empresa (CNPJ)',
      company: cnpjData.razaoSocial,
      email: dto.email?.trim() || cnpjData.email,
      phone: cnpjData.telefone,
      segment: cnpjData.cnaePrincipal,
      employeesCount: dto.numeroColaboradores != null ? String(dto.numeroColaboradores) : null,
      origin: 'dashboard-cnpj',
      notes: 'Lead criado a partir da consulta de CNPJ no Dashboard.',
      cnpj: cnpjLimpo,
      cnpjData: cnpjData as object,
      riskGrade,
      productId: captureProduct?.id ?? null,
    };
    // Dedup por CNPJ — atualiza o lead aberto existente em vez de duplicar o card.
    const dup = await this.findOpenLeadByCnpj(cnpjLimpo);
    const lead = dup
      ? await this.prisma.admin.platformLead.update({
          where: { id: dup.id },
          data: { ...base, email: base.email ?? dup.email, phone: base.phone ?? dup.phone },
        })
      : await this.prisma.admin.platformLead.create({ data: base });

    if (dto.productId) {
      const prov = await this.convert(lead.id, dto.productId, actor);
      const updated = await this.prisma.admin.platformLead.findUnique({ where: { id: lead.id } });
      return { lead: this.toSummary(updated ?? lead), ...prov };
    }
    return { lead: this.toSummary(lead) };
  }

  async setStage(
    id: string,
    stage: PlatformLeadStage,
    actor: Actor,
    lostReason?: string | null,
  ): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    // O motivo de perda só faz sentido em PERDIDO; ao sair de PERDIDO, limpa.
    const lost = stage === 'PERDIDO' ? (lostReason?.trim() || null) : null;
    // Carimba "proposta enviada" ao entrar em PROPOSTA (se ainda não houver).
    const stampProposal = stage === 'PROPOSTA' && !existing.proposalSentAt;
    const updated = await this.prisma.admin.platformLead.update({
      where: { id },
      data: { stage, lostReason: lost, ...(stampProposal ? { proposalSentAt: new Date() } : {}) },
    });
    await this.audit.record({ action: 'lead.stage', actor, target: id, meta: { stage, lostReason: lost } });
    return this.toSummary(updated);
  }

  /** Registra o 1º contato com o lead (idempotente — não sobrescreve). Mede o
   *  tempo de resposta comercial (lead → 1º contato) no dashboard. */
  async markFirstContact(id: string, actor: Actor): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const updated = existing.firstContactedAt
      ? existing
      : await this.prisma.admin.platformLead.update({
          where: { id },
          data: { firstContactedAt: new Date() },
        });
    if (!existing.firstContactedAt) {
      await this.audit.record({ action: 'lead.first_contact', actor, target: id });
    }
    return this.toSummary(updated);
  }

  /** Registra a origem/canal do lead (Tela 02 [2]) — string livre (canônica ou legada). */
  async setOrigin(id: string, origin: string, actor: Actor): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const value = origin?.trim() || null;
    const updated = await this.prisma.admin.platformLead.update({ where: { id }, data: { origin: value } });
    await this.audit.record({ action: 'lead.origin', actor, target: id, meta: { origin: value } });
    return this.toSummary(updated);
  }

  /** Registra a solução de interesse (Tela 02 [4]) — pré-venda; null limpa. */
  async setInterest(id: string, interestProductId: string | null, actor: Actor): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const value = interestProductId?.trim() || null;
    if (value) {
      const p = await this.prisma.admin.product.findUnique({ where: { id: value }, select: { id: true } });
      if (!p) throw new NotFoundException('Solução não encontrada');
    }
    const updated = await this.prisma.admin.platformLead.update({
      where: { id },
      data: { interestProductId: value },
    });
    await this.audit.record({ action: 'lead.interest', actor, target: id, meta: { interestProductId: value } });
    return this.toSummary(updated);
  }

  /** Registra o follow-up / próxima ação (Tela 02 [5]) — data + nota; ambos limpáveis. */
  async setNextAction(
    id: string,
    nextActionAt: string | null,
    nextActionNote: string | null,
    actor: Actor,
  ): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const at = nextActionAt ? new Date(nextActionAt) : null;
    if (at && Number.isNaN(at.getTime())) throw new BadRequestException('Data inválida');
    const note = nextActionNote?.trim() || null;
    const updated = await this.prisma.admin.platformLead.update({
      where: { id },
      data: { nextActionAt: at, nextActionNote: note },
    });
    await this.audit.record({ action: 'lead.next_action', actor, target: id });
    return this.toSummary(updated);
  }

  /** Dados comerciais do lead (Tela 02 Incluir): responsável, valor proposto,
   *  proposta enviada e adicionais potenciais. Campos omitidos não são alterados;
   *  passar null limpa o campo. */
  async setCommercial(
    id: string,
    input: {
      commercialOwner?: string | null;
      proposedValueCents?: number | null;
      proposalSentAt?: string | null;
      potentialAddons?: string[];
    },
    actor: Actor,
  ): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');

    const data: {
      commercialOwner?: string | null;
      proposedValueCents?: number | null;
      proposalSentAt?: Date | null;
      potentialAddons?: string[];
    } = {};
    if (input.commercialOwner !== undefined) data.commercialOwner = input.commercialOwner?.trim() || null;
    if (input.proposedValueCents !== undefined) {
      data.proposedValueCents = input.proposedValueCents == null ? null : Math.max(0, Math.round(input.proposedValueCents));
    }
    if (input.proposalSentAt !== undefined) {
      if (input.proposalSentAt == null) data.proposalSentAt = null;
      else {
        const at = new Date(input.proposalSentAt);
        if (Number.isNaN(at.getTime())) throw new BadRequestException('Data de proposta inválida');
        data.proposalSentAt = at;
      }
    }
    if (input.potentialAddons !== undefined) {
      data.potentialAddons = input.potentialAddons.map((c) => c.trim()).filter(Boolean).slice(0, 50);
    }

    const updated = await this.prisma.admin.platformLead.update({ where: { id }, data });
    await this.audit.record({ action: 'lead.commercial', actor, target: id });
    return this.toSummary(updated);
  }

  async setNotes(id: string, notes: string, actor: Actor): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const updated = await this.prisma.admin.platformLead.update({
      where: { id },
      data: { notes },
    });
    await this.audit.record({ action: 'lead.notes', actor, target: id });
    return this.toSummary(updated);
  }

  /**
   * FASE 3 — CONVERTE o lead em cliente. Seleciona o produto contratado e o
   * sistema provisiona automaticamente: empresa + admin + módulos liberados do
   * produto. A empresa fica ligada ao produto (perguntas + IA herdadas). O lead
   * vai para FECHADO com convertedTenantId.
   */
  async convert(leadId: string, productId: string, actor: Actor): Promise<ProvisionResult> {
    const lead = await this.prisma.admin.platformLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (lead.convertedTenantId) throw new ConflictException('Lead já convertido em cliente');
    if (!lead.email) throw new BadRequestException('Lead sem e-mail — necessário para criar o acesso do admin');

    const product = await this.prisma.admin.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    if (product.isLeadCapture) {
      throw new BadRequestException('O produto de captura (pré-diagnóstico) não pode ser contratado');
    }

    const result = await this.provisioning.provisionFromProduct({
      companyName: lead.company?.trim() || lead.name,
      adminName: lead.name,
      adminEmail: lead.email,
      plan: (product.plan ?? 'BASE') as Plan,
      productId: product.id,
      modules: Array.isArray(product.modules) ? (product.modules as string[]) : [],
      actor,
    });

    // Carimba o CNPJ da empresa recém-criada (Tela 06 · cadastro do CNPJ). Best-effort.
    if (lead.cnpj) {
      try {
        await this.prisma.admin.tenant.update({ where: { id: result.tenant.id }, data: { cnpj: lead.cnpj } });
      } catch {
        /* não bloqueia a conversão */
      }
    }

    // Não regride a etapa: lead já em CONTRATO/ONBOARDING+ mantém a posição no funil.
    const KEEP_STAGE = ['CONTRATO', 'ONBOARDING', 'IMPLANTACAO', 'ENTREGA', 'SUSTENTACAO', 'RENOVACAO', 'UPSELL'];
    await this.prisma.admin.platformLead.update({
      where: { id: leadId },
      data: {
        stage: KEEP_STAGE.includes(lead.stage) ? lead.stage : 'FECHADO',
        convertedTenantId: result.tenant.id,
        productId: product.id,
      },
    });
    await this.audit.record({
      action: 'lead.convert',
      actor,
      target: leadId,
      meta: { product: product.name, tenant: result.tenant.slug },
    });

    // [3] Caderno Tela 02 — o contrato nasce ATIVO junto com a liberação. Esta é
    // a MESMA ação que o CRM chama de "Liberar acesso do cliente" e que anuncia
    // "Cliente Habilitado ✓ · sistema liberado": deixar o contrato em RASCUNHO
    // fazia a tela "Contratos e Liberações" — que é a fonte de verdade das
    // liberações — contradizer o CRM, e obrigava alguém a lembrar de ativar à mão.
    // Ativo, ele também passa a valer para quem só lê contrato ATIVO (portal,
    // colaboradores, essencial), que antes caíam no produto do tenant por fallback.
    // Prazo, respondentes e integração seguem em branco — o time completa na ficha
    // da empresa. Sem endDate/accessDays o contrato NÃO expira acesso nenhum
    // (contract-access.ts). Best-effort: se falhar, a conversão segue válida (o
    // cliente já está provisionado).
    const negociados = Array.isArray(lead.potentialAddons) ? lead.potentialAddons : [];
    try {
      await this.contracts.upsert(
        result.tenant.id,
        {
          productId: product.id,
          // A solução contratada PRECISA entrar em solutionIds: é dela que saem os
          // módulos ligados na ativação e o nome do produto no menu do portal.
          // Só productId deixava solutionIds vazio (o default do merge é []).
          solutionIds: [product.id],
          status: 'ATIVO',
          model: 'PONTUAL',
          // Início da vigência = o dia da liberação. Sem fim e sem accessDays,
          // então não trava acesso; serve de âncora se o time definir accessDays.
          startDate: new Date().toISOString(),
          // Os "adicionais potenciais" do CRM são lista de PRÉ-VENDA, não venda
          // fechada — e com o contrato ATIVO eles seriam liberados na hora, o que
          // o modal de liberação nem promete (ele fala em "módulos do produto").
          // Ficam anotados para o time confirmar e marcar no contrato.
          optionalModules: [],
          notes:
            `Contrato ativado na liberação do acesso do lead "${lead.name}". ` +
            'Prazo, respondentes e integração técnica a completar.' +
            (negociados.length
              ? ` Adicionais negociados na pré-venda (confirmar antes de liberar): ${negociados.join(', ')}.`
              : ''),
        },
        actor,
      );
    } catch (e) {
      this.log.warn(
        `Não foi possível ativar o contrato na conversão do lead ${leadId}: ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }

    return result;
  }

  /**
   * #12 — "Enviar acesso por e-mail": gera nova senha temporária para o admin do
   * cliente já convertido e envia o acesso (portal + login + senha) por e-mail.
   * Sem provider de e-mail configurado, retorna sent=false (acesso PREPARADO — o
   * admin pode copiar a senha retornada e enviar manualmente). Owner-only.
   */
  async sendAccess(leadId: string, actor: Actor): Promise<{
    sent: boolean; provider: string; to: string; tempPassword: string; reason?: string;
  }> {
    const lead = await this.prisma.admin.platformLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (!lead.convertedTenantId) throw new BadRequestException('Lead ainda não foi convertido em cliente');
    if (!lead.email) throw new BadRequestException('Lead sem e-mail');

    const adminEmail = lead.email.toLowerCase().trim();
    // ATENÇÃO ao "tenant": o admin vive no DATA PLANE, escopado pela Organization
    // (User.tenantId → Organization.id). Mas convertedTenantId guarda o id do
    // registro Tenant do CONTROL PLANE (provisionFromProduct grava result.tenant.id
    // via toTenantSummary → tenant.id), que é DIFERENTE do organizationId. Buscar o
    // user por tenantId = convertedTenantId nunca casa (Tenant.id ≠ Organization.id)
    // → era o 404. Resolve a Organization a partir do Tenant antes de achar o admin;
    // aceita também um id já-Organization (defensivo, caso a semântica mude).
    const tenantRow = await this.prisma.admin.tenant.findFirst({
      where: { OR: [{ id: lead.convertedTenantId }, { organizationId: lead.convertedTenantId }] },
      select: { organizationId: true },
    });
    const organizationId = tenantRow?.organizationId ?? lead.convertedTenantId;
    // (tenantId, email) é único por org → casa exatamente o admin provisionado
    // (provisionFromProduct cria role ADMIN com email = e-mail do lead).
    const admin = await this.prisma.admin.user.findFirst({
      where: { tenantId: organizationId, email: adminEmail },
    });
    if (!admin) throw new NotFoundException('Usuário admin do cliente não encontrado');

    // Gera nova senha temporária e atualiza o hash → o e-mail leva uma senha válida.
    const tempPassword = this.genPassword();
    await this.prisma.admin.user.update({
      where: { id: admin.id },
      // Senha de PRIMEIRO ACESSO: trafega por e-mail e fica visível na tela do
      // super admin, então o portal exige a troca antes de liberar a navegação.
      data: { passwordHash: bcrypt.hashSync(tempPassword, 12), mustChangePassword: true },
    });

    const portalUrl = process.env.PORTAL_URL ?? 'https://app.crivolegacy.com.br';
    // Escapa entradas controladas pelo lead (nome/e-mail) para não injetar HTML no e-mail.
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `
      <h2 style="font-family:Georgia,serif;color:#0d1f3c;margin:0 0 12px">Seu acesso à plataforma CRIVO™</h2>
      <p>Olá, ${esc(lead.name)}. Seu ambiente CRIVO está pronto.</p>
      <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a><br>
         <strong>Login:</strong> ${esc(adminEmail)}<br>
         <strong>Senha temporária:</strong> ${tempPassword}</p>
      <p>Recomendamos alterar a senha no primeiro acesso.</p>
      <p style="color:#6b7280;font-size:12px">CRIVO™ — Decision Intelligence System</p>`;

    let sent = false;
    let provider = 'stub';
    let reason: string | undefined;
    if (mailConfigured()) {
      const res = await sendMail({ to: adminEmail, subject: 'Seu acesso à plataforma CRIVO™', html });
      sent = res.ok;
      provider = res.provider;
      reason = res.reason;
    } else {
      reason = 'email-not-configured';
    }
    await this.audit.record({ action: 'lead.send-access', actor, target: leadId, meta: { to: adminEmail, sent } });
    return { sent, provider, to: adminEmail, tempPassword, reason };
  }

  /** Senha temporária legível (sem caracteres ambíguos). */
  private genPassword(): string {
    const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join('');
  }

  /**
   * Aba "Usuários" (Governança · Papéis & Permissões): cadastro dos leads que
   * vieram do MAPA Executivo + a conta de acesso de cada um, quando já existe.
   *
   * O filtro é `diagnosticScore != null` — e NÃO `origin`. `origin` é string
   * livre e varia por campanha (lp-diagnostico, ITZ, ANUNCIO, OUTRO…), enquanto
   * o score só é gravado por quem de fato RESPONDEU o MAPA Executivo. Filtrar
   * por origem deixaria de fora leads do MAPA capturados por outros canais.
   *
   * Leads não convertidos entram na lista com `account: null` — aparecem no
   * cadastro, mas não têm senha para editar (não existe usuário ainda).
   *
   * Somente leitura; não altera nenhum lead. Owner-only (SuperAdminGuard).
   */
  async listLeadUsers(): Promise<LeadUserSummary[]> {
    const leads = await this.prisma.admin.platformLead.findMany({
      where: { diagnosticScore: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    // convertedTenantId guarda o id do registro Tenant (CONTROL plane), que é
    // DIFERENTE do Organization.id onde o usuário vive (User.tenantId →
    // Organization.id). Resolve os dois numa consulta só; aceita também um id
    // já-Organization (defensivo — mesma tolerância do sendAccess).
    const convertedIds = Array.from(
      new Set(leads.map((l) => l.convertedTenantId).filter((v): v is string => !!v)),
    );
    const orgByAnyId = new Map<string, string>();
    if (convertedIds.length > 0) {
      const tenants = await this.prisma.admin.tenant.findMany({
        where: {
          OR: [{ id: { in: convertedIds } }, { organizationId: { in: convertedIds } }],
        },
        select: { id: true, organizationId: true },
      });
      for (const t of tenants) {
        orgByAnyId.set(t.id, t.organizationId);
        orgByAnyId.set(t.organizationId, t.organizationId);
      }
    }

    // (tenantId, email) casa exatamente o admin provisionado na conversão
    // (provisionFromProduct cria o ADMIN com o e-mail do lead).
    const orgIds = Array.from(new Set(orgByAnyId.values()));
    const users = orgIds.length
      ? await this.prisma.admin.user.findMany({
          where: { tenantId: { in: orgIds } },
          select: {
            id: true,
            tenantId: true,
            email: true,
            name: true,
            role: true,
            active: true,
            createdAt: true,
          },
        })
      : [];
    const userByOrgEmail = new Map<string, (typeof users)[number]>();
    for (const u of users) userByOrgEmail.set(`${u.tenantId}::${u.email.toLowerCase()}`, u);

    return leads.map((l) => {
      const organizationId = l.convertedTenantId
        ? orgByAnyId.get(l.convertedTenantId) ?? l.convertedTenantId
        : null;
      const email = l.email?.toLowerCase().trim() ?? null;
      const u = organizationId && email
        ? userByOrgEmail.get(`${organizationId}::${email}`) ?? null
        : null;
      return {
        leadId: l.id,
        name: l.name,
        company: l.company,
        email: l.email,
        phone: l.phone,
        cnpj: l.cnpj,
        origin: l.origin,
        stage: l.stage as PlatformLeadStage,
        diagnosticScore: l.diagnosticScore,
        convertedTenantId: l.convertedTenantId,
        createdAt: l.createdAt.toISOString(),
        account: u
          ? {
              userId: u.id,
              email: u.email,
              name: u.name,
              role: u.role as NonNullable<LeadUserSummary['account']>['role'],
              active: u.active,
              createdAt: u.createdAt.toISOString(),
            }
          : null,
      };
    });
  }

  /**
   * Aba "Usuários": define MANUALMENTE a senha do usuário de acesso do lead já
   * convertido. Diferente do `sendAccess` (#12), que SORTEIA uma senha e envia
   * por e-mail — aqui o super admin escolhe a senha e repassa como quiser.
   *
   * Incrementa `tokenVersion` para derrubar as sessões antigas do usuário —
   * mesma regra já aplicada na redefinição de senha dos usuários CRIVO
   * (platform-users.service) e na troca de senha do próprio usuário.
   *
   * A senha NUNCA entra no log de auditoria — só o e-mail alvo. Owner-only.
   */
  async setLeadUserPassword(
    leadId: string,
    password: string,
    actor: Actor,
  ): Promise<{ ok: true; email: string }> {
    const lead = await this.prisma.admin.platformLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    if (!lead.convertedTenantId) throw new BadRequestException('Lead ainda não foi convertido em cliente');
    if (!lead.email) throw new BadRequestException('Lead sem e-mail');

    const adminEmail = lead.email.toLowerCase().trim();
    const tenantRow = await this.prisma.admin.tenant.findFirst({
      where: { OR: [{ id: lead.convertedTenantId }, { organizationId: lead.convertedTenantId }] },
      select: { organizationId: true },
    });
    const organizationId = tenantRow?.organizationId ?? lead.convertedTenantId;
    const user = await this.prisma.admin.user.findFirst({
      where: { tenantId: organizationId, email: adminEmail },
    });
    if (!user) throw new NotFoundException('Usuário admin do cliente não encontrado');

    await this.prisma.admin.user.update({
      where: { id: user.id },
      // Definida pelo super admin e repassada por fora: também é senha de
      // primeiro acesso — o cliente troca por uma que só ele conhece.
      data: {
        passwordHash: bcrypt.hashSync(password, 12),
        tokenVersion: { increment: 1 },
        mustChangePassword: true,
      },
    });

    await this.audit.record({
      action: 'lead.user.password',
      actor,
      target: leadId,
      meta: { to: adminEmail, userId: user.id },
    });
    return { ok: true, email: adminEmail };
  }

  private toSummary(l: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    segment: string | null;
    employeesCount: string | null;
    origin: string | null;
    productId: string | null;
    cnpj: string | null;
    riskGrade: string | null;
    cnpjData: unknown;
    diagnosticScore: number | null;
    diagnosticResult: unknown;
    stage: string;
    notes: string | null;
    lostReason: string | null;
    archivedAt: Date | null;
    firstContactedAt: Date | null;
    interestProductId: string | null;
    nextActionAt: Date | null;
    nextActionNote: string | null;
    commercialOwner: string | null;
    proposedValueCents: number | null;
    proposalSentAt: Date | null;
    potentialAddons: string[];
    convertedTenantId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PlatformLeadSummary {
    return {
      id: l.id,
      name: l.name,
      company: l.company,
      email: l.email,
      phone: l.phone,
      segment: l.segment,
      employeesCount: l.employeesCount,
      origin: l.origin,
      productId: l.productId,
      cnpj: l.cnpj,
      riskGrade: l.riskGrade,
      razaoSocial: (l.cnpjData as { razaoSocial?: string } | null)?.razaoSocial ?? null,
      cnpjData: (l.cnpjData as PlatformLeadSummary['cnpjData']) ?? null,
      diagnosticScore: l.diagnosticScore,
      diagnosticResult: (l.diagnosticResult as PreDiagnosticResult | null) ?? null,
      stage: l.stage as PlatformLeadStage,
      notes: l.notes,
      lostReason: l.lostReason,
      archivedAt: l.archivedAt ? l.archivedAt.toISOString() : null,
      firstContactedAt: l.firstContactedAt?.toISOString() ?? null,
      interestProductId: l.interestProductId,
      nextActionAt: l.nextActionAt?.toISOString() ?? null,
      nextActionNote: l.nextActionNote,
      commercialOwner: l.commercialOwner,
      proposedValueCents: l.proposedValueCents,
      proposalSentAt: l.proposalSentAt?.toISOString() ?? null,
      potentialAddons: l.potentialAddons ?? [],
      convertedTenantId: l.convertedTenantId,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }

  /**
   * #3/2C — Instrumento do Diagnóstico Inicial da LP: as perguntas vêm do produto
   * de captura ("Pré-Diagnóstico LP"), permitindo editar o TEXTO no super admin.
   * Faz merge sobre as 10 perguntas padrão (mantém id + dimensão → score intacto):
   * usa o texto do produto quando existir, senão o padrão. Público (sem auth).
   */
  async getLpInstrument(): Promise<{
    questions: { id: number; text: string; dimension: string }[];
    source: 'methodology' | 'product' | 'default';
    methodology: MethodologyConfig | null;
  }> {
    // Fonte da verdade: metodologia ATIVA (Fase 1C). A config segue junto para a
    // LP pontuar client-side com o mesmo motor. Fallback: produto de captura → padrão.
    const cfg = await loadActiveMethodologyConfig(this.prisma, 'PRE_DIAGNOSTIC');
    if (cfg) {
      const questions = cfg.questions.map((q, i) => ({ id: i + 1, text: q.text, dimension: q.dimensionSlug }));
      return { questions, source: 'methodology', methodology: cfg };
    }
    const product = await this.prisma.admin.product.findFirst({
      where: { isLeadCapture: true, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    const diag = (product?.diagnostic as ProductDiagnostic | null) ?? null;
    const productQs = diag?.questions ?? [];
    const textById = new Map(productQs.map((q) => [q.id, q.text]));
    const questions = PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({
      id: q.id,
      text: textById.get(q.id)?.trim() || q.text,
      dimension: q.dimension,
    }));
    return { questions, source: productQs.length > 0 ? 'product' : 'default', methodology: null };
  }

  /**
   * #18 — Zera os DADOS de teste do sistema, numa TRANSAÇÃO ATÔMICA (qualquer erro
   * faz rollback — nunca deixa wipe parcial). Owner-only.
   * APAGA: clientes/tenants (cascade → usuários, decisões, diagnósticos, planos,
   *   evidências, ICD, pocket, campanhas…), leads do CRM, relatórios preliminares,
   *   contratos, config de IA, branding/domínios/módulos por tenant, audit log.
   * MANTÉM: super admins (login), catálogo de PRODUTOS, módulos, permissões/papéis
   *   (RBAC) e textos editáveis (copy). Deixa o sistema "do zero", mas funcional.
   */
  /** Conclui a jornada do lead: sai do kanban (call 14/07). Reversível. */
  async archive(id: string, archived: boolean, actor: Actor) {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const updated = await this.prisma.admin.platformLead.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await this.audit.record({ action: archived ? 'lead.archive' : 'lead.unarchive', actor, target: id, meta: { name: existing.name } });
    return this.toSummary(updated);
  }

  /**
   * Remove leads DUPLICADOS pelo mesmo CNPJ — mantém os já convertidos (têm
   * empresa) e, entre os abertos, o mais avançado/recente; apaga o resto + seus
   * relatórios preliminares. Owner-only.
   */
  async dedupLeads(actor: Actor): Promise<{ ok: true; deleted: number; kept: number }> {
    const STAGE_RANK: Record<string, number> = {
      NOVO: 0, PRE_DIAGNOSTICO: 1, REUNIAO: 1, OPORTUNIDADE: 2, PROPOSTA: 3,
      NEGOCIACAO: 4, FECHADO: 5, CONTRATO: 6, ONBOARDING: 7, IMPLANTACAO: 8,
      ENTREGA: 9, SUSTENTACAO: 10, RENOVACAO: 11, UPSELL: 12, PERDIDO: -1,
    };
    const leads = await this.prisma.admin.platformLead.findMany({ where: { cnpj: { not: null } } });
    const groups = new Map<string, typeof leads>();
    for (const l of leads) {
      const arr = groups.get(l.cnpj!) ?? [];
      arr.push(l);
      groups.set(l.cnpj!, arr);
    }
    const toDelete: string[] = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const open = group.filter((l) => !l.convertedTenantId);
      const hasConverted = group.some((l) => l.convertedTenantId);
      if (hasConverted) {
        // Empresa já é cliente → todos os leads abertos são duplicados.
        toDelete.push(...open.map((l) => l.id));
      } else {
        // Mantém o mais avançado (e, em empate, o mais recente).
        open.sort(
          (a, b) =>
            (STAGE_RANK[b.stage] ?? 0) - (STAGE_RANK[a.stage] ?? 0) ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        );
        toDelete.push(...open.slice(1).map((l) => l.id));
      }
    }
    if (toDelete.length) {
      await this.prisma.admin.preliminaryReport.deleteMany({ where: { platformLeadId: { in: toDelete } } });
      await this.prisma.admin.platformLead.deleteMany({ where: { id: { in: toDelete } } });
    }
    await this.audit.record({ action: 'lead.dedup', actor, target: 'leads', meta: { deleted: toDelete.length } });
    return { ok: true, deleted: toDelete.length, kept: leads.length - toDelete.length };
  }

  async resetTestData(actor: Actor): Promise<{ ok: true; deleted: Record<string, number> }> {
    const db = this.prisma.admin;
    const deleted = await db.$transaction(
      async (tx) => {
        const d: Record<string, number> = {};
        d.preliminaryReports = (await tx.preliminaryReport.deleteMany()).count;
        d.platformLeads = (await tx.platformLead.deleteMany()).count;
        d.contracts = (await tx.contract.deleteMany()).count;
        // ai_settings NÃO é dado de teste: é CONFIGURAÇÃO da plataforma (chave
        // OpenAI/modelo/módulos). Apagar aqui derrubava a geração de relatório
        // toda vez que o cliente zerava a base (a chave sumia). Preservada —
        // como integrações, modelos de contrato e prompts de IA.
        d.tenantModules = (await tx.tenantModule.deleteMany()).count;
        d.tenantBrandings = (await tx.tenantBranding.deleteMany()).count;
        d.tenantDomains = (await tx.tenantDomain.deleteMany()).count;
        d.tenants = (await tx.tenant.deleteMany()).count;
        d.auditLogs = (await tx.auditLog.deleteMany()).count;
        // Organization é a raiz do data-plane: o cascade apaga users, teams, units,
        // companies, decisions, assessments, icd, pocket, action_plans, evidences…
        d.organizations = (await tx.organization.deleteMany()).count;
        return d;
      },
      { timeout: 30000 },
    );
    await this.audit.record({ action: 'system.reset-test-data', actor, target: 'all', meta: deleted });
    this.log.warn(`Base de teste ZERADA por ${actor.email}: ${JSON.stringify(deleted)}`);
    return { ok: true, deleted };
  }
}
