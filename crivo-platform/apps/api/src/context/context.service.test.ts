import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ContextService,
  DIRECTIVE_TRANSITIONS,
  DOCUMENT_TRANSITIONS,
  bumpVersion,
  parseDocumentInput,
} from './context.service';

/**
 * Contexto e Diretrizes — o que estes testes prendem são as REGRAS do ciclo
 * de vida, não a persistência: (1) só transições da tabela são aceitas e
 * revogar exige justificativa; (2) aprovar grava quem/quando; editar uma
 * diretriz aprovada a devolve a rascunho com versão +1; (3) `replace` cria a
 * nova versão como RASCUNHO, marca a anterior SUBSTITUIDO e troca o vínculo
 * nos casos de uso; (4) o toggle "uso contextual ativo" só liga com o
 * adicional premium; (5) o corpo multipart é normalizado e validado.
 */

const TENANT = 'org-1';
const ACTOR = { id: 'user-1', name: 'Renata Dias', email: 'renata@empresa.com' };

function prismaCom(tx: Record<string, unknown>, admin: Record<string, unknown> = {}) {
  const forTenant = vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx));
  return { forTenant, admin };
}
const auditFalso = () => ({ record: vi.fn(async () => undefined) });

const diretriz = (extra: Record<string, unknown> = {}) => ({
  id: 'dir-1', title: 'Missão', text: 'Impulsionar decisões conscientes.', status: 'RASCUNHO', version: 1,
  approvedByUserId: null, approvedByName: null, approvedAt: null, revokeJustification: null,
  createdAt: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date('2026-09-01T00:00:00Z'),
  ...extra,
});

const documento = (extra: Record<string, unknown> = {}) => ({
  id: 'doc-1', code: 'D-001', title: 'Código de Conduta', kind: 'Política', cnpj: null, unitId: null,
  version: 'v3.0', issuedAt: null, owner: 'Compliance', purpose: 'Referência ética', modules: ['lider'],
  accessLevel: 'Todos', status: 'APROVADO_PUBLICADO', replacedById: null, revokeJustification: null,
  url: null, fileName: 'conduta.pdf', fileMime: 'application/pdf', fileSize: 10, extractedChars: 120,
  approvedByName: 'Renata', approvedAt: new Date('2026-09-02T00:00:00Z'),
  createdAt: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date('2026-09-02T00:00:00Z'), unit: null,
  ...extra,
});

describe('tabelas de transição', () => {
  it('SUBSTITUIDO e REVOGADO são terminais; SUBSTITUIDO nunca é alvo de transição manual', () => {
    expect(DOCUMENT_TRANSITIONS.SUBSTITUIDO).toEqual([]);
    expect(DOCUMENT_TRANSITIONS.REVOGADO).toEqual([]);
    for (const targets of Object.values(DOCUMENT_TRANSITIONS)) expect(targets).not.toContain('SUBSTITUIDO');
    expect(DIRECTIVE_TRANSITIONS.REVOGADA).toEqual([]);
  });

  it('APROVADO só nasce de EM_REVISAO (nunca direto de RASCUNHO)', () => {
    expect(DOCUMENT_TRANSITIONS.RASCUNHO).not.toContain('APROVADO_PUBLICADO');
    expect(DOCUMENT_TRANSITIONS.EM_REVISAO).toContain('APROVADO_PUBLICADO');
    expect(DIRECTIVE_TRANSITIONS.RASCUNHO).not.toContain('APROVADA');
    expect(DIRECTIVE_TRANSITIONS.EM_REVISAO).toContain('APROVADA');
  });
});

describe('ContextService — diretrizes', () => {
  function montar(status = 'EM_REVISAO') {
    const updated: Record<string, unknown>[] = [];
    const tx = {
      tenantDirective: {
        findUnique: vi.fn(async () => diretriz({ status })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => { updated.push(args.data); return diretriz({ status, ...args.data }); }),
      },
    };
    const audit = auditFalso();
    const svc = new ContextService(prismaCom(tx) as never, audit as never);
    return { svc, tx, audit, updated };
  }

  it('transição fora da tabela é recusada (RASCUNHO → APROVADA) e nada é gravado', async () => {
    const { svc, updated, audit } = montar('RASCUNHO');
    await expect(svc.changeDirectiveStatus(TENANT, 'dir-1', { status: 'APROVADA' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(updated).toHaveLength(0);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('aprovar grava quem aprovou e quando; audita a transição', async () => {
    const { svc, updated, audit } = montar('EM_REVISAO');
    const out = await svc.changeDirectiveStatus(TENANT, 'dir-1', { status: 'APROVADA' }, ACTOR);
    expect(updated[0]).toMatchObject({ status: 'APROVADA', approvedByUserId: 'user-1', approvedByName: 'Renata Dias' });
    expect(updated[0].approvedAt).toBeInstanceOf(Date);
    expect(out.status).toBe('APROVADA');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'context.directive.status', tenantId: TENANT, target: 'dir-1',
      meta: expect.objectContaining({ from: 'EM_REVISAO', to: 'APROVADA' }),
    }));
  });

  it('revogar sem justificativa (vazia ou só espaço) é recusado; com justificativa grava o motivo', async () => {
    const { svc, updated } = montar('APROVADA');
    await expect(svc.changeDirectiveStatus(TENANT, 'dir-1', { status: 'REVOGADA', justification: '   ' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(updated).toHaveLength(0);
    await svc.changeDirectiveStatus(TENANT, 'dir-1', { status: 'REVOGADA', justification: 'Substituída pela política 2027.' }, ACTOR);
    expect(updated[0]).toMatchObject({ status: 'REVOGADA', revokeJustification: 'Substituída pela política 2027.' });
  });

  it('editar uma diretriz APROVADA a devolve a RASCUNHO com versão +1 e limpa a aprovação', async () => {
    const { svc, updated } = montar('APROVADA');
    const out = await svc.updateDirective(TENANT, 'dir-1', { title: 'Missão', text: 'Texto novo' }, ACTOR);
    expect(updated[0]).toMatchObject({ status: 'RASCUNHO', version: 2, approvedByUserId: null, approvedAt: null, text: 'Texto novo' });
    expect(out.status).toBe('RASCUNHO');
  });

  it('editar um rascunho não mexe em status nem versão', async () => {
    const { svc, updated } = montar('RASCUNHO');
    await svc.updateDirective(TENANT, 'dir-1', { title: 'Missão', text: 'Ajuste' }, ACTOR);
    expect(updated[0]).not.toHaveProperty('status');
    expect(updated[0]).not.toHaveProperty('version');
  });

  it('diretriz revogada não pode ser editada', async () => {
    const { svc } = montar('REVOGADA');
    await expect(svc.updateDirective(TENANT, 'dir-1', { title: 'x', text: 'y' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ContextService — documentos: status, revogação e substituição', () => {
  function montar(status = 'APROVADO_PUBLICADO', links: { id: string; documentIds: string[] }[] = []) {
    const updates: { where: { id: string }; data: Record<string, unknown> }[] = [];
    const created: Record<string, unknown>[] = [];
    const linkUpdates: { where: { id: string }; data: { documentIds: string[] } }[] = [];
    const tx = {
      tenantDocument: {
        findUnique: vi.fn(async () => documento({ status })),
        findMany: vi.fn(async (args?: { select?: Record<string, boolean>; where?: Record<string, unknown> }) => {
          // nextCode lê só {code}; codesOf lê {id, code}.
          if (args?.select?.code && !args.select.id) return [{ code: 'D-001' }, { code: 'D-007' }];
          return [{ id: 'doc-1', code: 'D-001' }, { id: 'doc-new', code: 'D-008' }];
        }),
        update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => { updates.push(args); return documento({ status, ...args.data }); }),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => { created.push(args.data); return documento({ id: 'doc-new', status: 'RASCUNHO', ...args.data }); }),
      },
      tenantDocumentFile: { create: vi.fn(async () => undefined) },
      tenantAiUseCaseContext: {
        findMany: vi.fn(async () => links),
        update: vi.fn(async (args: { where: { id: string }; data: { documentIds: string[] } }) => { linkUpdates.push(args); return args; }),
      },
    };
    const audit = auditFalso();
    const svc = new ContextService(prismaCom(tx) as never, audit as never);
    return { svc, tx, audit, updates, created, linkUpdates };
  }

  it('revogar exige justificativa; com ela marca REVOGADO e tira o documento de todos os casos de uso', async () => {
    const { svc, updates, linkUpdates, audit } = montar('APROVADO_PUBLICADO', [{ id: 'uc-1', documentIds: ['doc-1', 'doc-2'] }]);
    await expect(svc.revokeDocument(TENANT, 'doc-1', '', ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(updates).toHaveLength(0);

    const out = await svc.revokeDocument(TENANT, 'doc-1', 'Política desatualizada.', ACTOR);
    expect(out.status).toBe('REVOGADO');
    expect(updates[0].data).toMatchObject({ status: 'REVOGADO', revokeJustification: 'Política desatualizada.' });
    expect(linkUpdates).toEqual([{ where: { id: 'uc-1' }, data: { documentIds: ['doc-2'] } }]);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'context.document.revoke', target: 'D-001' }));
  });

  it('POST status com REVOGADO delega à revogação (justificativa obrigatória) e SUBSTITUIDO é recusado', async () => {
    const { svc } = montar('APROVADO_PUBLICADO');
    await expect(svc.changeDocumentStatus(TENANT, 'doc-1', { status: 'REVOGADO' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.changeDocumentStatus(TENANT, 'doc-1', { status: 'SUBSTITUIDO' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aprovar (EM_REVISAO → APROVADO_PUBLICADO) grava aprovador e data', async () => {
    const { svc, updates } = montar('EM_REVISAO');
    await svc.changeDocumentStatus(TENANT, 'doc-1', { status: 'APROVADO_PUBLICADO' }, ACTOR);
    expect(updates[0].data).toMatchObject({ status: 'APROVADO_PUBLICADO', approvedByUserId: 'user-1', approvedByName: 'Renata Dias' });
  });

  it('substituir: cria D-008 como RASCUNHO com versão incrementada, marca o anterior SUBSTITUIDO e troca o vínculo nos casos de uso', async () => {
    const { svc, updates, created, linkUpdates, audit } = montar('APROVADO_PUBLICADO', [{ id: 'uc-1', documentIds: ['doc-1'] }]);
    const out = await svc.replaceDocument(TENANT, 'doc-1', { url: 'https://intranet/conduta-v4.pdf' }, undefined, ACTOR);

    // Nova versão: código sequencial (maior usado era D-007), rascunho, metadados herdados.
    expect(created[0]).toMatchObject({ code: 'D-008', title: 'Código de Conduta', version: 'v3.1', url: 'https://intranet/conduta-v4.pdf', modules: ['lider'] });
    expect(created[0]).not.toHaveProperty('status'); // default RASCUNHO no banco
    expect(out.code).toBe('D-008');
    expect(out.status).toBe('RASCUNHO');
    // Anterior: SUBSTITUIDO apontando para a nova.
    expect(updates[0]).toMatchObject({ where: { id: 'doc-1' }, data: { status: 'SUBSTITUIDO', replacedById: 'doc-new' } });
    // Vínculo do caso de uso migra para a nova versão (que só alimenta a IA quando aprovada).
    expect(linkUpdates).toEqual([{ where: { id: 'uc-1' }, data: { documentIds: ['doc-new'] } }]);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'context.document.replace', meta: expect.objectContaining({ replacedBy: 'D-008' }) }));
  });

  it('substituir aceita versão explícita e recusa documento já substituído/revogado', async () => {
    const a = montar('APROVADO_PUBLICADO');
    await a.svc.replaceDocument(TENANT, 'doc-1', { url: 'https://x/y', version: 'v4.0' }, undefined, ACTOR);
    expect(a.created[0]).toMatchObject({ version: 'v4.0' });

    const b = montar('SUBSTITUIDO');
    await expect(b.svc.replaceDocument(TENANT, 'doc-1', { url: 'https://x/y' }, undefined, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(b.created).toHaveLength(0);
  });

  it('substituir sem arquivo nem URL é recusado antes de tocar o banco', async () => {
    const { svc, tx } = montar();
    await expect(svc.replaceDocument(TENANT, 'doc-1', {}, undefined, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.tenantDocument.findUnique).not.toHaveBeenCalled();
  });
});

describe('ContextService — casos de uso da IA', () => {
  function montar(customAiAllowed: boolean, docs: { id: string; status: string }[] = []) {
    const upserts: Record<string, unknown>[] = [];
    const tx = {
      tenantDocument: {
        findMany: vi.fn(async (args?: { select?: Record<string, boolean> }) =>
          args?.select?.status ? docs : docs.map((d) => ({ id: d.id, code: `D-${d.id}` }))),
      },
      tenantAiUseCaseContext: {
        upsert: vi.fn(async (args: { create: Record<string, unknown> }) => { upserts.push(args); return { ...args.create, updatedAt: new Date() }; }),
      },
    };
    const admin = {
      contract: { findFirst: vi.fn(async () => ({ productId: 'prod-1' })) },
      product: { findUnique: vi.fn(async () => ({ allowsCustomAi: customAiAllowed })) },
    };
    const svc = new ContextService(prismaCom(tx, admin) as never, auditFalso() as never);
    return { svc, upserts, tx };
  }

  it('ligar o uso contextual sem o adicional premium (allowsCustomAi=false) é recusado com mensagem honesta', async () => {
    const { svc, upserts } = montar(false);
    await expect(svc.updateAiUseCase(TENANT, 'copiloto', { documentIds: [], active: true }, ACTOR)).rejects.toThrow(/adicional premium/);
    expect(upserts).toHaveLength(0);
  });

  it('sem o adicional ainda é possível guardar a lista de documentos (active=false)', async () => {
    const { svc, upserts } = montar(false, [{ id: 'a', status: 'APROVADO_PUBLICADO' }]);
    const out = await svc.updateAiUseCase(TENANT, 'copiloto', { documentIds: ['a'], active: false }, ACTOR);
    expect(upserts).toHaveLength(1);
    expect(out).toMatchObject({ useCase: 'copiloto', active: false, documentCodes: ['D-a'] });
  });

  it('caso de uso fora da Central de Prompts é recusado', async () => {
    const { svc } = montar(true);
    await expect(svc.updateAiUseCase(TENANT, 'mentor_crivo', { documentIds: [], active: true }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('documento substituído/revogado não pode ser vinculado; inexistente dá 404', async () => {
    const { svc } = montar(true, [{ id: 'a', status: 'REVOGADO' }]);
    await expect(svc.updateAiUseCase(TENANT, 'copiloto', { documentIds: ['a'], active: true }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateAiUseCase(TENANT, 'copiloto', { documentIds: ['zzz'], active: true }, ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('parseDocumentInput (multipart ou JSON)', () => {
  const base = { title: 'Código de Conduta', kind: 'Política', owner: 'Compliance', purpose: 'Ética', accessLevel: 'Todos' };

  it('aceita modules como array, JSON string ou lista separada por vírgula — só códigos de MODULES', () => {
    expect(parseDocumentInput({ ...base, modules: ['lider', 'icd'] }).modules).toEqual(['lider', 'icd']);
    expect(parseDocumentInput({ ...base, modules: '["lider","icd"]' }).modules).toEqual(['lider', 'icd']);
    expect(parseDocumentInput({ ...base, modules: 'lider, icd' }).modules).toEqual(['lider', 'icd']);
    expect(parseDocumentInput({ ...base }).modules).toEqual([]);
    expect(() => parseDocumentInput({ ...base, modules: ['Liderança'] })).toThrow(/desconhecido/);
  });

  it('campos obrigatórios e URL válida; versão default v1.0', () => {
    expect(() => parseDocumentInput({ ...base, title: '' })).toThrow(/obrigatório/);
    expect(() => parseDocumentInput({ ...base, url: 'intranet/doc' })).toThrow(/http/);
    const out = parseDocumentInput({ ...base, url: 'https://intranet/doc', cnpj: ' 12.345.678/0001-00 ' });
    expect(out).toMatchObject({ version: 'v1.0', url: 'https://intranet/doc', cnpj: '12.345.678/0001-00', unitId: null });
  });
});

describe('bumpVersion', () => {
  it('incrementa o menor número presente', () => {
    expect(bumpVersion('v1.0')).toBe('v1.1');
    expect(bumpVersion('v3')).toBe('v4');
    expect(bumpVersion('2.9')).toBe('2.10');
    expect(bumpVersion('final')).toBe('final-r2');
  });
});
