import { describe, it, expect } from 'vitest';
import { mensagemDeErroApi } from './index';

describe('mensagemDeErroApi — validação do NestJS vira frase em português', () => {
  it('aponta o item exato de uma coleção (caso real do Motor)', () => {
    // Log de produção 2026-09-02: o operador só via "Erro na requisição (HTTP 400)".
    const corpo = { message: ['factors.2.label must be shorter than or equal to 160 characters'], statusCode: 400 };
    expect(mensagemDeErroApi(corpo, 400)).toBe('3º fator: o nome passa do limite de 160 caracteres');
  });

  it('usa gênero e posição corretos (faixa = feminino, índice + 1)', () => {
    const corpo = { message: ['bands.3.min must not be greater than 100'] };
    expect(mensagemDeErroApi(corpo, 400)).toBe('4ª faixa: o valor mínimo não pode ser maior que 100');
  });

  it('traduz as demais regras comuns', () => {
    expect(mensagemDeErroApi({ message: ['questions.0.text should not be empty'] }, 400))
      .toBe('1ª pergunta: o texto não pode ficar em branco');
    expect(mensagemDeErroApi({ message: ['factors.1.severity must be an integer number'] }, 400))
      .toBe('2º fator: a severidade precisa ser um número inteiro');
    expect(mensagemDeErroApi({ message: ['dimensions.0.slug must not be less than 1'] }, 400))
      .toBe('1ª dimensão: o identificador não pode ser menor que 1');
  });

  it('campo sem índice sai como frase única, com inicial maiúscula', () => {
    expect(mensagemDeErroApi({ message: ['email must be an email'] }, 400))
      .toBe('O e-mail precisa ser um e-mail válido');
  });

  it('explica campo recusado pelo forbidNonWhitelisted', () => {
    expect(mensagemDeErroApi({ message: ['property foo should not exist'] }, 400))
      .toBe('o campo "foo" não é aceito por esta versão da plataforma');
  });

  it('mostra no máximo 3 problemas e conta o resto', () => {
    const corpo = {
      message: [
        'factors.0.label should not be empty',
        'factors.1.label should not be empty',
        'factors.2.label should not be empty',
        'factors.3.label should not be empty',
        'factors.4.label should not be empty',
      ],
    };
    const msg = mensagemDeErroApi(corpo, 400);
    expect(msg).toContain('1º fator: o nome não pode ficar em branco');
    expect(msg).toContain('3º fator');
    expect(msg).not.toContain('4º fator');
    expect(msg).toContain('(e mais 2 problemas)');
  });

  it('mensagem de negócio (string) passa intacta', () => {
    expect(mensagemDeErroApi({ message: 'Apenas rascunhos podem ser editados.' }, 400))
      .toBe('Apenas rascunhos podem ser editados.');
  });

  it('sem mensagem utilizável, cai no genérico com o status', () => {
    expect(mensagemDeErroApi({}, 500)).toBe('Erro na requisição (HTTP 500)');
    expect(mensagemDeErroApi(null, 502)).toBe('Erro na requisição (HTTP 502)');
    expect(mensagemDeErroApi({ message: [] }, 400)).toBe('Erro na requisição (HTTP 400)');
  });

  it('regra desconhecida preserva o texto original, com o campo traduzido', () => {
    expect(mensagemDeErroApi({ message: ['factors.0.label must smell nice'] }, 400))
      .toBe('1º fator: o nome must smell nice');
  });
});
