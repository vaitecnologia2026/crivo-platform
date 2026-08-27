import { inflateRawSync } from 'node:zlib';

/**
 * Bordas das tabelas de um .docx.
 *
 * O Word usa tabela para DUAS coisas: mostrar dados (com grade) e posicionar
 * conteúdo na página (sem grade — logo à esquerda, título à direita). O mammoth
 * converte as duas em `<table>` puro, sem dizer qual é qual, e desenhar borda em
 * todas faz o modelo importado sair diferente do arquivo: o cabeçalho da página
 * vira uma caixa com linhas em volta.
 *
 * Aqui lemos `word/document.xml` direto do pacote e devolvemos, na ORDEM em que
 * as tabelas aparecem, se cada uma tem borda visível. O mammoth percorre o
 * documento na mesma ordem, então o índice casa.
 *
 * Leitor de ZIP próprio (~40 linhas) para não adicionar dependência: `jszip` é
 * transitiva do mammoth e o pnpm não a expõe para a aplicação.
 */

/** Extrai UMA entrada do ZIP pelo nome. Null se não existir ou não for legível. */
function readZipEntry(buf: Buffer, name: string): Buffer | null {
  // "End of central directory": assinatura PK\x05\x06, no fim do arquivo
  // (pode haver comentário depois, por isso a varredura de trás para frente).
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65535; i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // início do diretório central

  for (let n = 0; n < entries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const entryName = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (entryName === name) {
      // O cabeçalho local repete nome/extra com tamanhos próprios.
      if (buf.readUInt32LE(localOffset) !== 0x04034b50) return null;
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compressed);
      try {
        return method === 0 ? Buffer.from(data) : inflateRawSync(data);
      } catch {
        return null;
      }
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** Estilo de borda da tabela, como o Word a desenha. */
export type BorderKind = 'none' | 'rows' | 'grid';

/** Lados visíveis declarados num bloco de bordas (tblBorders ou tcBorders). */
function ladosVisiveis(xml: string): { horizontal: boolean; vertical: boolean } {
  let horizontal = false;
  let vertical = false;
  for (const l of xml.matchAll(/<w:(top|left|bottom|right|insideH|insideV)\b[^>]*w:val="([^"]+)"/g)) {
    const v = l[2].toLowerCase();
    if (v === 'none' || v === 'nil') continue;
    if (l[1] === 'left' || l[1] === 'right' || l[1] === 'insideV') vertical = true;
    else horizontal = true;
  }
  return { horizontal, vertical };
}

/**
 * Uma entrada por tabela, na ordem do documento. Lista vazia = não foi possível
 * ler (o chamador não marca nada e nada muda).
 *
 * Três estados, porque o Word tem três usos: `none` para tabela de LAYOUT
 * (logo + título do cabeçalho), `rows` para o traço fino embaixo de cada linha
 * — o estilo dos modelos oficiais CRIVO — e `grid` para grade completa.
 */
export function docxTableBorders(buf: Buffer): BorderKind[] {
  const xml = readZipEntry(buf, 'word/document.xml')?.toString('utf8');
  if (!xml) return [];

  const out: BorderKind[] = [];
  // Tabelas de primeiro nível e aninhadas aparecem ambas como <w:tbl>; o
  // mammoth também emite <table> para as duas, então a contagem casa.
  for (const m of xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)) {
    const tabela = m[0];
    const props = /<w:tblPr>[\s\S]*?<\/w:tblPr>/.exec(tabela)?.[0] ?? '';
    const tblBorders = /<w:tblBorders>[\s\S]*?<\/w:tblBorders>/.exec(props)?.[0];

    let horizontal = false;
    let vertical = false;
    if (tblBorders) ({ horizontal, vertical } = ladosVisiveis(tblBorders));
    else {
      // Sem bordas declaradas, o estilo decide. "Tabela com Grade"/"TableGrid"
      // é o padrão do Word para tabela COM linhas; sem estilo, é sem borda.
      const estilo = /<w:tblStyle w:val="([^"]+)"/.exec(props)?.[1] ?? '';
      if (/grid|grade/i.test(estilo)) {
        horizontal = true;
        vertical = true;
      }
    }
    // Borda aplicada célula a célula também conta — é assim que os modelos
    // oficiais desenham o traço embaixo de cada linha.
    for (const c of tabela.matchAll(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/g)) {
      const r = ladosVisiveis(c[0]);
      horizontal = horizontal || r.horizontal;
      vertical = vertical || r.vertical;
    }
    out.push(vertical ? 'grid' : horizontal ? 'rows' : 'none');
  }
  return out;
}

/**
 * Marca no HTML do mammoth, na mesma ordem, o estilo de borda de cada tabela.
 * Tabela sem borda fica sem classe e o documento a renderiza como LAYOUT —
 * invisível, que é como ela aparece no arquivo original.
 */
export function applyTableBorders(html: string, borders: BorderKind[]): string {
  if (!borders.length) return html;
  let i = 0;
  return html.replace(/<table\b[^>]*>/gi, () => {
    const kind = borders[i++] ?? 'none';
    if (kind === 'grid') return '<table class="mdl-grid">';
    if (kind === 'rows') return '<table class="mdl-rows">';
    return '<table>';
  });
}
