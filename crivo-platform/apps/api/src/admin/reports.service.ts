import { BadRequestException, Injectable } from '@nestjs/common';
import { DOCUMENT_TYPE_LABEL } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AiSettingsService } from './ai-settings.service';
import { AiPromptsService } from './ai-prompts.service';
import { ME_CODE } from '../action-plans/documents.service';
import { resolveActiveMethodology } from './methodology.service';

type Actor = { id: string; email: string };

/**
 * F3 — Catálogo dos TEXTOS APROVADOS por documento (Pacote Final de Templates,
 * decisão 1-A): a IA gera o rascunho, a equipe CRIVO edita e aprova aqui, e só
 * o texto aprovado entra no documento. `required` segue o dicionário de
 * variáveis do pacote (obrigatória ausente = bloqueia a emissão oficial).
 * Os campos do TPL-003 (evolução) entram na F4, junto com os ciclos formais.
 */
export const APPROVED_TEXT_FIELDS = [
  {
    docType: 'relatorio_executivo',
    field: 'sintese_executiva',
    label: 'Síntese executiva (MAPA §1)',
    required: true,
    instruction:
      'Escreva a "Síntese executiva" do MAPA Executivo CRIVO desta empresa: leitura geral do resultado ' +
      '(score geral, classificação e o que os destaques por dimensão indicam), em linguagem executiva, ' +
      'sem repetir a tabela de números.',
  },
  {
    docType: 'relatorio_executivo',
    field: 'sinais_leitura',
    label: 'Leitura dos principais sinais (MAPA §4)',
    required: false,
    instruction:
      'Escreva a leitura narrativa dos principais sinais listados (forças e atenções): UMA LINHA por ' +
      'sinal, no formato exato "CÓDIGO — leitura em 1 frase." (ex.: "ME3 — A comunicação sustenta as ' +
      'decisões no dia a dia."). Use somente os códigos listados no contexto; não crie outros.',
  },
  {
    docType: 'relatorio_executivo',
    field: 'proximo_passo_justificativa',
    label: 'Justificativa do próximo passo (MAPA §5)',
    required: false,
    instruction:
      'Escreva a justificativa da recomendação de próximo passo indicada no contexto, conectando-a aos ' +
      'resultados observados (2 a 3 frases).',
  },
  {
    docType: 'dossie_tecnico',
    field: 'finalidade_limites',
    label: 'Complemento de finalidade e limites (Dossiê §1)',
    required: false,
    instruction:
      'Escreva UM parágrafo complementar à seção "Finalidade e limites" do Dossiê Técnico, ' +
      'contextualizando o ciclo avaliado desta empresa (o texto obrigatório do pacote permanece; o seu ' +
      'parágrafo entra em seguida).',
  },
  {
    docType: 'dossie_tecnico',
    field: 'conclusao_tecnica',
    label: 'Conclusão técnica (Dossiê §13)',
    required: true,
    instruction:
      'Escreva a conclusão técnica do Dossiê: o que o ciclo avaliado registrou (fatores priorizados, ' +
      'plano de ação e evidências, conforme o contexto) e o que segue sob responsabilidade da empresa ' +
      'e/ou do responsável técnico. 2 parágrafos.',
  },
] as const;

export type ApprovedTextFieldDef = (typeof APPROVED_TEXT_FIELDS)[number];

// Nomes CANÔNICOS dos documentos (@crivo/types) — os mesmos que o gerador
// imprime. Um mapa próprio aqui divergiria do documento real.
const APPROVED_DOC_LABEL: Record<string, string> = {
  relatorio_executivo: DOCUMENT_TYPE_LABEL['relatorio_executivo'],
  dossie_tecnico: DOCUMENT_TYPE_LABEL['dossie_tecnico'],
};

/** Teto do texto aprovado — coerente com as seções de modelo (8k). */
const APPROVED_TEXT_MAX = 8000;

export type ReportTemplateSection = { heading: string; body: string };
export type UpsertReportTemplate = {
  key?: string;
  name: string;
  description?: string | null;
  instrumentSlug: string;
  sections?: ReportTemplateSection[];
  includeResults?: boolean;
  includeDimensions?: boolean;
  includePlan?: boolean;
  active?: boolean;
};

/** Normaliza para kebab-case seguro (usado como tipo do documento na API). */
function toKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Sanitiza as seções de texto vindas do formulário. */
function cleanSections(raw: unknown): ReportTemplateSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      heading: String((s as ReportTemplateSection)?.heading ?? '').trim().slice(0, 160),
      body: String((s as ReportTemplateSection)?.body ?? '').trim().slice(0, 8000),
    }))
    .filter((s) => s.heading || s.body)
    .slice(0, 20);
}

/**
 * Motor 4 — Relatórios e Dossiês (R-001), lado control-plane. Repositório
 * cross-tenant das EMISSÕES congeladas (ReportEmission) + fila de revisão
 * técnica do super admin. A emissão em si acontece no portal do tenant
 * (DocumentsService.emit); aqui é leitura global e o carimbo de "revisada".
 * Todo acesso a conteúdo e toda revisão ficam na trilha de auditoria.
 */
@Injectable()
export class ReportsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly aiSettings: AiSettingsService,
    private readonly aiPrompts: AiPromptsService,
  ) {}

  /** Visão geral do motor: volumes para os cards da seção. */
  async overview() {
    const [total, pending, reviewed, byType] = await Promise.all([
      this.prisma.admin.reportEmission.count(),
      this.prisma.admin.reportEmission.count({ where: { status: 'EMITIDA' } }),
      this.prisma.admin.reportEmission.count({ where: { status: 'REVISADA' } }),
      this.prisma.admin.reportEmission.groupBy({ by: ['type'], _count: { _all: true } }),
    ]);
    const tenants = await this.prisma.admin.reportEmission.findMany({
      distinct: ['tenantId'],
      select: { tenantId: true },
    });
    return {
      total,
      pendingReview: pending,
      reviewed,
      tenantsWithEmissions: tenants.length,
      byType: byType.map((t) => ({ type: t.type, count: t._count._all })),
    };
  }

  /** Repositório cross-tenant: metadados de todas as emissões (conteúdo sob demanda). */
  async list() {
    const rows = await this.prisma.admin.reportEmission.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        type: true,
        title: true,
        emissionNumber: true,
        method: true,
        technicalOutput: true,
        contentHash: true,
        status: true,
        generatedBy: true,
        createdAt: true,
        reviewedBy: true,
        reviewedAt: true,
        org: { select: { name: true } },
      },
    });
    return rows.map(({ org, ...r }) => ({ ...r, tenantName: org.name }));
  }

  /** Conteúdo congelado de uma emissão (revisão técnica). Acesso auditado. */
  async get(id: string, actor: Actor) {
    const e = await this.prisma.admin.reportEmission.findUnique({
      where: { id },
      include: { org: { select: { name: true } } },
    });
    if (!e) throw new BadRequestException('Emissão não encontrada.');
    await this.audit.record({
      action: 'report.emission.view',
      actor,
      target: e.id,
      tenantId: e.tenantId,
      meta: { type: e.type, emissionNumber: e.emissionNumber },
    });
    const { org, ...rest } = e;
    return { ...rest, tenantName: org.name };
  }

  // ── Modelos de relatório (vinculados ao Motor de Diagnósticos) ────────────

  /** Catálogo de modelos + o instrumento a que cada um está vinculado. */
  async listTemplates() {
    const rows = await this.prisma.admin.reportTemplate.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { instrument: { select: { name: true, active: true } } },
    });
    return rows.map(({ instrument, ...t }) => ({
      ...t,
      instrumentName: instrument.name,
      instrumentActive: instrument.active,
    }));
  }

  /** Instrumentos do Motor de Diagnósticos disponíveis para vincular. */
  async listInstrumentOptions() {
    const rows = await this.prisma.admin.diagnosticInstrument.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, _count: { select: { versions: true } } },
    });
    return rows.map((r) => ({ slug: r.slug, name: r.name, versions: r._count.versions }));
  }

  async createTemplate(dto: UpsertReportTemplate, actor: Actor) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Informe o nome do relatório.');
    const instrument = await this.prisma.admin.diagnosticInstrument.findUnique({
      where: { slug: dto.instrumentSlug },
    });
    if (!instrument) throw new BadRequestException('Diagnóstico vinculado não encontrado no Motor de Diagnósticos.');
    const key = toKey(dto.key?.trim() || name);
    if (!key) throw new BadRequestException('Não foi possível gerar o identificador do relatório.');
    const clash = await this.prisma.admin.reportTemplate.findUnique({ where: { key } });
    if (clash) throw new BadRequestException(`Já existe um relatório com o identificador "${key}".`);

    const created = await this.prisma.admin.reportTemplate.create({
      data: {
        key,
        name,
        description: dto.description?.trim() || null,
        instrumentSlug: instrument.slug,
        sections: cleanSections(dto.sections) as object,
        includeResults: dto.includeResults ?? true,
        includeDimensions: dto.includeDimensions ?? true,
        includePlan: dto.includePlan ?? false,
        active: dto.active ?? true,
        updatedBy: actor.email,
      },
    });
    await this.audit.record({
      action: 'report.template.create',
      actor,
      target: created.id,
      meta: { key, instrumentSlug: instrument.slug },
    });
    return created;
  }

  async updateTemplate(id: string, dto: UpsertReportTemplate, actor: Actor) {
    const existing = await this.prisma.admin.reportTemplate.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Modelo de relatório não encontrado.');
    if (dto.instrumentSlug && dto.instrumentSlug !== existing.instrumentSlug) {
      const instrument = await this.prisma.admin.diagnosticInstrument.findUnique({
        where: { slug: dto.instrumentSlug },
      });
      if (!instrument) throw new BadRequestException('Diagnóstico vinculado não encontrado.');
    }
    const updated = await this.prisma.admin.reportTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim() || existing.name,
        description: dto.description === undefined ? existing.description : dto.description?.trim() || null,
        instrumentSlug: dto.instrumentSlug ?? existing.instrumentSlug,
        sections: (dto.sections === undefined ? existing.sections : cleanSections(dto.sections)) as object,
        includeResults: dto.includeResults ?? existing.includeResults,
        includeDimensions: dto.includeDimensions ?? existing.includeDimensions,
        includePlan: dto.includePlan ?? existing.includePlan,
        active: dto.active ?? existing.active,
        updatedBy: actor.email,
      },
    });
    await this.audit.record({
      action: 'report.template.update',
      actor,
      target: id,
      meta: { key: updated.key, instrumentSlug: updated.instrumentSlug, active: updated.active },
    });
    return updated;
  }

  /**
   * Remove o modelo. Emissões já feitas NÃO são afetadas (o conteúdo delas é
   * congelado); apenas o modelo deixa de aparecer para novas gerações.
   */
  async removeTemplate(id: string, actor: Actor) {
    const existing = await this.prisma.admin.reportTemplate.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Modelo de relatório não encontrado.');
    const emitted = await this.prisma.admin.reportEmission.count({ where: { type: `tpl:${existing.key}` } });
    if (emitted > 0) {
      // Com emissões no repositório, desativar preserva o histórico auditável.
      const off = await this.prisma.admin.reportTemplate.update({
        where: { id },
        data: { active: false, updatedBy: actor.email },
      });
      await this.audit.record({
        action: 'report.template.deactivate',
        actor,
        target: id,
        meta: { key: existing.key, emitted },
      });
      return { ...off, deactivatedInsteadOfDeleted: true as const, emitted };
    }
    await this.prisma.admin.reportTemplate.delete({ where: { id } });
    await this.audit.record({
      action: 'report.template.delete',
      actor,
      target: id,
      meta: { key: existing.key },
    });
    return { ...existing, deactivatedInsteadOfDeleted: false as const, emitted: 0 };
  }

  // ── F3 · Textos aprovados dos documentos (decisão 1-A do cliente) ─────────

  private fieldDef(docType: string, field: string): ApprovedTextFieldDef {
    const def = APPROVED_TEXT_FIELDS.find((f) => f.docType === docType && f.field === field);
    if (!def) throw new BadRequestException('Campo de texto aprovado inválido.');
    return def;
  }

  /** Fila de aprovação de uma empresa: catálogo de campos + estado de cada um. */
  async listTexts(tenantId: string, actor: Actor) {
    // rls-allow: leitura cross-tenant do control plane (conexão owner).
    const org = await this.prisma.admin.organization.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!org) throw new BadRequestException('Empresa não encontrada.');
    const rows = await this.prisma.admin.approvedText.findMany({ where: { tenantId } });
    // Acesso cross-tenant a CONTEÚDO fica na trilha — mesmo padrão do
    // report.emission.view (leituras de rascunhos/textos de uma empresa).
    await this.audit.record({
      action: 'report.text.list',
      actor,
      target: tenantId,
      tenantId,
      meta: { fields: rows.length },
    });
    const byKey = new Map(rows.map((r) => [`${r.docType}:${r.field}`, r]));
    return APPROVED_TEXT_FIELDS.map((def) => {
      const row = byKey.get(`${def.docType}:${def.field}`);
      return {
        docType: def.docType,
        docLabel: APPROVED_DOC_LABEL[def.docType] ?? def.docType,
        field: def.field,
        label: def.label,
        required: def.required,
        draft: row?.draft ?? null,
        draftModel: row?.draftModel ?? null,
        draftAt: row?.draftAt?.toISOString() ?? null,
        approvedContent: row?.approvedContent ?? null,
        approvedBy: row?.approvedBy ?? null,
        approvedAt: row?.approvedAt?.toISOString() ?? null,
        status: row?.approvedContent ? 'APROVADO' : row?.draft ? 'RASCUNHO' : 'PENDENTE',
      };
    });
  }

  /**
   * Contexto REAL da empresa para o rascunho da IA — somente dados registrados
   * (MAPA do lead convertido, contrato, organização, plano validado). A IA
   * nunca recebe permissão para inventar: o que não está aqui, não existe.
   */
  private async draftContext(tenantId: string, docType: string): Promise<string> {
    const org = await this.prisma.admin.organization.findUnique({ where: { id: tenantId } });
    if (!org) throw new BadRequestException('Empresa não encontrada.');
    const lines: string[] = [`# Empresa\nNome: ${org.legalName ?? org.name}`];
    if (org.establishment) lines.push(`Unidade/Estabelecimento: ${org.establishment}`);
    if (org.employeesCount) lines.push(`Número de empregados informado: ${org.employeesCount}`);
    if (org.workModel) lines.push(`Modelo de trabalho: ${org.workModel}`);

    // Mesma resolução de contrato/método do gerador de documentos (context()).
    const contract = await this.prisma.admin.contract.findFirst({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
      select: { method: true, technicalOutput: true, productId: true },
    });
    const product = contract?.productId
      ? await this.prisma.admin.product.findUnique({
          where: { id: contract.productId },
          select: { method: true },
        })
      : null;
    const method = product?.method ?? contract?.method ?? null;
    if (method) lines.push(`Método CRIVO aplicado: ${method}`);
    if (contract?.technicalOutput) lines.push(`Saída técnica contratada: ${contract.technicalOutput}`);

    if (docType === 'relatorio_executivo') {
      const tenant = await this.prisma.admin.tenant.findFirst({
        where: { organizationId: tenantId },
        select: { id: true },
      });
      const leads = tenant
        ? await this.prisma.admin.platformLead.findMany({
            where: { convertedTenantId: tenant.id },
            orderBy: { updatedAt: 'desc' },
            take: 5,
          })
        : [];
      const lead = leads.find((l) => l.diagnosticResult && l.diagnosticScore != null);
      // Mesmas DUAS fontes oficiais do documento (mapaSource, decisão 27/07):
      // lead convertido OU agregado do PRE_DIAGNOSTIC aplicado pela empresa
      // logada. Sem replicar o fallback, o rascunho da IA falharia para uma
      // classe inteira de empresas cujo documento existe e emite normalmente.
      let r: {
        score: number;
        levelLabel?: string;
        byDimension?: Record<string, number>;
        dimensionLabels?: Record<string, string>;
      } | null = null;
      let origin = '';
      if (lead) {
        r = lead.diagnosticResult as typeof r;
        origin = `Respondente: ${lead.name}${lead.company ? ` (${lead.company})` : ''}`;
      } else {
        const rows = await this.prisma.admin.diagnosticResponse.findMany({
          where: { tenantId, instrumentSlug: 'PRE_DIAGNOSTIC' },
          select: { score: true, byDimension: true },
        });
        if (rows.length) {
          const active = await resolveActiveMethodology(this.prisma, 'PRE_DIAGNOSTIC');
          const dims = active ? active.config.dimensions.filter((d) => !d.parentSlug) : [];
          const bands = active?.config.bands ?? [];
          const score = Math.round(rows.reduce((s, x) => s + x.score, 0) / rows.length);
          const byDimension: Record<string, number> = {};
          const dimensionLabels: Record<string, string> = {};
          for (const d of dims) {
            const vals = rows.map((x) => Number((x.byDimension as Record<string, number>)?.[d.slug] ?? 0));
            byDimension[d.slug] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
            dimensionLabels[d.slug] = d.label;
          }
          const band = bands.find((b) => score >= b.min && score <= b.max);
          r = { score, levelLabel: band?.label, byDimension, dimensionLabels };
          origin = `Aplicação coletiva no portal — ${rows.length} respondente(s)`;
        }
      }
      if (!r) {
        throw new BadRequestException(
          'Sem MAPA Executivo registrado para esta empresa (nem via lead convertido, nem aplicado no ' +
            'portal) — o rascunho da IA usa apenas dados reais. Escreva o texto manualmente ou aguarde ' +
            'a conclusão do MAPA.',
        );
      }
      lines.push(`\n# Resultado do MAPA Executivo CRIVO`);
      if (origin) lines.push(origin);
      lines.push(`Score geral (0–100): ${r.score}`);
      if (r.levelLabel) lines.push(`Classificação: ${r.levelLabel}`);
      const dims = Object.entries(r.byDimension ?? {})
        .filter(([, v]) => typeof v === 'number')
        .map(([slug, value]) => ({
          code: ME_CODE[slug] ?? slug,
          name: r.dimensionLabels?.[slug] ?? slug,
          value: value as number,
        }))
        .sort((a, b) => b.value - a.value);
      if (dims.length) {
        lines.push('Dimensões (da maior para a menor):');
        for (const d of dims) lines.push(`- ${d.code} · ${d.name}: ${d.value}`);
        // Mesma regra do documento: forças e atenções são conjuntos DISJUNTOS.
        const forces = dims.slice(0, 2);
        const attentions = dims.slice(2).slice(-2).reverse();
        if (forces.length) lines.push(`Forças (maiores resultados): ${forces.map((d) => `${d.code} · ${d.name} (${d.value})`).join('; ')}`);
        if (attentions.length) lines.push(`Atenções (menores resultados): ${attentions.map((d) => `${d.code} · ${d.name} (${d.value})`).join('; ')}`);
      }
      const cnae = await this.prisma.admin.cnaeDecisionHistory.findFirst({
        where: { companyId: tenantId },
        orderBy: { createdAt: 'desc' },
        select: { recommendedMethod: true },
      });
      if (cnae?.recommendedMethod) {
        lines.push(`Próximo passo recomendado (motor CNAE/NR-1): ${cnae.recommendedMethod}`);
      }
    }

    if (docType === 'dossie_tecnico') {
      // rls-allow: leitura cross-tenant do super admin via owner (contexto p/ IA).
      const plans = await this.prisma.admin.actionPlan.findMany({
        where: { tenantId },
        include: { items: true },
        orderBy: { updatedAt: 'desc' },
      });
      const plan = plans.find((p) => p.validatedAt) ?? plans[0];
      const respostas = await this.prisma.admin.psychosocialResponse.count({ where: { tenantId } });
      lines.push(`\n# Ciclo avaliado`);
      lines.push(`Respostas do questionário psicossocial: ${respostas}`);
      if (plan) {
        lines.push(
          `Plano de Evolução: "${plan.title}"${plan.validatedAt ? ' (validado)' : ' (ainda não validado)'} com ${plan.items.length} ação(ões).`,
        );
        for (const i of plan.items.slice(0, 15)) {
          const parts = [
            `Fator: ${i.point}`,
            `Ação: ${i.action}`,
            i.severity && i.probability ? `Severidade ${i.severity} × Probabilidade ${i.probability}` : null,
            `Status: ${i.status}`,
            i.areaProcess ? `Área/processo: ${i.areaProcess}` : null,
            i.indicator ? `Indicador: ${i.indicator}` : null,
            i.existingMeasure ? `Medida existente: ${i.existingMeasure}` : null,
          ].filter(Boolean);
          lines.push(`- ${parts.join(' | ')}`);
        }
      } else {
        lines.push('Nenhum Plano de Evolução registrado.');
      }
      const devolutivas = await this.prisma.admin.devolutivaRecord.count({ where: { tenantId } });
      if (devolutivas) lines.push(`Devolutivas aos trabalhadores registradas: ${devolutivas}`);
    }

    return lines.join('\n').slice(0, 9000);
  }

  /** Gera o RASCUNHO do texto com a IA da Plataforma (motor central, medido). */
  async generateDraft(tenantId: string, docType: string, field: string, actor: Actor) {
    const def = this.fieldDef(docType, field);
    const settings = await this.aiSettings.get();
    if (!settings.enabled) {
      throw new BadRequestException(
        'IA da Plataforma desativada nas Configurações de IA — escreva o texto manualmente e aprove.',
      );
    }
    // Delimitação explícita: o conteúdo do tenant (nomes de fatores, ações,
    // textos livres) entra como DADO, nunca como instrução — o prompt-base
    // (document_texts) reforça a regra do bloco <dados>.
    const context = (await this.draftContext(tenantId, docType)).replaceAll('</dados>', '');
    const system = await this.aiPrompts.resolve('document_texts');
    const result = await this.aiSettings.chat({
      useCase: 'document_texts',
      tenantId,
      temperature: 0.4,
      maxTokens: 700,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `<dados>\n${context}\n</dados>\n\n# Tarefa\nDocumento: ${APPROVED_DOC_LABEL[docType] ?? docType}\nCampo: ${def.label}\n${def.instruction}`,
        },
      ],
    });
    if (!result.ok) {
      const why =
        result.kind === 'no_key'
          ? 'nenhum token de IA configurado'
          : result.kind === 'timeout'
            ? 'tempo esgotado'
            : result.kind === 'http'
              ? `erro do provedor (HTTP ${result.httpStatus})`
              : result.kind === 'empty'
                ? 'a IA respondeu vazio'
                : 'falha de conexão';
      throw new BadRequestException(`Falha ao gerar com a IA (${why}) — tente novamente ou escreva o texto manualmente.`);
    }
    const draft = result.content.slice(0, APPROVED_TEXT_MAX);
    const row = await this.prisma.admin.approvedText.upsert({
      where: { tenantId_docType_field: { tenantId, docType, field } },
      update: { draft, draftModel: result.model, draftAt: new Date() },
      create: { tenantId, docType, field, draft, draftModel: result.model, draftAt: new Date() },
    });
    await this.audit.record({
      action: 'report.text.draft',
      actor,
      target: row.id,
      tenantId,
      meta: { docType, field, model: result.model },
    });
    return row;
  }

  /** Salva o texto editado; com `approve`, congela como texto APROVADO (1-A). */
  async saveText(
    tenantId: string,
    docType: string,
    field: string,
    dto: { content?: string; approve?: boolean },
    actor: Actor,
  ) {
    this.fieldDef(docType, field);
    const content = dto.content?.trim();
    if (!content || content.length < 10) {
      throw new BadRequestException('O texto precisa ter ao menos 10 caracteres.');
    }
    if (content.length > APPROVED_TEXT_MAX) {
      throw new BadRequestException(`O texto pode ter no máximo ${APPROVED_TEXT_MAX} caracteres.`);
    }
    const org = await this.prisma.admin.organization.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!org) throw new BadRequestException('Empresa não encontrada.');
    const approve = dto.approve === true;
    const row = await this.prisma.admin.approvedText.upsert({
      where: { tenantId_docType_field: { tenantId, docType, field } },
      update: {
        draft: content,
        draftModel: null, // edição manual — o rótulo do modelo de IA deixa de valer
        draftAt: new Date(),
        ...(approve
          ? { approvedContent: content, approvedBy: actor.email, approvedAt: new Date(), status: 'APROVADO' }
          : {}),
      },
      create: {
        tenantId,
        docType,
        field,
        draft: content,
        draftAt: new Date(),
        ...(approve
          ? { approvedContent: content, approvedBy: actor.email, approvedAt: new Date(), status: 'APROVADO' }
          : {}),
      },
    });
    await this.audit.record({
      action: approve ? 'report.text.approve' : 'report.text.save',
      actor,
      target: row.id,
      tenantId,
      meta: { docType, field, length: content.length },
    });
    return row;
  }

  /** Remove a aprovação (o documento volta a sair sem o texto; o rascunho fica). */
  async revokeText(tenantId: string, docType: string, field: string, actor: Actor) {
    this.fieldDef(docType, field);
    const existing = await this.prisma.admin.approvedText.findUnique({
      where: { tenantId_docType_field: { tenantId, docType, field } },
    });
    if (!existing?.approvedContent) throw new BadRequestException('Este campo não tem texto aprovado.');
    const row = await this.prisma.admin.approvedText.update({
      where: { id: existing.id },
      data: { approvedContent: null, approvedBy: null, approvedAt: null, status: 'RASCUNHO' },
    });
    await this.audit.record({
      action: 'report.text.revoke',
      actor,
      target: row.id,
      tenantId,
      meta: { docType, field },
    });
    return row;
  }

  /** Fila de revisão: marca a emissão como REVISADA (imutável no conteúdo). */
  async review(id: string, actor: Actor) {
    const e = await this.prisma.admin.reportEmission.findUnique({ where: { id } });
    if (!e) throw new BadRequestException('Emissão não encontrada.');
    if (e.status === 'REVISADA') return e;
    const updated = await this.prisma.admin.reportEmission.update({
      where: { id },
      data: { status: 'REVISADA', reviewedBy: actor.email, reviewedAt: new Date() },
    });
    await this.audit.record({
      action: 'report.emission.review',
      actor,
      target: id,
      tenantId: e.tenantId,
      meta: { type: e.type, emissionNumber: e.emissionNumber },
    });
    return updated;
  }
}
