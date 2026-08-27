import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MODULES, type AiCustomPromptData, type AiCustomPromptFileMeta, type AiPromptInstrumentOption } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, type AuditActor } from './audit.service';
import { AiSettingsService } from './ai-settings.service';
import { extractTextFromFile, PROMPT_FILE_EXTENSIONS } from './prompt-file-extract';

type Actor = AuditActor & { id: string; email: string };

/** base64 de 8 MiB — mesmo teto do e-book e do modelo de contrato. */
const MAX_BASE64 = 11_184_812;

/**
 * Cap TOTAL (em chars) de material de referência anexado ao prompt de sistema.
 * Compartilhado entre o Testar do painel e o Dossiê (documents.service).
 */
export const PROMPT_REFERENCE_CAP = 60_000;

/**
 * Monta os blocos "[Material de referência: <arquivo>]" concatenados,
 * respeitando o cap TOTAL: ao estourar, corta o bloco corrente e para.
 * Helper PURO exportado — reusado pelo Dossiê (documents.service.ts).
 */
export function buildPromptReferenceBlocks(
  files: { filename: string; extractedText: string }[],
  cap = PROMPT_REFERENCE_CAP,
): string {
  let out = '';
  for (const f of files) {
    if (out.length >= cap) break;
    const block = `[Material de referência: ${f.filename}]\n${f.extractedText}`;
    const candidate = out ? `${out}\n\n${block}` : block;
    if (candidate.length <= cap) {
      out = candidate;
    } else {
      out = `${candidate.slice(0, cap)}\n[material truncado]`;
      break;
    }
  }
  return out;
}

/** Teto de diagnósticos por prompt — o mesmo do seletor da tela. */
const MAX_INSTRUMENTS = 10;

/**
 * Diagnósticos atendidos por um prompt: sem vazios, sem repetição, na ordem
 * escolhida. Um prompt pode servir a mais de um (a mesma política para o
 * Essencial e o Organizacional, por exemplo).
 */
export function normalizeInstrumentSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const slug = v.trim().slice(0, 80);
    if (!slug || out.includes(slug)) continue;
    out.push(slug);
    if (out.length >= MAX_INSTRUMENTS) break;
  }
  return out;
}

/**
 * Prompt personalizado ATIVO que atende o diagnóstico informado — ou null.
 *
 * É o ponto único de resolução: antes o gerador de planos consultava a tabela
 * com o slug 'PSYCHOSOCIAL' cravado no código, então um prompt vinculado a
 * outro diagnóstico nunca seria encontrado. O `OR` cobre as linhas antigas, que
 * guardam o vínculo só na coluna singular.
 *
 * Havendo mais de um ativo para o mesmo diagnóstico, vence o mais recente.
 * NUNCA lança: qualquer falha vira null e o chamador cai no prompt fixo.
 */
export async function findActiveCustomPromptForInstrument(
  prisma: PrismaService,
  instrumentSlug: string,
): Promise<{ name: string; body: string; files: { filename: string; extractedText: string }[] } | null> {
  // rls-allow: catálogo control-plane global (prompts personalizados da IA)
  const row = await prisma.admin.aiCustomPrompt
    .findFirst({
      where: {
        active: true,
        OR: [{ instrumentSlugs: { has: instrumentSlug } }, { instrumentSlug }],
      },
      orderBy: { updatedAt: 'desc' },
      include: { files: true },
    })
    .catch(() => null);
  if (!row) return null;
  return {
    name: row.name,
    body: row.body,
    files: row.files.map((f) => ({ filename: f.filename, extractedText: f.extractedText })),
  };
}

/** Slugs BUILT-IN do seletor "Diagnóstico do Motor" (rótulos do briefing). */
const BUILTIN_INSTRUMENTS: AiPromptInstrumentOption[] = [
  { slug: 'PRE_DIAGNOSTIC', label: 'MAPA Executivo (Diagnóstico Inicial)' },
  { slug: 'PSYCHOSOCIAL', label: 'Diagnóstico Organizacional (NR-1)' },
];

const FILE_META_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

/**
 * Prompts PERSONALIZADOS da IA (Super Admin · IA da Plataforma · Prompts e
 * Políticas). Prompt livre com vínculo opcional a um diagnóstico do Motor e a
 * adicionais contratados, mais material de referência (texto extraído de
 * pdf/docx/xlsx/txt/md/csv). Control plane (owner-only via prisma.admin).
 */
@Injectable()
export class AiCustomPromptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  async list(): Promise<AiCustomPromptData[]> {
    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const rows = await this.prisma.admin.aiCustomPrompt.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        files: { select: FILE_META_SELECT, orderBy: { createdAt: 'asc' } },
      },
    });
    return rows.map((r) => this.toData(r));
  }

  /** Opções do seletor "Diagnóstico do Motor": built-ins fixos + ativos do
   *  catálogo do Motor (deduplicados por slug). Decisão D3. */
  async instrumentOptions(): Promise<AiPromptInstrumentOption[]> {
    const builtinSlugs = new Set(BUILTIN_INSTRUMENTS.map((b) => b.slug));
    // Query direta (não injeta ReportsAdminService): esse service estava num ciclo
    // de import (reports.service → documents.service → admin), que deixava a
    // dependência undefined e derrubava o boot do Nest.
    // rls-allow: catálogo control-plane global (instrumentos do Motor de Diagnósticos)
    const rows = await this.prisma.admin.diagnosticInstrument.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    });
    const custom = rows
      .filter((o) => !builtinSlugs.has(o.slug))
      .map((o) => ({ slug: o.slug, label: o.name }));
    return [...BUILTIN_INSTRUMENTS, ...custom];
  }

  async create(
    dto: {
      name: string;
      body: string;
      instrumentSlug?: string;
      instrumentSlugs?: string[];
      addonIds?: string[];
      active?: boolean;
    },
    actor: Actor,
  ): Promise<AiCustomPromptData> {
    const name = dto.name?.trim();
    const body = dto.body?.trim();
    if (!name) throw new BadRequestException('Informe o nome do prompt.');
    if (!body) throw new BadRequestException('Informe o conteúdo do prompt.');
    // A tela manda a LISTA; o campo singular fica como espelho do primeiro item,
    // para que qualquer leitor antigo continue enxergando o vínculo.
    const instrumentSlugs =
      dto.instrumentSlugs !== undefined
        ? normalizeInstrumentSlugs(dto.instrumentSlugs)
        : normalizeInstrumentSlugs([dto.instrumentSlug]);
    const instrumentSlug = instrumentSlugs[0] ?? null;
    const addonIds = (dto.addonIds ?? []).filter((a): a is string => typeof a === 'string');

    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const created = await this.prisma.admin.aiCustomPrompt.create({
      data: {
        name,
        body,
        instrumentSlug,
        instrumentSlugs,
        addonIds,
        active: dto.active ?? true,
        updatedBy: actor.email,
      },
      include: { files: { select: FILE_META_SELECT, orderBy: { createdAt: 'asc' } } },
    });

    await this.audit.record({
      action: 'ai-prompt.upsert',
      actor,
      target: created.id,
      meta: { name, instrumentSlugs, addonsCount: addonIds.length },
    });
    return this.toData(created);
  }

  async update(
    id: string,
    dto: {
      name?: string;
      body?: string;
      instrumentSlug?: string;
      instrumentSlugs?: string[];
      addonIds?: string[];
      active?: boolean;
    },
    actor: Actor,
  ): Promise<AiCustomPromptData> {
    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const existing = await this.prisma.admin.aiCustomPrompt.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Prompt não encontrado.');

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Informe o nome do prompt.');
    }
    if (dto.body !== undefined && !dto.body.trim()) {
      throw new BadRequestException('Informe o conteúdo do prompt.');
    }

    const addonIds =
      dto.addonIds !== undefined
        ? dto.addonIds.filter((a): a is string => typeof a === 'string')
        : undefined;

    // Lista vazia (nenhum selecionado) = limpar o vínculo com os diagnósticos.
    // Quem só manda o campo singular (chamada antiga) continua funcionando.
    const instrumentSlugs =
      dto.instrumentSlugs !== undefined
        ? normalizeInstrumentSlugs(dto.instrumentSlugs)
        : dto.instrumentSlug !== undefined
          ? normalizeInstrumentSlugs([dto.instrumentSlug])
          : undefined;

    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const updated = await this.prisma.admin.aiCustomPrompt.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
        ...(instrumentSlugs !== undefined
          ? { instrumentSlugs, instrumentSlug: instrumentSlugs[0] ?? null }
          : {}),
        ...(addonIds !== undefined ? { addonIds } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        updatedBy: actor.email,
      },
      include: { files: { select: FILE_META_SELECT, orderBy: { createdAt: 'asc' } } },
    });

    await this.audit.record({
      action: 'ai-prompt.upsert',
      actor,
      target: id,
      meta: {
        name: updated.name,
        instrumentSlugs: updated.instrumentSlugs,
        addonsCount: this.normalizeAddonIds(updated.addonIds).length,
      },
    });
    return this.toData(updated);
  }

  async remove(id: string, actor: Actor): Promise<{ ok: true }> {
    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const existing = await this.prisma.admin.aiCustomPrompt.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Prompt não encontrado.');
    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    await this.prisma.admin.aiCustomPrompt.delete({ where: { id } }); // cascade nos files
    await this.audit.record({
      action: 'ai-prompt.delete',
      actor,
      target: id,
      meta: { name: existing.name },
    });
    return { ok: true };
  }

  async addFile(
    promptId: string,
    dto: { filename: string; mimeType: string; dataBase64: string },
    actor: Actor,
  ): Promise<AiCustomPromptFileMeta> {
    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const prompt = await this.prisma.admin.aiCustomPrompt.findUnique({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException('Prompt não encontrado.');

    if (!dto.dataBase64) throw new BadRequestException('Arquivo vazio.');
    // Cap SERVER-side: o limite do navegador é contornável, e sem este teto um
    // payload gigante viraria linha permanente no Postgres.
    if (dto.dataBase64.length > MAX_BASE64) throw new BadRequestException('Arquivo excede 8 MB.');

    const ext = dto.filename.includes('.')
      ? dto.filename.slice(dto.filename.lastIndexOf('.') + 1).toLowerCase()
      : '';
    if (!(PROMPT_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new BadRequestException(
        `Formato não aceito. Envie um arquivo ${PROMPT_FILE_EXTENSIONS.join(', ')}.`,
      );
    }

    const buf = Buffer.from(dto.dataBase64, 'base64');
    if (buf.length === 0) throw new BadRequestException('Arquivo vazio.');

    const extractedText = await extractTextFromFile(dto.filename, dto.mimeType, buf);

    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const file = await this.prisma.admin.aiCustomPromptFile.create({
      data: {
        promptId,
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: buf.length,
        extractedText,
      },
      select: FILE_META_SELECT,
    });

    await this.audit.record({
      action: 'ai-prompt.file.add',
      actor,
      target: promptId,
      meta: { filename: dto.filename, sizeBytes: buf.length, chars: extractedText.length },
    });
    return this.toFileMeta(file);
  }

  async removeFile(promptId: string, fileId: string, actor: Actor): Promise<{ ok: true }> {
    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const file = await this.prisma.admin.aiCustomPromptFile.findUnique({ where: { id: fileId } });
    if (!file || file.promptId !== promptId) throw new NotFoundException('Arquivo não encontrado.');
    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    await this.prisma.admin.aiCustomPromptFile.delete({ where: { id: fileId } });
    await this.audit.record({
      action: 'ai-prompt.file.remove',
      actor,
      target: promptId,
      meta: { filename: file.filename },
    });
    return { ok: true };
  }

  /**
   * Testa o prompt personalizado no provedor de IA real (mesmo motor central).
   * NUNCA lança por falha de IA — devolve { ok:false, error } amigável, que o
   * painel mostra num <pre>.
   */
  async test(id: string, question?: string): Promise<{ ok: boolean; content?: string; error?: string }> {
    // rls-allow: catálogo control-plane global (prompts personalizados da IA)
    const prompt = await this.prisma.admin.aiCustomPrompt.findUnique({
      where: { id },
      include: { files: { orderBy: { createdAt: 'asc' } } },
    });
    if (!prompt) throw new NotFoundException('Prompt não encontrado.');

    const addonIds = this.normalizeAddonIds(prompt.addonIds);
    let system = prompt.body;

    if (addonIds.length > 0) {
      const names = await this.resolveAddonNames(addonIds);
      system += `\n\nAdicionais contratados vinculados a este prompt: ${names.join(', ')}`;
    }

    const refs = buildPromptReferenceBlocks(
      prompt.files.map((f) => ({ filename: f.filename, extractedText: f.extractedText })),
    );
    if (refs) system += `\n\n${refs}`;

    const r = await this.aiSettings.chat({
      useCase: 'custom_prompt_test',
      tenantId: null,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: question?.trim() || 'Gere uma amostra do resultado deste prompt.' },
      ],
      maxTokens: 1200,
      timeoutMs: 30000,
    });

    if (r.ok) return { ok: true, content: r.content };
    const friendly: Record<string, string> = {
      no_key: 'Nenhum token de IA configurado. Configure a conexão em Provedores e Modelos.',
      timeout: 'A IA demorou demais para responder (timeout de 30s). Tente novamente.',
      network: 'Falha de conexão com o provedor de IA. Verifique a rede e tente novamente.',
      empty: 'O provedor de IA retornou uma resposta vazia.',
    };
    const error =
      r.kind === 'http'
        ? `O provedor de IA retornou erro HTTP ${r.httpStatus ?? '?'}.${r.message ? ` ${r.message}` : ''}`
        : friendly[r.kind] ?? 'Falha na chamada de IA.';
    return { ok: false, error };
  }

  /** Nomes dos adicionais a partir dos moduleCodes (decisão D2): linha do banco
   *  → label; senão o catálogo MODULES; senão o próprio código. */
  private async resolveAddonNames(codes: string[]): Promise<string[]> {
    // rls-allow: catálogo control-plane global (adicionais do catálogo)
    const rows = await this.prisma.admin.addon.findMany({
      where: { moduleCode: { in: codes } },
      select: { moduleCode: true, label: true },
    });
    const byCode = new Map(rows.map((r) => [r.moduleCode, r.label]));
    return codes.map(
      (c) => byCode.get(c) ?? MODULES.find((m) => m.code === c)?.name ?? c,
    );
  }

  private normalizeAddonIds(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  }

  private toFileMeta(f: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }): AiCustomPromptFileMeta {
    return {
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt.toISOString(),
    };
  }

  private toData(r: {
    id: string;
    name: string;
    body: string;
    instrumentSlug: string | null;
    instrumentSlugs: string[];
    addonIds: unknown;
    active: boolean;
    updatedAt: Date;
    files: { id: string; filename: string; mimeType: string; sizeBytes: number; createdAt: Date }[];
  }): AiCustomPromptData {
    // Linha antiga (anterior à coluna de lista) chega com array vazio: a tela
    // precisa ver o vínculo que existe, então caímos no campo singular.
    const instrumentSlugs = r.instrumentSlugs?.length
      ? r.instrumentSlugs
      : r.instrumentSlug
        ? [r.instrumentSlug]
        : [];
    return {
      id: r.id,
      name: r.name,
      body: r.body,
      instrumentSlug: r.instrumentSlug,
      instrumentSlugs,
      addonIds: this.normalizeAddonIds(r.addonIds),
      active: r.active,
      updatedAt: r.updatedAt.toISOString(),
      files: r.files.map((f) => this.toFileMeta(f)),
    };
  }
}
