import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { applyTableBorders, docxTableBorders } from './docx-table-borders';

/**
 * O Word usa tabela sem borda para POSICIONAR (logo à esquerda, título à
 * direita). Desenhar linha nessas tabelas fazia o modelo importado sair
 * diferente do arquivo — foi o que o cliente viu no cabeçalho "METODOLOGIA E
 * CRITÉRIOS". Estes testes montam um .docx mínimo em memória para provar que
 * lemos a borda REAL do arquivo, em vez de arbitrar.
 */

/** .docx mínimo: um ZIP com uma única entrada word/document.xml. */
function docxComXml(xml: string): Buffer {
  const nome = Buffer.from('word/document.xml', 'utf8');
  const dados = deflateRawSync(Buffer.from(xml, 'utf8'));
  const bruto = Buffer.byteLength(xml, 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(dados.length, 18);
  local.writeUInt32LE(bruto, 22);
  local.writeUInt16LE(nome.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(dados.length, 20);
  central.writeUInt32LE(bruto, 24);
  central.writeUInt16LE(nome.length, 28);
  central.writeUInt32LE(0, 42); // offset do cabeçalho local

  const inicioCentral = local.length + nome.length + dados.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nome.length, 12);
  fim.writeUInt32LE(inicioCentral, 16);

  return Buffer.concat([local, nome, dados, central, nome, fim]);
}

const tabela = (props: string) => `<w:tbl>${props}<w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl>`;

describe('docxTableBorders', () => {
  it('tabela de layout (todas as bordas "none") não recebe linha', () => {
    const props =
      '<w:tblPr><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/>' +
      '<w:bottom w:val="none"/><w:right w:val="none"/></w:tblBorders></w:tblPr>';
    expect(docxTableBorders(docxComXml(`<w:document>${tabela(props)}</w:document>`))).toEqual(['none']);
  });

  it('só linha inferior vira "rows" (estilo dos modelos oficiais)', () => {
    const props = '<w:tblPr></w:tblPr>';
    const xml = `<w:document><w:tbl>${props}<w:tr><w:tc><w:tcPr><w:tcBorders><w:bottom w:val="single" w:sz="4"/></w:tcBorders></w:tcPr><w:p/></w:tc></w:tr></w:tbl></w:document>`;
    expect(docxTableBorders(docxComXml(xml))).toEqual(['rows']);
  });

  it('borda vertical vira "grid"', () => {
    const props =
      '<w:tblPr><w:tblBorders><w:top w:val="single"/><w:left w:val="single"/>' +
      '<w:insideV w:val="single"/></w:tblBorders></w:tblPr>';
    expect(docxTableBorders(docxComXml(`<w:document>${tabela(props)}</w:document>`))).toEqual(['grid']);
  });

  it('estilo "TableGrid" sem bordas declaradas conta como grade', () => {
    const props = '<w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr>';
    expect(docxTableBorders(docxComXml(`<w:document>${tabela(props)}</w:document>`))).toEqual(['grid']);
  });

  it('arquivo ilegível devolve lista vazia (o import segue sem marcar nada)', () => {
    expect(docxTableBorders(Buffer.from('nao sou um zip'))).toEqual([]);
  });
});

describe('applyTableBorders', () => {
  it('marca cada tabela na ordem, deixando a de layout sem classe', () => {
    const html = '<table><tr><td>logo</td></tr></table><table><tr><td>dados</td></tr></table>';
    expect(applyTableBorders(html, ['none', 'rows'])).toBe(
      '<table><tr><td>logo</td></tr></table><table class="mdl-rows"><tr><td>dados</td></tr></table>',
    );
  });

  it('sem informação de borda, o HTML não é tocado', () => {
    const html = '<table class="x"><tr><td>a</td></tr></table>';
    expect(applyTableBorders(html, [])).toBe(html);
  });
});
