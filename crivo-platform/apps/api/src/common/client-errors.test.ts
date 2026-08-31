import { Logger } from '@nestjs/common';
import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientErrorsController, type ClientErrorDto } from './client-errors.controller';

/**
 * O corpo desta rota é escrito por um navegador que não controlamos e vai
 * DIRETO para o arquivo de log. Se uma quebra de linha passar, dá para forjar
 * linhas inteiras dentro do log — que é justamente o registro em que a gente
 * vai confiar para investigar. Estes testes travam isso.
 */

let warns: string[] = [];

function req(userAgent = 'Mozilla/5.0'): Request {
  return { header: () => userAgent } as unknown as Request;
}

function body(over: Partial<ClientErrorDto> = {}): ClientErrorDto {
  return {
    app: 'portal',
    screen: '/plataforma#documentos',
    message: 'TimeoutError: signal timed out',
    kind: 'rede',
    requestId: 'abc12345',
    ...over,
  } as ClientErrorDto;
}

beforeEach(() => {
  warns = [];
  vi.spyOn(Logger.prototype, 'warn').mockImplementation((m: unknown) => void warns.push(String(m)));
});

afterEach(() => vi.restoreAllMocks());

describe('ClientErrorsController — o que o servidor não vê, sem virar vetor', () => {
  it('registra tela, origem, código e mensagem', () => {
    new ClientErrorsController().report(body(), req());
    expect(warns[0]).toContain('portal//plataforma#documentos');
    expect(warns[0]).toContain('origem=rede');
    expect(warns[0]).toContain('req=abc12345');
    expect(warns[0]).toContain('TimeoutError');
  });

  it('quebra de linha do cliente NÃO cria linha nova no log', () => {
    new ClientErrorsController().report(
      body({ message: 'erro\n2026-01-01T00:00:00.000Z ERROR [Http] linha forjada' }),
      req(),
    );
    expect(warns[0]).not.toContain('\n');
    expect(warns[0]).toContain('linha forjada'); // vira texto, não linha
  });

  it('trunca mensagem gigante', () => {
    new ClientErrorsController().report(body({ message: 'x'.repeat(5000) }), req());
    expect(warns[0].length).toBeLessThan(800);
  });

  it('navegador sem user-agent não quebra a linha', () => {
    new ClientErrorsController().report(body(), { header: () => undefined } as unknown as Request);
    expect(warns[0]).toContain('navegador=-');
  });

  it('sem requestId, registra mesmo assim', () => {
    new ClientErrorsController().report(body({ requestId: undefined }), req());
    expect(warns[0]).toContain('req=-');
  });

  it('não devolve corpo (204): é diagnóstico, não conversa', () => {
    expect(new ClientErrorsController().report(body(), req())).toBeUndefined();
  });
});
