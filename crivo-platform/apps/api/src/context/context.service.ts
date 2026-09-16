import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CONTEXT_AI_USE_CASES,
  CONTEXT_AI_USE_CASE_LABEL,
  MODULES,
  TENANT_DOCUMENT_FILE_EXTENSIONS,
  type ChangeTenantDirectiveStatusRequest,
  type ChangeTenantDocumentStatusRequest,
  type ContextAiUseCase,
  type CreateTenantDocumentRequest,
  type TenantAiUseCaseContextData,
  type TenantAiUseCasesResponse,
  type TenantContextAuditEntry,
  type TenantContextOverview,
  type TenantDirectiveData,
  type TenantDirectiveStatus,
  type TenantDocumentData,
  type TenantDocumentStatus,
  type TenantTermData,
  type UpdateTenantAiUseCaseContextRequest,
  type UpsertTenantDirectiveRequest,
  type UpsertTenantTermRequest,
} from '@crivo/types';
import type { PrismaClient } from '@crivo/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../admin/audit.service';
import { extractTextFromFile } from '../admin/prompt-file-extract';

/** Quem cadastra/aprova no portal (req.user). */
export interface ContextActor {
  id: string;
  name: string;
  email: string;
}

/** Arquivo do multipart (FileInterceptor) — só o que o service precisa. */
export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Ciclo de vida da DIRETRIZ. Só transições listadas são aceitas; REVOGADA é
 * terminal (cria-se outra). Editar uma APROVADA a devolve a RASCUNHO com a
 * versão incrementada (o texto mudou — precisa de nova aprovação).
 */
export const DIRECTIVE_TRANSITIONS: Record<TenantDirectiveStatus, readonly TenantDirectiveStatus[]> = {
  RASCUNHO: ['EM_REVISAO', 'REVOGADA'],
  EM_REVISAO: ['APROVADA', 'RASCUNHO', 'REVOGADA'],
  APROVADA: ['REVOGADA'],
  REVOGADA: [],
};

/**
 * Ciclo de vida do DOCUMENTO (protótipo: Rascunho → Em revisão →
 * Aprovado/Publicado → Substituído | Revogado). SUBSTITUIDO só nasce de
 * `replace` (nova versão) e REVOGADO exige justificativa; os dois são terminais.
 */
export const DOCUMENT_TRANSITIONS: Record<TenantDocumentStatus, readonly TenantDocumentStatus[]> = {
  RASCUNHO: ['EM_REVISAO', 'REVOGADO'],
  EM_REVISAO: ['APROVADO_PUBLICADO', 'RASCUNHO', 'REVOGADO'],
  APROVADO_PUBLICADO: ['REVOGADO'],
  SUBSTITUIDO: [],
  REVOGADO: [],
};

const TERMINAL_DOCUMENT: readonly TenantDocumentStatus[] = ['SUBSTITUIDO', 'REVOGADO'];
const MODULE_CODES: readonly string[] = MODULES.map((m) => m.code);

type DirectiveRow = {
  id: string; title: string; text: string; status: string; version: number;
  approvedByUserId: string | null; approvedByName: string | null; approvedAt: Date | null;
  revokeJustification: string | null; createdAt: Date; updatedAt: Date;
};
type DocumentRow = {
  id: string; code: string; title: string; kind: string; cnpj: string | null; unitId: string | null;
  version: string; issuedAt: Date | null; owner: string; purpose: string; modules: string[]; accessLevel: string;
  status: string; replacedById: string | null; revokeJustification: string | null; url: string | null;
  fileName: string | null; fileMime: string | null; fileSize: number | null; extractedChars: number;
  approvedByName: string | null; approvedAt: Date | null; createdAt: Date; updatedAt: Date;
  unit?: { name: string } | null;
};
type TermRow = { id: string; term: string; definition: string; context: string; createdAt: Date; updatedAt: Date };

/** Seleção de listagem: NUNCA traz o texto extraído (pode ter 200 mil chars). */
const DOCUMENT_SELECT = {
  id: true, code: true, title: true, kind: true, cnpj: true, unitId: true, version: true, issuedAt: true,
  owner: true, purpose: true, modules: true, accessLevel: true, status: true, replacedById: true,
  revokeJustification: true, url: true, fileName: true, fileMime: true, fileSize: true, extractedChars: true,
  approvedByName: true, approvedAt: true, createdAt: true, updatedAt: true,
  unit: { select: { name: true } },
} as const;

/**
 * Normaliza o corpo de "Adicionar documento"/"Substituir", que chega como
 * multipart (todo campo é string; `modules` vem como JSON ou "a,b") ou JSON.
 * Valida o que o ValidationPipe não valida em corpo sem classe. Exportada
 * para teste: é a regra, não a persistência.
 */
export function parseDocumentInput(body: Record<string, unknown>): CreateTenantDocumentRequest {
  const str = (k: string, max: number, required = false): string => {
    const v = body[k];
    const s = typeof v === 'string' ? v.trim() : '';
    if (required && !s) throw new BadRequestException(`Campo obrigatório: ${k}.`);
    if (s.length > max) throw new BadRequestException(`Campo ${k} excede ${max} caracteres.`);
    return s;
  };
  let modules: unknown = body.modules;
  if (typeof modules === 'string') {
    const t = modules.trim();
    if (t.startsWith('[')) {
      try { modules = JSON.parse(t); } catch { throw new BadRequestException('Campo modules inválido.'); }
    } else {
      modules = t ? t.split(',').map((m) => m.trim()).filter(Boolean) : [];
    }
  }
  if (modules === undefined || modules === null) modules = [];
  if (!Array.isArray(modules) || modules.some((m) => typeof m !== 'string')) {
    throw new BadRequestException('Campo modules inválido.');
  }
  const codes = Array.from(new Set((modules as string[]).map((m) => m.trim()).filter(Boolean)));
  const unknown = codes.filter((c) => !MODULE_CODES.includes(c));
  if (unknown.length) throw new BadRequestException(`Módulo(s) desconhecido(s): ${unknown.join(', ')}.`);

  const url = str('url', 2000) || null;
  if (url && !/^https?:\/\//i.test(url)) throw new BadRequestException('A URL precisa começar com http:// ou https://.');
  const issuedAt = str('issuedAt', 40) || null;
  if (issuedAt && Number.isNaN(new Date(issuedAt).getTime())) throw new BadRequestException('Data do documento inválida.');
  const unitId = str('unitId', 64) || null;
  if (unitId && !/^[0-9a-f-]{36}$/i.test(unitId)) throw new BadRequestException('Unidade inválida.');

  return {
    title: str('title', 200, true),
    kind: str('kind', 80, true),
    cnpj: str('cnpj', 32) || null,
    unitId,
    version: str('version', 40) || 'v1.0',
    issuedAt,
    owner: str('owner', 160, true),
    purpose: str('purpose', 2000, true),
    modules: codes,
    accessLevel: str('accessLevel', 120, true),
    url,
  };
}

/** "v1.0" → "v1.1", "v3" → "v4", "2.0" → "2.1"; sem número reconhecível → "<versão>-r2". */
export function bumpVersion(version: string): string {
  const m = /^(.*?)(\d+)(?:\.(\d+))?\s*$/.exec(version.trim());
  if (!m) return `${version.trim() || 'v1'}-r2`;
  const [, prefix, major, minor] = m;
  return minor !== undefined ? `${prefix}${major}.${Number(minor) + 1}` : `${prefix}${Number(major) + 1}`;
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

/**
 * Contexto e Diretrizes (módulo 'contexto') — serviço do CLIENTE. Todo método
 * recebe o tenantId EXPLÍCITO da sessão; data plane via forTenant.
 *
 * Regras que vivem aqui (e não na tela):
 *  - transições de status fechadas (tabelas acima); revogar exige justificativa;
 *  - aprovar grava quem/quando; editar diretriz aprovada a devolve a rascunho;
 *  - código D-NNN sequencial por empresa, gerado dentro da transação;
 *  - `replace` cria a nova versão como RASCUNHO, marca a anterior SUBSTITUIDO
 *    (replacedById) e troca o vínculo nos casos de uso — a IA para de usar a
 *    antiga na hora e só volta a usar quando a nova for aprovada;
 *  - o toggle "uso contextual ativo" só liga com o adicional premium
 *    (Product.allowsCustomAi) — sem ele a API recusa com mensagem honesta;
 *  - cada mutação relevante vai ao AuditLog como context.* (aba Histórico).
 */
@Injectable()
export class ContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Visão geral / metadados dos formulários ────────────────────────

  async overview(tenantId: string): Promise<TenantContextOverview> {
    const customAiAllowed = await this.customAiAllowed(tenantId);
    // rls-allow: organization é raiz do tenant (control-plane); leitura self-scoped por id=tenantId.
    const org = await this.prisma.admin.organization.findUnique({ where: { id: tenantId }, select: { taxId: true } });
    return this.prisma.forTenant(tenantId, async (tx) => {
      const [units, directives, approvedDirectives, documents, publishedDocuments, terms, activeUseCases] = await Promise.all([
        tx.unit.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        tx.tenantDirective.count(),
        tx.tenantDirective.count({ where: { status: 'APROVADA' } }),
        tx.tenantDocument.count(),
        tx.tenantDocument.count({ where: { status: 'APROVADO_PUBLICADO' } }),
        tx.tenantTerm.count(),
        tx.tenantAiUseCaseContext.count({ where: { active: true } }),
      ]);
      return {
        customAiAllowed,
        taxId: org?.taxId ?? null,
        units,
        counts: { directives, approvedDirectives, documents, publishedDocuments, terms, activeUseCases },
      };
    });
  }

  /**
   * Gate comercial da IA Contextualizada: produto do contrato vigente com
   * allowsCustomAi. Mesma resolução de buildTenantDirectives (contrato mais
   * recente ATIVO/RASCUNHO → produto). Falha = false (nunca libera por engano).
   */
  async customAiAllowed(tenantId: string): Promise<boolean> {
    try {
      // rls-allow: contract é control-plane (owner-only); self-scoped por organizationId = tenantId.
      const contract = await this.prisma.admin.contract.findFirst({
        where: { organizationId: tenantId, status: { in: ['ATIVO', 'RASCUNHO'] } },
        orderBy: { updatedAt: 'desc' },
        select: { productId: true },
      });
      if (!contract?.productId) return false;
      // rls-allow: product é catálogo control-plane global (sem dado de empresa).
      const product = await this.prisma.admin.product.findUnique({
        where: { id: contract.productId },
        select: { allowsCustomAi: true },
      });
      return !!product?.allowsCustomAi;
    } catch {
      return false;
    }
  }

  // ── Diretrizes ──────────────────────────────────────────────────────

  async listDirectives(tenantId: string): Promise<TenantDirectiveData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.tenantDirective.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      return rows.map((r) => this.toDirective(r));
    });
  }

  async createDirective(tenantId: string, dto: UpsertTenantDirectiveRequest, actor: ContextActor): Promise<TenantDirectiveData> {
    const row = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenantDirective.create({ data: { tenantId, title: dto.title.trim(), text: dto.text.trim() } }),
    );
    await this.audit.record({
      action: 'context.directive.create',
      actor: { id: actor.id, email: actor.email },
      target: row.id,
      tenantId,
      meta: { title: row.title, version: row.version },
    });
    return this.toDirective(row);
  }

  async updateDirective(tenantId: string, id: string, dto: UpsertTenantDirectiveRequest, actor: ContextActor): Promise<TenantDirectiveData> {
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.tenantDirective.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Diretriz não encontrada.');
      if (existing.status === 'REVOGADA') throw new BadRequestException('Diretriz revogada não pode ser editada — cadastre uma nova.');
      // Texto aprovado mudou → deixa de valer até nova aprovação (versão sobe).
      const reapproval = existing.status === 'APROVADA';
      const row = await tx.tenantDirective.update({
        where: { id },
        data: {
          title: dto.title.trim(),
          text: dto.text.trim(),
          ...(reapproval
            ? { status: 'RASCUNHO', version: existing.version + 1, approvedByUserId: null, approvedByName: null, approvedAt: null }
            : {}),
        },
      });
      return { row, reapproval, from: existing.status };
    });
    await this.audit.record({
      action: 'context.directive.update',
      actor: { id: actor.id, email: actor.email },
      target: id,
      tenantId,
      meta: { title: result.row.title, version: result.row.version, from: result.from, to: result.row.status, reapproval: result.reapproval },
    });
    return this.toDirective(result.row);
  }

  async changeDirectiveStatus(tenantId: string, id: string, dto: ChangeTenantDirectiveStatusRequest, actor: ContextActor): Promise<TenantDirectiveData> {
    const justification = (dto.justification ?? '').trim();
    if (dto.status === 'REVOGADA' && !justification) {
      throw new BadRequestException('Revogar uma diretriz exige justificativa.');
    }
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.tenantDirective.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Diretriz não encontrada.');
      const from = existing.status as TenantDirectiveStatus;
      if (!DIRECTIVE_TRANSITIONS[from].includes(dto.status)) {
        throw new BadRequestException(`Transição não permitida: ${from} → ${dto.status}.`);
      }
      const row = await tx.tenantDirective.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === 'APROVADA'
            ? { approvedByUserId: actor.id, approvedByName: actor.name || actor.email, approvedAt: new Date() }
            : {}),
          ...(dto.status === 'REVOGADA' ? { revokeJustification: justification } : {}),
        },
      });
      return { row, from };
    });
    await this.audit.record({
      action: 'context.directive.status',
      actor: { id: actor.id, email: actor.email },
      target: id,
      tenantId,
      meta: { title: result.row.title, from: result.from, to: dto.status, ...(justification ? { justification } : {}) },
    });
    return this.toDirective(result.row);
  }

  // ── Documentos autorizados ──────────────────────────────────────────

  async listDocuments(tenantId: string, status?: string): Promise<TenantDocumentData[]> {
    const where = status && (Object.keys(DOCUMENT_TRANSITIONS) as string[]).includes(status) ? { status: status as TenantDocumentStatus } : {};
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.tenantDocument.findMany({ where, orderBy: { code: 'asc' }, select: DOCUMENT_SELECT });
      const codes = await this.codesOf(tx, rows.map((r) => r.replacedById));
      return rows.map((r) => this.toDocument(r, codes));
    });
  }

  async getDocument(tenantId: string, id: string): Promise<TenantDocumentData> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.tenantDocument.findUnique({ where: { id }, select: DOCUMENT_SELECT });
      if (!row) throw new NotFoundException('Documento não encontrado.');
      const codes = await this.codesOf(tx, [row.replacedById]);
      return this.toDocument(row, codes);
    });
  }

  /** "Adicionar documento": entra como RASCUNHO, com arquivo (texto extraído) OU url. */
  async createDocument(tenantId: string, body: Record<string, unknown>, file: UploadedDocumentFile | undefined, actor: ContextActor): Promise<TenantDocumentData> {
    const input = parseDocumentInput(body);
    if (!file && !input.url) throw new BadRequestException('Envie um arquivo ou informe a URL do documento.');
    const extracted = file ? await this.extract(file) : null;

    const row = await this.prisma.forTenant(tenantId, async (tx) => {
      await this.assertUnit(tx, input.unitId);
      const code = await this.nextCode(tx);
      const created = await tx.tenantDocument.create({
        data: {
          tenantId,
          code,
          title: input.title,
          kind: input.kind,
          cnpj: input.cnpj ?? null,
          unitId: input.unitId ?? null,
          version: input.version ?? 'v1.0',
          issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
          owner: input.owner,
          purpose: input.purpose,
          modules: input.modules,
          accessLevel: input.accessLevel,
          url: file ? null : input.url,
          fileName: file?.originalname ?? null,
          fileMime: file?.mimetype ?? null,
          fileSize: file?.size ?? null,
          extractedText: extracted,
          extractedChars: extracted?.length ?? 0,
        },
        select: DOCUMENT_SELECT,
      });
      if (file) {
        await tx.tenantDocumentFile.create({ data: { tenantId, documentId: created.id, data: file.buffer } });
      }
      return created;
    });
    await this.audit.record({
      action: 'context.document.create',
      actor: { id: actor.id, email: actor.email },
      target: row.code,
      tenantId,
      meta: { documentId: row.id, code: row.code, title: row.title, version: row.version, source: file ? 'upload' : 'url', chars: extracted?.length ?? 0 },
    });
    return this.toDocument(row, new Map());
  }

  async changeDocumentStatus(tenantId: string, id: string, dto: ChangeTenantDocumentStatusRequest, actor: ContextActor): Promise<TenantDocumentData> {
    if (dto.status === 'REVOGADO') return this.revokeDocument(tenantId, id, dto.justification ?? '', actor);
    if (dto.status === 'SUBSTITUIDO') throw new BadRequestException('Para substituir, envie a nova versão em "Substituir".');
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.tenantDocument.findUnique({ where: { id }, select: { id: true, code: true, title: true, status: true } });
      if (!existing) throw new NotFoundException('Documento não encontrado.');
      const from = existing.status as TenantDocumentStatus;
      if (!DOCUMENT_TRANSITIONS[from].includes(dto.status)) {
        throw new BadRequestException(`Transição não permitida: ${from} → ${dto.status}.`);
      }
      const row = await tx.tenantDocument.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === 'APROVADO_PUBLICADO'
            ? { approvedByUserId: actor.id, approvedByName: actor.name || actor.email, approvedAt: new Date() }
            : {}),
        },
        select: DOCUMENT_SELECT,
      });
      const codes = await this.codesOf(tx, [row.replacedById]);
      return { row, from, codes };
    });
    await this.audit.record({
      action: 'context.document.status',
      actor: { id: actor.id, email: actor.email },
      target: result.row.code,
      tenantId,
      meta: { documentId: id, code: result.row.code, title: result.row.title, from: result.from, to: dto.status },
    });
    return this.toDocument(result.row, result.codes);
  }

  /** Revogar — justificativa OBRIGATÓRIA; sai dos casos de uso na hora. */
  async revokeDocument(tenantId: string, id: string, justificationRaw: string, actor: ContextActor): Promise<TenantDocumentData> {
    const justification = (justificationRaw ?? '').trim();
    if (!justification) throw new BadRequestException('Revogar um documento exige justificativa.');
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.tenantDocument.findUnique({ where: { id }, select: { id: true, code: true, title: true, status: true } });
      if (!existing) throw new NotFoundException('Documento não encontrado.');
      const from = existing.status as TenantDocumentStatus;
      if (!DOCUMENT_TRANSITIONS[from].includes('REVOGADO')) {
        throw new BadRequestException(`Transição não permitida: ${from} → REVOGADO.`);
      }
      const row = await tx.tenantDocument.update({
        where: { id },
        data: { status: 'REVOGADO', revokeJustification: justification },
        select: DOCUMENT_SELECT,
      });
      await this.unlinkFromUseCases(tx, id);
      const codes = await this.codesOf(tx, [row.replacedById]);
      return { row, from, codes };
    });
    await this.audit.record({
      action: 'context.document.revoke',
      actor: { id: actor.id, email: actor.email },
      target: result.row.code,
      tenantId,
      meta: { documentId: id, code: result.row.code, title: result.row.title, from: result.from, justification },
    });
    return this.toDocument(result.row, result.codes);
  }

  /**
   * Substituir por nova versão: cria D-NNN novo (RASCUNHO, metadados copiados,
   * versão informada ou incrementada), marca o anterior SUBSTITUIDO apontando
   * para o novo e troca o vínculo nos casos de uso (o novo só alimenta a IA
   * depois de aprovado — nunca conteúdo não aprovado no prompt).
   */
  async replaceDocument(tenantId: string, id: string, body: Record<string, unknown>, file: UploadedDocumentFile | undefined, actor: ContextActor): Promise<TenantDocumentData> {
    const version = typeof body.version === 'string' ? body.version.trim().slice(0, 40) : '';
    const url = typeof body.url === 'string' ? body.url.trim().slice(0, 2000) : '';
    if (!file && !url) throw new BadRequestException('Envie o arquivo da nova versão ou informe a URL.');
    if (url && !/^https?:\/\//i.test(url)) throw new BadRequestException('A URL precisa começar com http:// ou https://.');
    const extracted = file ? await this.extract(file) : null;

    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      const old = await tx.tenantDocument.findUnique({ where: { id }, select: DOCUMENT_SELECT });
      if (!old) throw new NotFoundException('Documento não encontrado.');
      if (TERMINAL_DOCUMENT.includes(old.status as TenantDocumentStatus)) {
        throw new BadRequestException('Documento substituído ou revogado não pode ser substituído de novo.');
      }
      const code = await this.nextCode(tx);
      const created = await tx.tenantDocument.create({
        data: {
          tenantId,
          code,
          title: old.title,
          kind: old.kind,
          cnpj: old.cnpj,
          unitId: old.unitId,
          version: version || bumpVersion(old.version),
          issuedAt: new Date(),
          owner: old.owner,
          purpose: old.purpose,
          modules: old.modules,
          accessLevel: old.accessLevel,
          url: file ? null : url,
          fileName: file?.originalname ?? null,
          fileMime: file?.mimetype ?? null,
          fileSize: file?.size ?? null,
          extractedText: extracted,
          extractedChars: extracted?.length ?? 0,
        },
        select: DOCUMENT_SELECT,
      });
      if (file) {
        await tx.tenantDocumentFile.create({ data: { tenantId, documentId: created.id, data: file.buffer } });
      }
      await tx.tenantDocument.update({ where: { id }, data: { status: 'SUBSTITUIDO', replacedById: created.id } });
      await this.relinkInUseCases(tx, id, created.id);
      return { created, oldCode: old.code, oldStatus: old.status };
    });
    await this.audit.record({
      action: 'context.document.replace',
      actor: { id: actor.id, email: actor.email },
      target: result.oldCode,
      tenantId,
      meta: { documentId: id, code: result.oldCode, from: result.oldStatus, replacedBy: result.created.code, replacedById: result.created.id, version: result.created.version, source: file ? 'upload' : 'url' },
    });
    return this.toDocument(result.created, new Map());
  }

  /** Bytes do arquivo (download) — só existe para documento enviado por upload. */
  async getDocumentFile(tenantId: string, id: string): Promise<{ fileName: string; fileMime: string; data: Buffer }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const doc = await tx.tenantDocument.findUnique({ where: { id }, select: { fileName: true, fileMime: true, file: { select: { data: true } } } });
      if (!doc?.file || !doc.fileName) throw new NotFoundException('Este documento não tem arquivo — foi cadastrado por URL.');
      return { fileName: doc.fileName, fileMime: doc.fileMime ?? 'application/octet-stream', data: Buffer.from(doc.file.data) };
    });
  }

  // ── Terminologia ────────────────────────────────────────────────────

  async listTerms(tenantId: string): Promise<TenantTermData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.tenantTerm.findMany({ orderBy: { term: 'asc' } });
      return rows.map((r) => this.toTerm(r));
    });
  }

  async createTerm(tenantId: string, dto: UpsertTenantTermRequest, actor: ContextActor): Promise<TenantTermData> {
    const row = await this.prisma.forTenant(tenantId, (tx) =>
      tx.tenantTerm.create({ data: { tenantId, term: dto.term.trim(), definition: dto.definition.trim(), context: dto.context.trim() } }),
    );
    await this.audit.record({ action: 'context.term.create', actor: { id: actor.id, email: actor.email }, target: row.id, tenantId, meta: { term: row.term } });
    return this.toTerm(row);
  }

  async updateTerm(tenantId: string, id: string, dto: UpsertTenantTermRequest, actor: ContextActor): Promise<TenantTermData> {
    const row = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.tenantTerm.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Termo não encontrado.');
      return tx.tenantTerm.update({ where: { id }, data: { term: dto.term.trim(), definition: dto.definition.trim(), context: dto.context.trim() } });
    });
    await this.audit.record({ action: 'context.term.update', actor: { id: actor.id, email: actor.email }, target: id, tenantId, meta: { term: row.term } });
    return this.toTerm(row);
  }

  async deleteTerm(tenantId: string, id: string, actor: ContextActor): Promise<{ ok: true }> {
    const term = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.tenantTerm.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Termo não encontrado.');
      await tx.tenantTerm.delete({ where: { id } });
      return existing.term;
    });
    await this.audit.record({ action: 'context.term.delete', actor: { id: actor.id, email: actor.email }, target: id, tenantId, meta: { term } });
    return { ok: true } as const;
  }

  // ── Casos de uso da IA ──────────────────────────────────────────────

  /** Os 6 casos sempre aparecem; sem linha = sem documentos e desligado. */
  async listAiUseCases(tenantId: string): Promise<TenantAiUseCasesResponse> {
    const customAiAllowed = await this.customAiAllowed(tenantId);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.tenantAiUseCaseContext.findMany();
      const byCase = new Map(rows.map((r) => [r.useCase, r]));
      const allIds = Array.from(new Set(rows.flatMap((r) => r.documentIds)));
      const codes = await this.codesOf(tx, allIds);
      const items: TenantAiUseCaseContextData[] = CONTEXT_AI_USE_CASES.map((useCase) => {
        const r = byCase.get(useCase);
        const documentIds = r?.documentIds ?? [];
        return {
          useCase,
          label: CONTEXT_AI_USE_CASE_LABEL[useCase],
          documentIds,
          documentCodes: documentIds.map((d) => codes.get(d) ?? '?'),
          active: r?.active ?? false,
          updatedAt: r?.updatedAt.toISOString() ?? null,
        };
      });
      return { customAiAllowed, items };
    });
  }

  async updateAiUseCase(tenantId: string, useCase: string, dto: UpdateTenantAiUseCaseContextRequest, actor: ContextActor): Promise<TenantAiUseCaseContextData> {
    if (!(CONTEXT_AI_USE_CASES as readonly string[]).includes(useCase)) {
      throw new BadRequestException('Caso de uso desconhecido.');
    }
    if (dto.active && !(await this.customAiAllowed(tenantId))) {
      throw new BadRequestException(
        'A IA Contextualizada é adicional premium do Motor de IA: o produto contratado não a inclui. Os documentos ficam guardados, mas o uso contextual não pode ser ligado.',
      );
    }
    const ids = Array.from(new Set(dto.documentIds));
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      if (ids.length) {
        // Só documentos vivos do próprio tenant (a RLS já limita; o 400 é explícito).
        const docs = await tx.tenantDocument.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
        const found = new Map(docs.map((d) => [d.id, d.status]));
        const missing = ids.filter((i) => !found.has(i));
        if (missing.length) throw new NotFoundException('Documento não encontrado para vincular.');
        const dead = ids.filter((i) => TERMINAL_DOCUMENT.includes(found.get(i) as TenantDocumentStatus));
        if (dead.length) throw new BadRequestException('Documento substituído ou revogado não pode ser vinculado a um caso de uso.');
      }
      const row = await tx.tenantAiUseCaseContext.upsert({
        where: { tenantId_useCase: { tenantId, useCase } },
        create: { tenantId, useCase, documentIds: ids, active: dto.active },
        update: { documentIds: ids, active: dto.active },
      });
      const codes = await this.codesOf(tx, ids);
      return { row, codes };
    });
    await this.audit.record({
      action: 'context.ai_use_case.update',
      actor: { id: actor.id, email: actor.email },
      target: useCase,
      tenantId,
      meta: { useCase, active: dto.active, documents: ids.map((i) => result.codes.get(i) ?? i) },
    });
    return {
      useCase: useCase as ContextAiUseCase,
      label: CONTEXT_AI_USE_CASE_LABEL[useCase as ContextAiUseCase],
      documentIds: result.row.documentIds,
      documentCodes: result.row.documentIds.map((d) => result.codes.get(d) ?? '?'),
      active: result.row.active,
      updatedAt: result.row.updatedAt.toISOString(),
    };
  }

  // ── Histórico e Auditoria ───────────────────────────────────────────

  /** Eventos context.* da empresa (últimos 200). `meta` aqui é só o que o próprio módulo grava (títulos/códigos/transições). */
  async auditTrail(tenantId: string): Promise<TenantContextAuditEntry[]> {
    // rls-allow: audit_log é control-plane (owner-only); filtro explícito por tenantId + prefixo context.* (padrão /me/audit-log).
    const rows = await this.prisma.admin.auditLog.findMany({
      where: { tenantId, action: { startsWith: 'context.' } },
      orderBy: { at: 'desc' },
      take: 200,
      select: { id: true, action: true, target: true, actorEmail: true, at: true, meta: true },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      target: r.target,
      actorEmail: r.actorEmail,
      at: r.at.toISOString(),
      meta: r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta) ? (r.meta as Record<string, unknown>) : null,
    }));
  }

  // ── Internos ────────────────────────────────────────────────────────

  private async extract(file: UploadedDocumentFile): Promise<string> {
    const ext = extOf(file.originalname);
    if (!(TENANT_DOCUMENT_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new BadRequestException(`Formato não aceito. Envie um arquivo ${TENANT_DOCUMENT_FILE_EXTENSIONS.join(', ')}.`);
    }
    if (!file.buffer?.length) throw new BadRequestException('Arquivo vazio.');
    // Mesmo pipeline dos anexos de prompt personalizado (pdf/docx/xlsx/txt…).
    return extractTextFromFile(file.originalname, file.mimetype, file.buffer);
  }

  private async assertUnit(tx: PrismaClient, unitId: string | null | undefined): Promise<void> {
    if (!unitId) return;
    const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!unit) throw new NotFoundException('Unidade não encontrada.');
  }

  /** Próximo "D-NNN" da empresa: maior número já usado + 1 (nunca reaproveita). */
  private async nextCode(tx: PrismaClient): Promise<string> {
    const rows = await tx.tenantDocument.findMany({ select: { code: true } });
    let max = 0;
    for (const r of rows) {
      const m = /^D-(\d+)$/.exec(r.code);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `D-${String(max + 1).padStart(3, '0')}`;
  }

  private async codesOf(tx: PrismaClient, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const clean = Array.from(new Set(ids.filter((i): i is string => !!i)));
    if (!clean.length) return new Map();
    const rows = await tx.tenantDocument.findMany({ where: { id: { in: clean } }, select: { id: true, code: true } });
    return new Map(rows.map((r) => [r.id, r.code]));
  }

  /** Documento revogado sai de todos os casos de uso. */
  private async unlinkFromUseCases(tx: PrismaClient, documentId: string): Promise<void> {
    const rows = await tx.tenantAiUseCaseContext.findMany({ where: { documentIds: { has: documentId } } });
    for (const r of rows) {
      await tx.tenantAiUseCaseContext.update({ where: { id: r.id }, data: { documentIds: r.documentIds.filter((d) => d !== documentId) } });
    }
  }

  /** Nova versão herda os vínculos da anterior (entra em vigor quando aprovada). */
  private async relinkInUseCases(tx: PrismaClient, oldId: string, newId: string): Promise<void> {
    const rows = await tx.tenantAiUseCaseContext.findMany({ where: { documentIds: { has: oldId } } });
    for (const r of rows) {
      await tx.tenantAiUseCaseContext.update({ where: { id: r.id }, data: { documentIds: r.documentIds.map((d) => (d === oldId ? newId : d)) } });
    }
  }

  private toDirective(r: DirectiveRow): TenantDirectiveData {
    return {
      id: r.id,
      title: r.title,
      text: r.text,
      status: r.status as TenantDirectiveStatus,
      version: r.version,
      approvedByUserId: r.approvedByUserId,
      approvedByName: r.approvedByName,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      revokeJustification: r.revokeJustification,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toDocument(r: DocumentRow, codes: Map<string, string>): TenantDocumentData {
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      kind: r.kind,
      cnpj: r.cnpj,
      unitId: r.unitId,
      unitName: r.unit?.name ?? null,
      version: r.version,
      issuedAt: r.issuedAt?.toISOString() ?? null,
      owner: r.owner,
      purpose: r.purpose,
      modules: r.modules ?? [],
      accessLevel: r.accessLevel,
      status: r.status as TenantDocumentStatus,
      replacedById: r.replacedById,
      replacedByCode: r.replacedById ? codes.get(r.replacedById) ?? null : null,
      revokeJustification: r.revokeJustification,
      url: r.url,
      fileName: r.fileName,
      fileMime: r.fileMime,
      fileSize: r.fileSize,
      extractedChars: r.extractedChars,
      approvedByName: r.approvedByName,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toTerm(r: TermRow): TenantTermData {
    return {
      id: r.id,
      term: r.term,
      definition: r.definition,
      context: r.context,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
