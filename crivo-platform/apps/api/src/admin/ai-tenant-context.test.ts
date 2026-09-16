import { describe, expect, it, vi } from 'vitest';
import { AiSettingsService } from './ai-settings.service';
import { formatAiDirectives } from './ai-directives';
import { formatTenantContext, MAX_DOCUMENT_CHARS } from '../context/tenant-context-prompt';

/**
 * Integração do módulo Contexto e Diretrizes ao prompt (buildTenantDirectives /
 * buildTenantContext). O que se prende aqui: (1) sem nada cadastrado a saída
 * é IDÊNTICA à anterior (só Product.aiConfig); (2) só diretriz APROVADA e
 * documento APROVADO_PUBLICADO do caso de uso ATIVO entram — a consulta pede
 * exatamente esses status; (3) sem allowsCustomAi nada entra (gate comercial);
 * (4) o que entrou é devolvido para ir ao AiCallLog; (5) falha de banco não
 * derruba a IA.
 */

const AI_CONFIG = { objective: 'Reduzir rotatividade', rules: 'Tom formal' };
const BASE = formatAiDirectives(AI_CONFIG);

type Fixture = {
  allowsCustomAi?: boolean;
  directives?: { id: string; title: string; text: string }[];
  link?: { active: boolean; documentIds: string[] } | null;
  documents?: { id: string; code: string; title: string; kind: string; version: string; purpose: string; url: string | null; extractedText: string | null }[];
};

function makeService(f: Fixture = {}) {
  const queries: Record<string, unknown>[] = [];
  const prisma = {
    admin: {
      contract: { findFirst: vi.fn(async () => ({ productId: 'prod-1' })) },
      product: { findUnique: vi.fn(async () => ({ aiConfig: AI_CONFIG, allowsCustomAi: f.allowsCustomAi ?? true })) },
      tenantDirective: { findMany: vi.fn(async (args: Record<string, unknown>) => { queries.push({ directives: args }); return f.directives ?? []; }) },
      tenantAiUseCaseContext: { findUnique: vi.fn(async (args: Record<string, unknown>) => { queries.push({ link: args }); return f.link ?? null; }) },
      tenantDocument: { findMany: vi.fn(async (args: Record<string, unknown>) => { queries.push({ documents: args }); return f.documents ?? []; }) },
      aiCallLog: { create: vi.fn(async () => undefined) },
    },
  } as any;
  const svc = new AiSettingsService(prisma, { record: vi.fn() } as any);
  return { svc, prisma, queries };
}

describe('buildTenantDirectives — Contexto e Diretrizes no prompt', () => {
  it('tenant sem nada cadastrado: saída idêntica à anterior (só o aiConfig do produto)', async () => {
    const { svc } = makeService();
    expect(await svc.buildTenantDirectives('org-1', 'copiloto')).toBe(BASE);
    // Sem useCase (chamada antiga) também não muda nada.
    expect(await svc.buildTenantDirectives('org-1')).toBe(BASE);
    const ctx = await svc.buildTenantContext('org-1', 'copiloto');
    expect(ctx).toEqual({ text: BASE, directiveIds: [], documentIds: [], documentCodes: [] });
  });

  it('sem organizationId ou sem allowsCustomAi não entra nada (gate do adicional premium)', async () => {
    const { svc } = makeService({ allowsCustomAi: false, directives: [{ id: 'd1', title: 'Missão', text: 'x' }] });
    expect(await svc.buildTenantDirectives('org-1', 'copiloto')).toBe('');
    expect(await svc.buildTenantDirectives(null)).toBe('');
  });

  it('a consulta pede SÓ diretriz APROVADA e documento APROVADO_PUBLICADO, e documentos só do caso de uso ativo', async () => {
    const { svc, queries, prisma } = makeService({
      directives: [{ id: 'd1', title: 'Missão', text: 'Impulsionar decisões conscientes.' }],
      link: { active: true, documentIds: ['doc-2', 'doc-1'] },
      documents: [
        { id: 'doc-1', code: 'D-001', title: 'Código de Conduta', kind: 'Política', version: 'v3.0', purpose: 'Ética', url: null, extractedText: 'Respeito e integridade.' },
        { id: 'doc-2', code: 'D-002', title: 'Manual do Líder', kind: 'Manual', version: 'v1.0', purpose: 'Práticas', url: null, extractedText: 'Feedback semanal.' },
      ],
    });
    const ctx = await svc.buildTenantContext('org-1', 'copiloto');

    expect(queries[0]).toMatchObject({ directives: { where: { tenantId: 'org-1', status: 'APROVADA' } } });
    expect(queries[1]).toMatchObject({ link: { where: { tenantId_useCase: { tenantId: 'org-1', useCase: 'copiloto' } } } });
    expect(queries[2]).toMatchObject({ documents: { where: { tenantId: 'org-1', status: 'APROVADO_PUBLICADO', id: { in: ['doc-2', 'doc-1'] } } } });

    // Ordem: aiConfig (contrato) → diretrizes → documentos, na ordem do caso de uso.
    expect(ctx.text.startsWith(BASE)).toBe(true);
    expect(ctx.text.indexOf('DIRETRIZES INSTITUCIONAIS')).toBeGreaterThan(ctx.text.indexOf('DIRETRIZES APROVADAS DO CLIENTE'));
    expect(ctx.text.indexOf('D-002')).toBeLessThan(ctx.text.indexOf('D-001'));
    expect(ctx.text).toContain('Respeito e integridade.');
    // Rastreabilidade para o AiCallLog.
    expect(ctx.directiveIds).toEqual(['d1']);
    expect(ctx.documentIds).toEqual(['doc-2', 'doc-1']);
    expect(ctx.documentCodes).toEqual(['D-002', 'D-001']);
    expect(prisma.admin.tenantDocument.findMany).toHaveBeenCalledTimes(1);
  });

  it('caso de uso com toggle desligado (ou sem useCase) não lê documento nenhum', async () => {
    const off = makeService({ link: { active: false, documentIds: ['doc-1'] } });
    await off.svc.buildTenantContext('org-1', 'copiloto');
    expect(off.prisma.admin.tenantDocument.findMany).not.toHaveBeenCalled();

    const semCaso = makeService({ link: { active: true, documentIds: ['doc-1'] } });
    await semCaso.svc.buildTenantContext('org-1');
    expect(semCaso.prisma.admin.tenantAiUseCaseContext.findUnique).not.toHaveBeenCalled();
    expect(semCaso.prisma.admin.tenantDocument.findMany).not.toHaveBeenCalled();
  });

  it('falha de banco no contexto não derruba a IA: volta vazio', async () => {
    const { svc, prisma } = makeService();
    prisma.admin.tenantDirective.findMany.mockRejectedValue(new Error('db down'));
    expect(await svc.buildTenantDirectives('org-1', 'copiloto')).toBe('');
  });

  it('chat() grava `meta` no AiCallLog quando o consumidor informa os documentos', async () => {
    const { svc, prisma } = makeService();
    vi.spyOn(svc, 'getApiKey').mockResolvedValue('sk-test');
    vi.spyOn(svc, 'get').mockResolvedValue({ provider: 'openai', model: 'gpt-4o-mini', enabled: true, enabledModules: [], hasKey: true, keyHint: 't', lastStatus: 'ok', lastTestedAt: null });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }], usage: {} }) })));
    try {
      await svc.chat({ useCase: 'copiloto', tenantId: 'org-1', messages: [{ role: 'user', content: 'oi' }], meta: { contextDocuments: ['D-001'] } });
      expect(prisma.admin.aiCallLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ meta: { contextDocuments: ['D-001'] } }) }));
      await svc.chat({ useCase: 'copiloto', tenantId: 'org-1', messages: [{ role: 'user', content: 'oi' }] });
      const last = prisma.admin.aiCallLog.create.mock.calls.at(-1)?.[0].data;
      expect(last).not.toHaveProperty('meta');
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});

describe('formatTenantContext (bloco do prompt)', () => {
  const doc = (extra: Record<string, unknown> = {}) => ({
    id: 'x', code: 'D-001', title: 'Conduta', kind: 'Política', version: 'v1.0', purpose: 'Ética', url: null, extractedText: 'Texto.', ...extra,
  });

  it('vazio quando não há nada — a saída anterior do prompt não muda', () => {
    expect(formatTenantContext([], [])).toBe('');
  });

  it('documento por URL entra só como referência (a IA não navega até lá)', () => {
    const out = formatTenantContext([], [doc({ url: 'https://intranet/doc', extractedText: null })]);
    expect(out).toContain('referência externa: https://intranet/doc');
    expect(out).toContain('conteúdo não incorporado');
  });

  it('respeita o teto por documento (texto gigante é truncado, não omitido)', () => {
    const out = formatTenantContext([], [doc({ extractedText: 'a'.repeat(MAX_DOCUMENT_CHARS + 500) })]);
    expect(out).toContain('[trecho truncado');
    expect(out.length).toBeLessThan(MAX_DOCUMENT_CHARS + 400);
  });
});
