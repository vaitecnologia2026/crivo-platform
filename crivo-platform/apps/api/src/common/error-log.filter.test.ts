import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost, HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorLogFilter } from './error-log.filter';

/**
 * O filtro tem duas obrigações que se contradizem se implementadas sem cuidado:
 * registrar todo erro E não mudar uma vírgula da resposta. Um `@Catch()` global
 * SUBSTITUI o tratamento padrão do Nest — é o `super.catch` que preserva corpo,
 * status e o log de pilha dos 500. Estes testes travam as duas pontas.
 */

let warns: string[] = [];
let errors: string[] = [];
let debugs: string[] = [];
let superCatch: ReturnType<typeof vi.spyOn>;

const adapter = {} as HttpServer;

function hostFor(req: Record<string, unknown>): ArgumentsHost {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;
}

const REQ = { method: 'POST', originalUrl: '/api/public/diagnostic-lead', requestId: 'abc123' };

beforeEach(() => {
  warns = [];
  errors = [];
  debugs = [];
  vi.spyOn(Logger.prototype, 'warn').mockImplementation((m: unknown) => void warns.push(String(m)));
  vi.spyOn(Logger.prototype, 'error').mockImplementation((m: unknown) => void errors.push(String(m)));
  vi.spyOn(Logger.prototype, 'debug').mockImplementation((m: unknown) => void debugs.push(String(m)));
  superCatch = vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('ErrorLogFilter — registra o erro sem tocar na resposta', () => {
  it('delega SEMPRE ao filtro padrão: é o que mantém corpo e status idênticos', () => {
    new ErrorLogFilter(adapter).catch(new BadRequestException('x'), hostFor({ ...REQ }));
    expect(superCatch).toHaveBeenCalledTimes(1);
  });

  it('4xx vira warn com rota, status e id de correlação', () => {
    new ErrorLogFilter(adapter).catch(
      new BadRequestException({ message: ['email must be an email'] }),
      hostFor({ ...REQ }),
    );
    expect(warns[0]).toContain('POST /api/public/diagnostic-lead -> 400');
    expect(warns[0]).toContain('req=abc123');
    expect(warns[0]).toContain('email must be an email');
  });

  it('erro não tratado vira error de 500', () => {
    new ErrorLogFilter(adapter).catch(new Error('boom'), hostFor({ ...REQ }));
    expect(errors[0]).toContain('-> 500');
    expect(errors[0]).toContain('Error: boom');
  });

  it('403 de guarda aparece — é sinal, não ruído', () => {
    new ErrorLogFilter(adapter).catch(new ForbiddenException('sem acesso'), hostFor({ ...REQ }));
    expect(warns[0]).toContain('-> 403');
  });

  it('404 de rota inexistente é descartado: seriam 109 linhas de scanner por dia', () => {
    new ErrorLogFilter(adapter).catch(
      new NotFoundException('Cannot POST /api/graphql'),
      hostFor({ ...REQ, originalUrl: '/api/graphql' }),
    );
    expect(warns).toHaveLength(0);
    // ...mas a resposta 404 continua sendo produzida normalmente.
    expect(superCatch).toHaveBeenCalledTimes(1);
  });

  it('404 lançado por um controller continua sendo registrado', () => {
    new ErrorLogFilter(adapter).catch(new NotFoundException('Lead não encontrado.'), hostFor({ ...REQ }));
    expect(warns[0]).toContain('Lead não encontrado.');
  });

  it('a querystring NUNCA entra no log: pode carregar e-mail', () => {
    new ErrorLogFilter(adapter).catch(
      new BadRequestException('x'),
      hostFor({ ...REQ, originalUrl: '/api/leads?email=fulano@exemplo.com' }),
    );
    expect(warns[0]).not.toContain('@');
    expect(warns[0]).toContain('/api/leads ->');
  });

  it('401 fica em debug: sessão expirada no portal é rotina', () => {
    class Unauthorized extends BadRequestException {
      getStatus() {
        return 401;
      }
    }
    new ErrorLogFilter(adapter).catch(new Unauthorized('token expirado'), hostFor({ ...REQ }));
    expect(warns).toHaveLength(0);
    expect(debugs[0]).toContain('-> 401');
  });

  it('identifica o ator quando a requisição é autenticada', () => {
    new ErrorLogFilter(adapter).catch(
      new ForbiddenException('sem acesso'),
      hostFor({ ...REQ, user: { email: 'rh@empresa.com', tenantId: 'tenant-1' } }),
    );
    expect(warns[0]).toContain('ator=rh@empresa.com');
    expect(warns[0]).toContain('tenant=tenant-1');
  });

  it('falha ao logar não impede a resposta de sair', () => {
    // Requisição sem os campos esperados: o `record` quebra, o cliente não.
    const quebrado = { get method() { throw new Error('req corrompida'); } };
    expect(() => new ErrorLogFilter(adapter).catch(new Error('x'), hostFor(quebrado))).not.toThrow();
    expect(superCatch).toHaveBeenCalledTimes(1);
  });

  it('mensagem gigante é truncada para não estourar a linha', () => {
    new ErrorLogFilter(adapter).catch(
      new BadRequestException({ message: Array.from({ length: 200 }, (_, i) => `campo${i} inválido`) }),
      hostFor({ ...REQ }),
    );
    expect(warns[0].length).toBeLessThan(500);
  });
});
