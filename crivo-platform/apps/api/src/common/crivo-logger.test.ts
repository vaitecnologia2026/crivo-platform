import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrivoLogger } from './crivo-logger';

/**
 * O logger existe para o arquivo do servidor ser legível — e o maior risco de
 * trocar o logger padrão é ESCONDER alguma coisa. Estes testes travam
 * exatamente isso: nada de ANSI, timestamp em UTC, pilha preservada, e a
 * supressão do dump de boot restrita ao nível `log` (um warn do mesmo contexto
 * continua saindo).
 */

/** Início de toda sequência de cor ANSI. */
const ESC = String.fromCharCode(27);

let out: string[] = [];
let err: string[] = [];

beforeEach(() => {
  out = [];
  err = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    out.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    err.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.LOG_BOOT;
});

describe('CrivoLogger — o formato que o arquivo de log precisa ter', () => {
  it('não emite código de cor: o systemd grava em arquivo, não num terminal', () => {
    new CrivoLogger().log('mensagem', 'Servico');
    expect(out.join('')).not.toContain(ESC);
  });

  it('usa timestamp ISO em UTC, para casar com o log do nginx', () => {
    new CrivoLogger().log('mensagem', 'Servico');
    expect(out[0]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z LOG {3}\[Servico\] mensagem\n$/,
    );
  });

  it('erro vai para stderr e carrega a pilha', () => {
    new CrivoLogger().error('quebrou', 'Error: x\n    at y', 'Servico');
    expect(err.join('')).toContain('ERROR [Servico] quebrou');
    expect(err.join('')).toContain('    at y');
  });

  it('não imprime "undefined" quando o Nest passa error(msg, undefined, ctx)', () => {
    // É literalmente o que `Logger.prototype.error` produz internamente.
    new CrivoLogger().error('sem pilha', undefined, 'Servico');
    expect(err.join('')).toContain('[Servico] sem pilha');
    expect(err.join('')).not.toContain('undefined');
  });

  it('preserva a pilha quando o Nest loga o objeto Error cru', () => {
    // O BaseExceptionFilter chama `logger.error(exception)` com o Error inteiro:
    // sem este tratamento a pilha de TODO 500 se perderia.
    new CrivoLogger().error(new Error('boom'), 'ExceptionsHandler');
    expect(err.join('')).toContain('Error: boom');
    expect(err.join('')).toContain('crivo-logger.test');
  });

  it('objeto não vira [object Object]', () => {
    new CrivoLogger().log({ lead: 'abc', tentativas: 2 }, 'Servico');
    expect(out[0]).toContain("lead: 'abc'");
    expect(out[0]).not.toContain('[object Object]');
  });

  it('objeto circular não derruba a requisição', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => new CrivoLogger().log(circular, 'Servico')).not.toThrow();
  });

  it('suprime o dump de rotas do boot (16.722 linhas por reinício)', () => {
    new CrivoLogger().log('Mapped {/api/x, GET} route', 'RouterExplorer');
    expect(out).toHaveLength(0);
  });

  it('mas NUNCA suprime warn/error do mesmo contexto', () => {
    new CrivoLogger().warn('rota duplicada', 'RouterExplorer');
    expect(out.join('')).toContain('rota duplicada');
  });

  it('mantém a prova de vida do boot (NestApplication e Bootstrap)', () => {
    const log = new CrivoLogger();
    log.log('Nest application successfully started', 'NestApplication');
    log.log('CRIVO API ouvindo na porta 3046', 'Bootstrap');
    expect(out).toHaveLength(2);
  });

  it('LOG_BOOT=1 traz o dump de volta sem redeploy', () => {
    process.env.LOG_BOOT = '1';
    new CrivoLogger().log('Mapped {/api/x, GET} route', 'RouterExplorer');
    expect(out).toHaveLength(1);
  });

  it('debug fica fora do arquivo no nível padrão', () => {
    new CrivoLogger().debug('detalhe', 'Servico');
    expect(out).toHaveLength(0);
    new CrivoLogger('debug').debug('detalhe', 'Servico');
    expect(out).toHaveLength(1);
  });
});
