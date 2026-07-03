import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  computePreDiagnostic,
  scoreWithMethodology,
  PRE_DIAGNOSTIC_QUESTIONS,
  type CreateDiagnosticLeadRequest,
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
import { loadActiveMethodologyConfig } from './methodology.service';
import { PreliminaryReportsService } from './preliminary-reports.service';
import { ProvisioningService } from './provisioning.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { mailConfigured, sendMail } from '../common/mailer';
import { sendWhatsapp, whatsappConfigured } from '../common/whatsapp';
import { consultarCnpj, grauDeRiscoCnpj } from '../common/cnpj';

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
    const challengesText = (dto.challenges ?? [])
      .map((c) =>
        c === 'Outro' && dto.challengeOther?.trim() ? `Outro: ${dto.challengeOther.trim()}` : c,
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
      notes,
      cnpj: cnpjLimpo,
      cnpjData: (cnpjData as object) ?? undefined,
      riskGrade,
      productId: captureProduct?.id ?? null,
      diagnosticScore: result.score,
      diagnosticResult: result as unknown as object,
    };
    // Dedup por CNPJ: se já existe um lead ABERTO com o mesmo CNPJ, atualiza-o em
    // vez de criar outro card (evita a empresa repetida no funil). Mantém o estágio.
    const dup = await this.findOpenLeadByCnpj(cnpjLimpo);
    const lead = dup
      ? await this.prisma.admin.platformLead.update({
          where: { id: dup.id },
          data: {
            ...base,
            email: base.email ?? dup.email,
            phone: base.phone ?? dup.phone,
            company: base.company ?? dup.company,
          },
        })
      : await this.prisma.admin.platformLead.create({ data: { ...base, stage: 'NOVO' } });

    await this.audit.record({
      action: 'lead.intake',
      target: dto.email?.trim() || name,
      meta: { origin: dto.origin ?? 'lp-diagnostico', score: result.score },
    });

    // Relatório Preliminar automático: gera com IA e envia ao lead por e-mail.
    // Best-effort e em background — NÃO bloqueia a resposta da LP (a IA leva
    // alguns segundos) e nunca derruba o intake se a IA estiver desligada.
    if (lead.email) {
      void this.preliminaryReports
        .generate({ platformLeadId: lead.id })
        .then((r) =>
          this.log.log(
            `Relatório preliminar do lead ${lead.id} (${lead.email}): status=${r.status}`,
          ),
        )
        .catch((e) =>
          this.log.warn(
            `Relatório preliminar automático falhou para ${lead.email}: ${
              e instanceof Error ? e.message : e
            }`,
          ),
        );
    }

    // WhatsApp (VAI) — confirmação + link do e-book. Best-effort: só envia se
    // VAI_API_EMAIL/VAI_API_PASSWORD existirem; nunca bloqueia/derruba o intake.
    if (lead.phone && whatsappConfigured()) {
      const ebookUrl = process.env.EBOOK_URL ?? 'https://crivo.vai-sistema.com/ebook-crivo.pdf';
      void sendWhatsapp({
        to: lead.phone,
        name,
        message:
          `Olá, ${name}! Recebemos seu Diagnóstico Inicial CRIVO™. Em instantes você recebe o ` +
          `Relatório Preliminar. Enquanto isso, baixe o e-book complementar: ${ebookUrl}`,
      })
        .then((r) => this.log.log(`WhatsApp do lead ${lead.id}: ok=${r.ok} provider=${r.provider}`))
        .catch(() => {});
    }

    return { ok: true, result: result as unknown as PreDiagnosticResult };
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
    const updated = await this.prisma.admin.platformLead.update({
      where: { id },
      data: { stage, lostReason: lost },
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

    await this.prisma.admin.platformLead.update({
      where: { id: leadId },
      data: { stage: 'FECHADO', convertedTenantId: result.tenant.id, productId: product.id },
    });
    await this.audit.record({
      action: 'lead.convert',
      actor,
      target: leadId,
      meta: { product: product.name, tenant: result.tenant.slug },
    });

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
      data: { passwordHash: bcrypt.hashSync(tempPassword, 12) },
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
    firstContactedAt: Date | null;
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
      firstContactedAt: l.firstContactedAt?.toISOString() ?? null,
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
  /**
   * Remove leads DUPLICADOS pelo mesmo CNPJ — mantém os já convertidos (têm
   * empresa) e, entre os abertos, o mais avançado/recente; apaga o resto + seus
   * relatórios preliminares. Owner-only.
   */
  async dedupLeads(actor: Actor): Promise<{ ok: true; deleted: number; kept: number }> {
    const STAGE_RANK: Record<string, number> = {
      NOVO: 0, PRE_DIAGNOSTICO: 1, REUNIAO: 1, OPORTUNIDADE: 2, PROPOSTA: 3,
      FECHADO: 4, CONTRATO: 5, ONBOARDING: 6, IMPLANTACAO: 7, ENTREGA: 8,
      SUSTENTACAO: 9, RENOVACAO: 10, UPSELL: 11, PERDIDO: -1,
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
        d.aiSettings = (await tx.aiSettings.deleteMany()).count;
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
