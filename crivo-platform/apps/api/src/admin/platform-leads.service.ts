import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  computePreDiagnostic,
  PRE_DIAGNOSTIC_QUESTIONS,
  type CreateDiagnosticLeadRequest,
  type Plan,
  type PlatformLeadStage,
  type PlatformLeadSummary,
  type PreDiagnosticResult,
  type ProductDiagnostic,
  type ProvisionResult,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
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
  async intakeDiagnostic(
    dto: CreateDiagnosticLeadRequest,
  ): Promise<{ ok: true; result: PreDiagnosticResult }> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Nome é obrigatório');

    let result: PreDiagnosticResult;
    try {
      result = computePreDiagnostic(dto.answers ?? []);
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
    const riskGrade = grauDeRiscoCnpj(cnpjData);

    const lead = await this.prisma.admin.platformLead.create({
      data: {
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
        stage: 'NOVO',
      },
    });

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

    return { ok: true, result };
  }

  async setStage(id: string, stage: PlatformLeadStage, actor: Actor): Promise<PlatformLeadSummary> {
    const existing = await this.prisma.admin.platformLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado');
    const updated = await this.prisma.admin.platformLead.update({ where: { id }, data: { stage } });
    await this.audit.record({ action: 'lead.stage', actor, target: id, meta: { stage } });
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
    const admin = await this.prisma.admin.user.findFirst({
      where: { tenantId: lead.convertedTenantId, email: adminEmail },
    });
    if (!admin) throw new NotFoundException('Usuário admin do cliente não encontrado');

    // Gera nova senha temporária e atualiza o hash → o e-mail leva uma senha válida.
    const tempPassword = this.genPassword();
    await this.prisma.admin.user.update({
      where: { id: admin.id },
      data: { passwordHash: bcrypt.hashSync(tempPassword, 12) },
    });

    const portalUrl = process.env.PORTAL_URL ?? 'https://crivo-web.vercel.app';
    const html = `
      <h2 style="font-family:Georgia,serif;color:#0d1f3c;margin:0 0 12px">Seu acesso à plataforma CRIVO™</h2>
      <p>Olá, ${lead.name}. Seu ambiente CRIVO está pronto.</p>
      <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a><br>
         <strong>Login:</strong> ${adminEmail}<br>
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
      diagnosticScore: l.diagnosticScore,
      diagnosticResult: (l.diagnosticResult as PreDiagnosticResult | null) ?? null,
      stage: l.stage as PlatformLeadStage,
      notes: l.notes,
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
    source: 'product' | 'default';
  }> {
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
    return { questions, source: productQs.length > 0 ? 'product' : 'default' };
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
