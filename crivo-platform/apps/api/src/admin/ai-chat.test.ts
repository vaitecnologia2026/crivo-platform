import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSettingsService } from './ai-settings.service';

/**
 * Motor de IA — chamada central chat(): mapeamento de erro do provedor e
 * telemetria em ai_call_logs (tokens/latência/erro por chamada).
 */

function makeService() {
  const created: any[] = [];
  const prisma = {
    admin: {
      aiCallLog: {
        create: vi.fn(async (args: any) => {
          created.push(args.data);
          return args.data;
        }),
      },
    },
  } as any;
  const svc = new AiSettingsService(prisma, { record: vi.fn() } as any);
  vi.spyOn(svc, 'getApiKey').mockResolvedValue('sk-test');
  vi.spyOn(svc, 'get').mockResolvedValue({
    provider: 'openai',
    model: 'gpt-4o-mini',
    enabled: true,
    enabledModules: [],
    hasKey: true,
    keyHint: 'test',
    lastStatus: 'ok',
    lastTestedAt: null,
  });
  return { svc, created };
}

const ARGS = {
  useCase: 'copiloto',
  tenantId: 'org-1',
  messages: [{ role: 'user' as const, content: 'olá' }],
};

describe('AiSettingsService.chat (motor central de IA)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sucesso: devolve conteúdo e grava telemetria com tokens', async () => {
    const { svc, created } = makeService();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: ' resposta ' } }],
        usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 },
      }),
    });
    const r = await svc.chat(ARGS);
    expect(r).toMatchObject({ ok: true, content: 'resposta', model: 'gpt-4o-mini' });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      tenantId: 'org-1',
      useCase: 'copiloto',
      ok: true,
      promptTokens: 12,
      completionTokens: 34,
      totalTokens: 46,
    });
    expect(typeof created[0].latencyMs).toBe('number');
  });

  it('HTTP 429: kind http com status e log de erro', async () => {
    const { svc, created } = makeService();
    (fetch as any).mockResolvedValue({ ok: false, status: 429 });
    const r = await svc.chat(ARGS);
    expect(r).toMatchObject({ ok: false, kind: 'http', httpStatus: 429 });
    expect(created[0]).toMatchObject({ ok: false, errorReason: 'HTTP 429' });
  });

  it('timeout: kind timeout e log com motivo', async () => {
    const { svc, created } = makeService();
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    (fetch as any).mockRejectedValue(err);
    const r = await svc.chat(ARGS);
    expect(r).toMatchObject({ ok: false, kind: 'timeout' });
    expect(created[0].ok).toBe(false);
    expect(String(created[0].errorReason)).toContain('timeout');
  });

  it('resposta vazia: kind empty (logada como falha)', async () => {
    const { svc, created } = makeService();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    const r = await svc.chat(ARGS);
    expect(r).toMatchObject({ ok: false, kind: 'empty' });
    expect(created[0]).toMatchObject({ ok: false, errorReason: 'resposta vazia' });
  });

  it('corpo inválido (200 com JSON quebrado): vira kind network e É logado', async () => {
    const { svc, created } = makeService();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });
    const r = await svc.chat(ARGS);
    expect(r).toMatchObject({ ok: false, kind: 'network' });
    expect(created[0].ok).toBe(false);
    expect(String(created[0].errorReason)).toContain('corpo inválido');
  });

  it('sem token: kind no_key e NADA é logado (não houve chamada)', async () => {
    const { svc, created } = makeService();
    (svc.getApiKey as any).mockResolvedValue(null);
    const r = await svc.chat(ARGS);
    expect(r).toMatchObject({ ok: false, kind: 'no_key' });
    expect(created).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falha ao gravar telemetria NÃO derruba a resposta (best-effort)', async () => {
    const { svc } = makeService();
    ((svc as any).prisma.admin.aiCallLog.create as any).mockRejectedValue(new Error('db down'));
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    const r = await svc.chat(ARGS);
    expect(r).toMatchObject({ ok: true, content: 'ok' });
  });
});
