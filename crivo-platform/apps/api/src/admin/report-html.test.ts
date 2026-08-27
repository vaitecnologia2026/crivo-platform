import { describe, expect, it } from 'vitest';
import { autoMarkReportHtml, sanitizeReportHtml } from './report-html';
import { pdfTextToBlocks } from './report-docx-import';

/**
 * O HTML do modelo vem de um arquivo enviado por terceiro e é renderizado no
 * navegador do cliente. `sanitizeReportHtml` é o único portão antes do banco —
 * estes testes são a prova de que ele fecha.
 */
describe('sanitizeReportHtml', () => {
  it('preserva a estrutura do documento (títulos, tabelas, listas, negrito)', () => {
    const html =
      '<h1>Dossiê</h1><p>Texto com <strong>negrito</strong> e <em>itálico</em>.</p>' +
      '<ul><li>Item</li></ul>' +
      '<table><thead><tr><th colspan="2">Dimensão</th></tr></thead><tbody><tr><td>A</td><td>58</td></tr></tbody></table>';
    expect(sanitizeReportHtml(html)).toBe(html);
  });

  it('remove <script> junto com o conteúdo', () => {
    const out = sanitizeReportHtml('<p>Antes</p><script>alert(1)</script><p>Depois</p>');
    expect(out).toBe('<p>Antes</p><p>Depois</p>');
    expect(out).not.toContain('alert');
  });

  it('remove <style> e <iframe> com o conteúdo', () => {
    const out = sanitizeReportHtml('<style>body{display:none}</style><iframe src="http://x"></iframe><p>ok</p>');
    expect(out).toBe('<p>ok</p>');
  });

  it('remove handlers de evento (onerror, onclick) mantendo a tag', () => {
    const out = sanitizeReportHtml('<p onclick="steal()">texto</p>');
    expect(out).toBe('<p>texto</p>');
  });

  it('descarta <img> com src perigoso e mantém imagem embutida', () => {
    const evil = sanitizeReportHtml('<img src="x" onerror="alert(1)"/>');
    expect(evil).toBe('');
    const ok = sanitizeReportHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="logo"/>');
    expect(ok).toContain('data:image/png;base64');
    expect(ok).toContain('alt="logo"');
  });

  it('bloqueia href javascript: e mantém link http', () => {
    expect(sanitizeReportHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeReportHtml('<a href="https://crivolegacy.com.br">x</a>')).toBe(
      '<a href="https://crivolegacy.com.br">x</a>',
    );
  });

  it('remove tag desconhecida preservando o texto dentro dela', () => {
    expect(sanitizeReportHtml('<p><custom-tag>valor</custom-tag></p>')).toBe('<p>valor</p>');
  });

  it('descarta comentários (podem esconder marcação condicional do Word)', () => {
    expect(sanitizeReportHtml('<p>a</p><!--[if mso]><![endif]--><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });
});

describe('autoMarkReportHtml', () => {
  it('troca a tabela de dimensões de exemplo pelo marcador', () => {
    const html =
      '<h2>Dimensões</h2><table><tr><th>Dimensão</th><th>Índice</th></tr><tr><td>Demandas</td><td>58</td></tr></table>';
    const out = autoMarkReportHtml(html);
    expect(out.html).toContain('{{tabela_dimensoes}}');
    expect(out.html).not.toContain('Demandas');
    expect(out.applied).toContain('tabela_dimensoes');
  });

  it('troca a grade de identificação (dados da outra empresa não podem ficar fixos)', () => {
    const html = '<table><tr><th>Empresa</th><td>O2 Legacy</td><th>CNPJ</th><td>00.000.000/0001-00</td></tr></table>';
    const out = autoMarkReportHtml(html);
    expect(out.html).toBe('<p>{{identificacao}}</p>');
    expect(out.html).not.toContain('O2 Legacy');
  });

  it('reconhece a matriz de risco antes do plano de ação', () => {
    const html =
      '<table><tr><th>Fator</th><th>Probabilidade</th><th>Severidade</th><th>Ação recomendada</th></tr>' +
      '<tr><td>Sobrecarga</td><td>4</td><td>4</td><td>Mitigar</td></tr></table>';
    expect(autoMarkReportHtml(html).applied).toEqual(['matriz_risco']);
  });

  it('marca o VALOR em pares "Rótulo: valor", preservando o rótulo', () => {
    const out = autoMarkReportHtml('<p>Empresa: O2 Legacy &amp; Consulting</p>');
    expect(out.html).toBe('<p>Empresa: {{empresa}}</p>');
    expect(out.applied).toContain('empresa');
  });

  it('marca o score e a faixa do painel de resultado', () => {
    const html =
      '<table><tr><td><p><strong>41,7</strong> / 100</p><p><strong>Atenção crítica</strong></p></td>' +
      '<td><p>Texto longo do panorama que não pode virar marcador de faixa.</p></td></tr></table>';
    const out = autoMarkReportHtml(html);
    expect(out.html).toContain('{{score}} / 100');
    expect(out.html).toContain('{{faixa}}');
    expect(out.html).toContain('Texto longo do panorama');
    expect(out.applied).toEqual(expect.arrayContaining(['score', 'faixa']));
  });

  it('não marca score em frase que apenas cita "/ 100"', () => {
    const html = '<p>O índice de 62,5 / 100 indica atenção.</p>';
    const out = autoMarkReportHtml(html);
    expect(out.html).toBe(html);
  });

  it('marca o valor de "Maior pontuação" preservando o rótulo', () => {
    const html =
      '<table><tr><td><p><strong>Maior pontuação</strong></p></td><td><p>Governança · 62,5 / 100</p></td></tr></table>';
    const out = autoMarkReportHtml(html);
    expect(out.html).toContain('<strong>Maior pontuação</strong>');
    expect(out.html).toContain('{{maior_pontuacao}}');
    expect(out.html).not.toContain('Governança');
  });

  it('reconhece a identificação do MAPA (EMPRESA/RESPONDENTE/DATA, sem CNPJ)', () => {
    const html =
      '<table><tr><td><p><strong>EMPRESA</strong></p><p>O2 Legacy</p></td>' +
      '<td><p><strong>RESPONDENTE</strong></p><p>Rodrigo</p></td>' +
      '<td><p><strong>DATA</strong></p><p>24/08/2026</p></td></tr></table>';
    const out = autoMarkReportHtml(html);
    expect(out.html).toBe('<p>{{identificacao}}</p>');
  });

  it('não mexe em tabela de conteúdo que não é bloco dinâmico', () => {
    const html = '<table><tr><th>Etapa</th><th>Descrição</th></tr><tr><td>1</td><td>Coleta</td></tr></table>';
    const out = autoMarkReportHtml(html);
    expect(out.html).toBe(html);
    expect(out.applied).toEqual([]);
  });
});

/**
 * Extração de PDF: não há layout para recuperar, então o mínimo é não INVENTAR
 * estrutura. O PDF quebra linha por largura de coluna, e a regra antiga ("linha
 * curta sem pontuação final") transformava metade das frases em títulos.
 */
describe('pdfTextToBlocks', () => {
  it('não corta uma frase no meio para virar título', () => {
    const texto = [
      'Considera a possibilidade de ocorrência de lesões ou agravos em função',
      'da exposição ao fator, das exigências da atividade e da eficácia das',
      'medidas de prevenção existentes.',
    ].join('\n');
    const blocks = pdfTextToBlocks(texto);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('text');
    expect(blocks[0].text).toContain('medidas de prevenção existentes');
  });

  it('reconhece título em caixa alta e numeração de seção', () => {
    const texto = 'SÍNTESE DO CICLO\n\nTexto da seção.\n\n3.1 Metodologia\n\nOutro texto.';
    const kinds = pdfTextToBlocks(texto).map((b) => `${b.kind}:${b.text}`);
    expect(kinds).toContain('heading:SÍNTESE DO CICLO');
    expect(kinds).toContain('heading:3.1 Metodologia');
  });

  it('não trata linha de tabela achatada como título', () => {
    const texto = '4 4 16 ● Crítico\nF02 Recorrente em picos; percepção moderada.';
    expect(pdfTextToBlocks(texto).every((b) => b.kind === 'text')).toBe(true);
  });

  it('não trata "3 Possível ..." (célula numerada) como título', () => {
    const texto = '3 Possível Presente em parte do grupo ou em determinados\nciclos.';
    expect(pdfTextToBlocks(texto).every((b) => b.kind === 'text')).toBe(true);
  });

  it('remove cabeçalho/rodapé repetido em toda página', () => {
    const pagina = (n: number) => `CRIVO — Decision Intelligence\nConteúdo da página ${n}.\n— ${n} of 5 —`;
    const texto = [pagina(1), pagina(2), pagina(3)].join('\n');
    const todo = pdfTextToBlocks(texto).map((b) => b.text).join(' ');
    expect(todo).not.toContain('Decision Intelligence');
    expect(todo).not.toContain('of 5');
    expect(todo).toContain('Conteúdo da página 2');
  });

  it('junta palavra hifenizada quebrada entre linhas', () => {
    const blocks = pdfTextToBlocks('as medidas de preven-\nção adotadas pela empresa.');
    expect(blocks[0].text).toContain('prevenção adotadas');
  });
});
