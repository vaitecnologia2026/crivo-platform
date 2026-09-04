import PDFDocument from 'pdfkit';

/**
 * MAPA Executivo em PDF — o documento que vai ANEXO ao e-mail do lead.
 *
 * Até aqui o lead recebia só o texto no corpo do e-mail (com as tabelas em
 * markdown cru) e o e-book. O layout abaixo reproduz o modelo oficial aprovado
 * pelo cliente (`MAPA_Executivo_CRIVO_Modelo_25_08_2026`): identificação,
 * panorama, tabela de dimensões com barra e faixa, legenda das faixas, síntese
 * executiva, maior pontuação, maior atenção, caminho recomendado e a ressalva de
 * que não substitui diagnóstico técnico.
 *
 * PDF e não Word: abre igual em qualquer celular, que é onde o lead lê.
 */

/** Paleta do documento — mesma identidade das telas. */
const AZUL = '#0D1F3C';
const TERRA = '#A8693D';
const CINZA = '#6B6459';
const LINHA = '#DCD7CE';

export interface FaixaMapa {
  label: string;
  min: number;
  max: number;
  color?: string | null;
}

export interface DadosMapaExecutivo {
  empresa: string;
  respondente: string;
  data: Date;
  score: number;
  faixaLabel: string;
  faixaColor?: string | null;
  panorama: string;
  dimensoes: { label: string; score: number; faixaLabel: string; faixaColor?: string | null }[];
  faixas: FaixaMapa[];
  sintese: string;
  caminho: string;
}

const num = (n: number) => n.toFixed(1).replace('.', ',');
const dataBr = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/**
 * Nome no padrão `MAPA_Executivo_CRIVO_<EMPRESA>_<AAAA-MM-DD>.pdf`.
 * Sem acento e sem símbolo: anexo precisa abrir em qualquer cliente de e-mail,
 * inclusive nos que tropeçam em nome de arquivo acentuado.
 */
export function nomeArquivoMapa(empresa: string, data: Date): string {
  // NFD separa a letra do acento; o filtro descarta os combining marks
  // (U+0300 a U+036F) sem precisar de regex com caractere invisivel no fonte.
  const semAcento = Array.from(empresa.normalize('NFD'))
    .filter((c) => {
      const n = c.codePointAt(0) ?? 0;
      return n < 0x300 || n > 0x36f;
    })
    .join('');
  const limpo =
    semAcento
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'Empresa';
  const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`;
  return `MAPA_Executivo_CRIVO_${limpo}_${iso}.pdf`;
}

export function gerarMapaExecutivoPdf(d: DadosMapaExecutivo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'MAPA Executivo CRIVO' } });
    const partes: Buffer[] = [];
    doc.on('data', (c: Buffer) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const L = doc.page.margins.left;
    const largura = doc.page.width - L - doc.page.margins.right;

    // Cabeçalho
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(22).text('MAPA Executivo', L, 48);
    doc.fillColor(CINZA).font('Helvetica').fontSize(11).text('Visão preliminar da organização');
    doc.moveDown(1);

    // Identificação em três colunas: empresa, respondente e data.
    const yId = doc.y;
    const col = largura / 3;
    const campo = (titulo: string, valor: string, i: number) => {
      const x = L + col * i;
      doc.fillColor(CINZA).font('Helvetica').fontSize(8).text(titulo, x, yId, { width: col - 8 });
      doc
        .fillColor(AZUL)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(valor, x, yId + 12, { width: col - 8 });
    };
    campo('EMPRESA', d.empresa, 0);
    campo('RESPONDENTE', d.respondente, 1);
    campo('DATA', dataBr(d.data), 2);
    doc.y = yId + 34;
    doc.moveTo(L, doc.y).lineTo(L + largura, doc.y).strokeColor(LINHA).stroke();
    doc.moveDown(1);

    // Panorama
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(14).text('Panorama');
    doc.moveDown(0.4);
    const yPan = doc.y;
    doc
      .fillColor(d.faixaColor ?? TERRA)
      .font('Helvetica-Bold')
      .fontSize(28)
      .text(`${num(d.score)} / 100`, L, yPan);
    doc
      .fillColor(d.faixaColor ?? TERRA)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(d.faixaLabel, L, yPan + 32);
    doc.y = yPan + 52;
    doc
      .fillColor(AZUL)
      .font('Helvetica')
      .fontSize(10.5)
      .text(d.panorama, L, doc.y, { width: largura, align: 'justify' });
    doc.moveDown(1);

    // Dimensões
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(14).text('Dimensões');
    doc.moveDown(0.5);
    const colDim = largura * 0.42;
    const colBarra = largura * 0.26;
    const colScore = largura * 0.12;
    const cab = doc.y;
    doc.fillColor(CINZA).font('Helvetica-Bold').fontSize(8);
    doc.text('DIMENSÃO', L, cab, { width: colDim });
    doc.text('ESCALA', L + colDim, cab, { width: colBarra });
    doc.text('SCORE', L + colDim + colBarra, cab, { width: colScore });
    doc.text('FAIXA', L + colDim + colBarra + colScore, cab);
    doc.y = cab + 12;
    doc.moveTo(L, doc.y).lineTo(L + largura, doc.y).strokeColor(LINHA).stroke();

    for (const dim of d.dimensoes) {
      // Quebra de página com folga, para não cortar uma linha no meio.
      if (doc.y > doc.page.height - 160) doc.addPage();
      const y = doc.y + 8;
      doc.fillColor(AZUL).font('Helvetica').fontSize(10).text(dim.label, L, y, { width: colDim - 8 });
      // Barra proporcional ao score, na cor da faixa.
      const bx = L + colDim;
      const bw = colBarra - 12;
      doc.roundedRect(bx, y + 3, bw, 7, 3.5).fillColor(LINHA).fill();
      doc
        .roundedRect(bx, y + 3, Math.max(2, (bw * dim.score) / 100), 7, 3.5)
        .fillColor(dim.faixaColor ?? TERRA)
        .fill();
      doc
        .fillColor(AZUL)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(num(dim.score), L + colDim + colBarra, y, { width: colScore });
      doc
        .fillColor(dim.faixaColor ?? CINZA)
        .font('Helvetica')
        .fontSize(9.5)
        .text(dim.faixaLabel, L + colDim + colBarra + colScore, y);
      doc.y = Math.max(doc.y, y + 16);
      doc.moveTo(L, doc.y).lineTo(L + largura, doc.y).strokeColor(LINHA).stroke();
    }

    // Legenda das faixas — sem ela, "Vulnerável" não quer dizer nada.
    doc.moveDown(0.6);
    const legenda = d.faixas.map((f) => `${f.min}-${f.max} ${f.label}`).join('    ');
    doc.fillColor(CINZA).font('Helvetica').fontSize(8.5).text(legenda, L, doc.y, { width: largura });
    doc.moveDown(1);

    // Blocos de leitura
    const bloco = (titulo: string, corpo: string) => {
      if (doc.y > doc.page.height - 150) doc.addPage();
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(13).text(titulo, L, doc.y);
      doc.moveDown(0.3);
      doc
        .fillColor(AZUL)
        .font('Helvetica')
        .fontSize(10.5)
        .text(corpo, L, doc.y, { width: largura, align: 'justify' });
      doc.moveDown(0.9);
    };
    bloco('Síntese executiva', d.sintese);

    const melhor = [...d.dimensoes].sort((a, b) => b.score - a.score)[0];
    const pior = [...d.dimensoes].sort((a, b) => a.score - b.score)[0];
    if (melhor) {
      bloco('Maior pontuação', `${melhor.label} - ${num(melhor.score)} / 100 - ${melhor.faixaLabel}`);
    }
    if (pior) {
      bloco('Maior atenção', `${pior.label} - ${num(pior.score)} / 100 - ${pior.faixaLabel}`);
    }
    bloco('Caminho recomendado', d.caminho);

    // Ressalva (texto do modelo oficial)
    if (doc.y > doc.page.height - 110) doc.addPage();
    doc.moveTo(L, doc.y).lineTo(L + largura, doc.y).strokeColor(LINHA).stroke();
    doc.moveDown(0.5);
    doc
      .fillColor(CINZA)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(
        'O MAPA Executivo é uma visão preliminar de gestão. Não substitui diagnóstico técnico ou ' +
          'avaliação especializada.',
        L,
        doc.y,
        { width: largura },
      );

    doc.end();
  });
}
