import { describe, expect, it } from 'vitest';
import {
  REPORT_PLACEHOLDER_KEYS,
  fillReportPlaceholders,
  findReportPlaceholders,
  stripEmptyReportBlocks,
} from './index';

/**
 * Marcadores do modelo FIEL: é o que faz o relatório sair com o layout do
 * arquivo importado, trocando só os dados do diagnóstico — na posição em que o
 * cliente os desenhou.
 */
describe('findReportPlaceholders', () => {
  it('separa marcadores reconhecidos dos desconhecidos', () => {
    const out = findReportPlaceholders('<p>{{empresa}} {{cnpj}} {{inventado}}</p>');
    expect(out.known.sort()).toEqual(['cnpj', 'empresa']);
    expect(out.unknown).toEqual(['inventado']);
  });

  it('tolera espaços e caixa alta', () => {
    expect(findReportPlaceholders('{{ EMPRESA }}').known).toEqual(['empresa']);
  });
});

describe('fillReportPlaceholders', () => {
  it('substitui na POSIÇÃO do marcador, preservando o HTML em volta', () => {
    const out = fillReportPlaceholders(
      '<h2>Panorama</h2><p>{{tabela_dimensoes}}</p><h2>Síntese</h2>',
      (k) => (k === 'tabela_dimensoes' ? '<table class="grid"></table>' : ''),
    );
    expect(out.html).toBe('<h2>Panorama</h2><p><table class="grid"></table></p><h2>Síntese</h2>');
    expect(out.used).toEqual(['tabela_dimensoes']);
  });

  it('remove marcador desconhecido (o cliente nunca vê "{{xyz}}" cru)', () => {
    const out = fillReportPlaceholders('<p>a {{xyz}} b</p>', () => 'X');
    expect(out.html).toBe('<p>a  b</p>');
    expect(out.unknown).toEqual(['xyz']);
  });

  it('marcador sem dado não deixa parágrafo vazio no documento', () => {
    const out = fillReportPlaceholders('<p>{{score}}</p><p>fim</p>', () => null);
    expect(out.html).toBe('<p>fim</p>');
    expect(out.used).toEqual([]);
  });

  it('não marca como usado o que resolveu vazio (o gerador ainda anexa o bloco)', () => {
    const out = fillReportPlaceholders('<p>{{plano_acao}}</p>', (k) => (k === 'plano_acao' ? '' : null));
    expect(out.used).toEqual([]);
  });

  it('todas as chaves do vocabulário são resolvíveis', () => {
    const html = REPORT_PLACEHOLDER_KEYS.map((k) => `<p>{{${k}}}</p>`).join('');
    const out = fillReportPlaceholders(html, () => 'ok');
    expect(out.used.sort()).toEqual([...REPORT_PLACEHOLDER_KEYS].sort());
    expect(out.unknown).toEqual([]);
  });
});

describe('stripEmptyReportBlocks', () => {
  it('remove blocos vazios em cascata', () => {
    expect(stripEmptyReportBlocks('<li><p>  </p></li><p>fim</p>')).toBe('<p>fim</p>');
  });

  it('preserva bloco com conteúdo', () => {
    expect(stripEmptyReportBlocks('<p>texto</p>')).toBe('<p>texto</p>');
  });
});
