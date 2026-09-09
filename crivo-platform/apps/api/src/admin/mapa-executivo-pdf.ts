import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';

/**
 * MAPA Executivo em PDF — o documento que vai ANEXO ao e-mail do lead.
 *
 * O layout reproduz o modelo oficial aprovado pelo cliente
 * (`MAPA_Executivo_CRIVO_Modelo_25_08_2026`), medido diretamente do arquivo:
 * marca, régua bicolor, identificação, panorama em caixa, tabela de dimensões
 * com barra e marcador de faixa, legenda, síntese executiva, maior pontuação,
 * maior atenção, caminho recomendado em caixa e a ressalva de que não substitui
 * diagnóstico técnico.
 *
 * PDF e não Word: abre igual em qualquer celular, que é onde o lead lê.
 */

/** Paleta do modelo — os hex saíram do próprio .docx, não de aproximação. */
const AZUL = '#0D1F3C';
const TERRA = '#A8693D';
/** Cor do texto corrido no modelo (não é o azul da marca). */
const GRAFITE = '#2F343B';
/** Rótulos secundários e legenda. */
const CINZA = '#69727D';
/** Fundo das caixas de leitura e do cabeçalho da tabela. */
const CREME = '#F7F5F1';
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

/**
 * Fontes e marca do modelo. Ficam em `apps/api/assets` (mesmo padrão do
 * `apps/site/assets/Lora-Regular.ttf`, usado pelo opengraph-image) porque o
 * rsync do deploy copia a pasta e o `dist/` não.
 *
 * Os caminhos cobrem os dois modos de execução: `dist/admin/*.js` em produção e
 * `src/admin/*.ts` no vitest — em ambos `../../assets` cai em `apps/api/assets`.
 */
const ASSETS: string | null = (() => {
  const candidatos = [
    join(__dirname, '..', '..', 'assets'),
    join(__dirname, '..', 'assets'),
    join(process.cwd(), 'assets'),
    join(process.cwd(), 'apps', 'api', 'assets'),
  ];
  return candidatos.find((d) => existsSync(join(d, 'Poppins-Regular.ttf'))) ?? null;
})();

interface Tipos {
  serif: string;
  serifB: string;
  sans: string;
  sansB: string;
}

/**
 * Registra Lora e Poppins (as duas fontes do modelo). Se o asset faltar — build
 * incompleto, deploy parcial — o PDF ainda sai, nas fontes padrão do PDF. O lead
 * nunca fica sem o anexo por causa de arquivo ausente.
 */
function registrarFontes(doc: PDFKit.PDFDocument): Tipos {
  const padrao: Tipos = {
    serif: 'Times-Roman',
    serifB: 'Times-Bold',
    sans: 'Helvetica',
    sansB: 'Helvetica-Bold',
  };
  if (!ASSETS) return padrao;
  try {
    doc.registerFont('Lora', readFileSync(join(ASSETS, 'Lora-Regular.ttf')));
    doc.registerFont('Lora-Bold', readFileSync(join(ASSETS, 'Lora-Bold.ttf')));
    doc.registerFont('Poppins', readFileSync(join(ASSETS, 'Poppins-Regular.ttf')));
    doc.registerFont('Poppins-Bold', readFileSync(join(ASSETS, 'Poppins-SemiBold.ttf')));
    return { serif: 'Lora', serifB: 'Lora-Bold', sans: 'Poppins', sansB: 'Poppins-Bold' };
  } catch {
    return padrao;
  }
}

/** Marca do modelo, com a área de tinta medida no PNG (o arquivo tem margem). */
const MARCA = { largura: 404, x0: 99, y0: 99, x1: 365, y1: 228 };

function lerMarca(): Buffer | null {
  if (!ASSETS) return null;
  try {
    return readFileSync(join(ASSETS, 'crivo-marca-mapa.png'));
  } catch {
    return null;
  }
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

/**
 * Linhas "Maior pontuação" e "Maior atenção" do modelo.
 *
 * Exportado porque o MAPA aparece em DOIS lugares — o PDF que vai por e-mail e
 * o Relatório Executivo do portal — e os dois precisam dizer a mesma coisa.
 *
 * O rótulo é o do modelo e é descritivo de propósito: "maior pontuação" informa
 * qual dimensão pontuou mais, sem chamá-la de ponto forte. A faixa vai junto no
 * texto, então uma dimensão em faixa de atenção aparece rotulada como tal.
 *
 * Recebe as dimensões em qualquer ordem: o melhor e o pior saem daqui, não da
 * posição no array.
 */
export function destaquesDoMapa(
  dimensoes: { label: string; score: number; faixaLabel: string }[],
): { titulo: string; corpo: string }[] {
  const melhor = [...dimensoes].sort((a, b) => b.score - a.score)[0];
  const pior = [...dimensoes].sort((a, b) => a.score - b.score)[0];
  const out: { titulo: string; corpo: string }[] = [];
  if (melhor) {
    out.push({
      titulo: 'Maior pontuação',
      corpo: `${melhor.label} · ${num(melhor.score)} / 100 · ${melhor.faixaLabel}`,
    });
  }
  if (pior) {
    out.push({
      titulo: 'Maior atenção',
      corpo: `${pior.label} · ${num(pior.score)} / 100 · ${pior.faixaLabel}`,
    });
  }
  return out;
}

export function gerarMapaExecutivoPdf(d: DadosMapaExecutivo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 46,
      bufferPages: true,
      info: { Title: 'MAPA Executivo CRIVO' },
    });
    const partes: Buffer[] = [];
    doc.on('data', (c: Buffer) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const t = registrarFontes(doc);
    const marca = lerMarca();
    const L = doc.page.margins.left;
    const largura = doc.page.width - L - doc.page.margins.right;
    const fundo = doc.page.height - doc.page.margins.bottom;

    /** Abre página nova quando o bloco não cabe inteiro — nada sai cortado. */
    const espaco = (altura: number) => {
      if (doc.y + altura > fundo) doc.addPage();
    };

    /**
     * Régua bicolor do modelo: 26pt em terra, o resto em azul, 5,5pt de altura.
     * É a assinatura visual que abre o documento e a síntese executiva.
     */
    const regua = () => {
      const y = doc.y;
      doc.rect(L, y, 26, 5.5).fill(TERRA);
      doc.rect(L + 26, y, largura - 26, 5.5).fill(AZUL);
      doc.y = y + 5.5;
    };

    /** Caixa creme de leitura; devolve a largura útil de dentro e o fim dela. */
    const caixa = (altura: number, pad = 14) => {
      const y = doc.y;
      doc.roundedRect(L, y, largura, altura, 4).fill(CREME);
      doc.y = y + pad;
      return { interna: largura - pad * 2, fim: y + altura };
    };

    // ── Marca ────────────────────────────────────────────────────────────────
    if (marca) {
      // O PNG tem margem larga; desenho maior e recorto na área de tinta para a
      // marca encostar na margem, como no modelo.
      const alvo = 128;
      const s = alvo / (MARCA.x1 - MARCA.x0 + 1);
      const alturaTinta = (MARCA.y1 - MARCA.y0 + 1) * s;
      const y = 40;
      doc.save();
      doc.rect(L, y, alvo, alturaTinta).clip();
      doc.image(marca, L - MARCA.x0 * s, y - MARCA.y0 * s, { width: MARCA.largura * s });
      doc.restore();
      doc.y = y + alturaTinta + 14;
    } else {
      doc.y = 46;
    }

    // ── Título ───────────────────────────────────────────────────────────────
    regua();
    doc.moveDown(0.5);
    doc.fillColor(AZUL).font(t.serif).fontSize(27).text('MAPA Executivo', L, doc.y);
    doc.fillColor(TERRA).font(t.serif).fontSize(12).text('Visão preliminar da organização');
    doc.moveDown(1);

    // ── Identificação (empresa · respondente · data) ─────────────────────────
    const yId = doc.y;
    const alturaId = 40;
    doc.roundedRect(L, yId, largura, alturaId, 4).fill(CREME);
    const col = largura / 3;
    const campo = (titulo: string, valor: string, i: number) => {
      const x = L + col * i + 12;
      doc
        .fillColor(AZUL)
        .font(t.sansB)
        .fontSize(7)
        .text(titulo, x, yId + 9, { width: col - 20 });
      doc
        .fillColor(GRAFITE)
        .font(t.sans)
        .fontSize(10)
        .text(valor, x, yId + 20, { width: col - 20, lineBreak: false, ellipsis: true });
    };
    campo('EMPRESA', d.empresa, 0);
    campo('RESPONDENTE', d.respondente, 1);
    campo('DATA', dataBr(d.data), 2);
    doc.y = yId + alturaId + 18;

    // ── Panorama ─────────────────────────────────────────────────────────────
    doc.fillColor(AZUL).font(t.sansB).fontSize(13.5).text('Panorama', L, doc.y);
    doc.moveDown(0.45);
    const larguraPan = largura - 28;
    const hTextoPan = doc
      .font(t.sans)
      .fontSize(10)
      .heightOfString(d.panorama, { width: larguraPan, align: 'justify' });
    espaco(hTextoPan + 84);
    const cx = caixa(hTextoPan + 84);
    const yPan = doc.y;
    doc
      .fillColor(AZUL)
      .font(t.serifB)
      .fontSize(25)
      .text(num(d.score), L + 14, yPan, { lineBreak: false });
    // `continued` alinhava o "/ 100" pelo TOPO do número, virando expoente. Os
    // 12pt de deslocamento são a diferença de altura de letra entre 25pt e 9pt,
    // que põe os dois na mesma linha de base — como no modelo.
    const larguraScore = doc.widthOfString(num(d.score));
    doc
      .fillColor(CINZA)
      .font(t.sans)
      .fontSize(9)
      .text(' / 100', L + 14 + larguraScore, yPan + 12, { lineBreak: false });
    doc
      .fillColor(d.faixaColor ?? TERRA)
      .font(t.sansB)
      .fontSize(11)
      .text(d.faixaLabel, L + 14, yPan + 32, { width: cx.interna });
    doc
      .fillColor(GRAFITE)
      .font(t.sans)
      .fontSize(10)
      .text(d.panorama, L + 14, yPan + 52, { width: cx.interna, align: 'justify' });
    doc.y = cx.fim + 18;

    // ── Dimensões ────────────────────────────────────────────────────────────
    doc.fillColor(AZUL).font(t.sansB).fontSize(13.5).text('Dimensões', L, doc.y);
    doc.moveDown(0.45);
    const colDim = largura * 0.4;
    const colBarra = largura * 0.26;
    const colScore = largura * 0.13;
    const colFaixa = largura - colDim - colBarra - colScore;
    const xBarra = L + colDim;
    const xScore = xBarra + colBarra;
    const xFaixa = xScore + colScore;

    const cabecalho = () => {
      const y = doc.y;
      doc.rect(L, y, largura, 18).fill(CREME);
      doc.fillColor(AZUL).font(t.sansB).fontSize(8);
      doc.text('Dimensão', L + 10, y + 5.5, { width: colDim - 12, lineBreak: false });
      doc.text('Escala', xBarra, y + 5.5, { width: colBarra - 8, lineBreak: false });
      doc.text('Score', xScore, y + 5.5, { width: colScore - 6, lineBreak: false });
      doc.text('Faixa', xFaixa, y + 5.5, { width: colFaixa, lineBreak: false });
      doc.y = y + 18;
    };
    cabecalho();

    for (const dim of d.dimensoes) {
      if (doc.y + 26 > fundo) {
        doc.addPage();
        cabecalho();
      }
      const y = doc.y + 7;
      doc
        .fillColor(GRAFITE)
        .font(t.sans)
        .fontSize(8.5)
        .text(dim.label, L + 10, y, { width: colDim - 16, lineBreak: false, ellipsis: true });
      // Barra proporcional ao score, na cor da faixa (a "Escala" do modelo).
      const bw = colBarra - 16;
      doc.roundedRect(xBarra, y + 1.5, bw, 6, 3).fill(LINHA);
      doc
        .roundedRect(xBarra, y + 1.5, Math.max(2, (bw * dim.score) / 100), 6, 3)
        .fill(dim.faixaColor ?? TERRA);
      doc
        .fillColor(AZUL)
        .font(t.sansB)
        .fontSize(9)
        .text(num(dim.score), xScore, y - 0.5, { width: colScore - 6, lineBreak: false });
      // No modelo só o marcador é colorido; o rótulo da faixa é texto normal.
      // O marcador é DESENHADO: Poppins não tem o glifo ● (U+25CF) e sairia
      // como quadrado vazio no PDF.
      doc.circle(xFaixa + 3, y + 4, 3).fill(dim.faixaColor ?? CINZA);
      doc
        .fillColor(GRAFITE)
        .font(t.sans)
        .fontSize(8)
        .text(dim.faixaLabel, xFaixa + 10, y, {
          width: colFaixa - 10,
          lineBreak: false,
          ellipsis: true,
        });
      doc.y = y + 15;
      doc.moveTo(L, doc.y).lineTo(L + largura, doc.y).strokeColor(LINHA).lineWidth(0.5).stroke();
    }

    // Legenda das faixas — sem ela, "Vulnerável" não quer dizer nada.
    if (d.faixas.length) {
      doc.y += 8;
      espaco(16);
      const yLeg = doc.y;
      let x = L;
      for (const f of d.faixas) {
        const texto = `${f.min}–${f.max} ${f.label}`;
        doc.circle(x + 3, yLeg + 4, 3).fill(f.color ?? CINZA);
        x += 10;
        doc.fillColor(CINZA).font(t.sans).fontSize(8).text(texto, x, yLeg, { lineBreak: false });
        x += doc.widthOfString(texto) + 14;
      }
      doc.y = yLeg + 12;
    }
    doc.y += 16;

    // ── Síntese executiva ────────────────────────────────────────────────────
    const hSintese = doc
      .font(t.sans)
      .fontSize(11)
      .heightOfString(d.sintese, { width: largura, align: 'justify' });
    espaco(Math.min(hSintese + 60, 96));
    regua();
    doc.moveDown(0.5);
    doc.fillColor(AZUL).font(t.serif).fontSize(24).text('Síntese executiva', L, doc.y);
    doc.moveDown(0.5);
    doc
      .fillColor(GRAFITE)
      .font(t.sans)
      .fontSize(11)
      .text(d.sintese, L, doc.y, { width: largura, align: 'justify' });
    doc.y += 16;

    // ── Maior pontuação · Maior atenção ──────────────────────────────────────
    const destaques = destaquesDoMapa(d.dimensoes);
    if (destaques.length) {
      espaco(destaques.length * 26 + 6);
      const colRotulo = 108;
      for (const b of destaques) {
        const y = doc.y;
        doc
          .fillColor(AZUL)
          .font(t.sansB)
          .fontSize(9)
          .text(b.titulo, L, y + 4, { width: colRotulo - 8 });
        doc
          .fillColor(GRAFITE)
          .font(t.sans)
          .fontSize(10)
          .text(b.corpo, L + colRotulo, y + 3, { width: largura - colRotulo });
        doc.y = Math.max(doc.y, y + 22);
        doc.moveTo(L, doc.y).lineTo(L + largura, doc.y).strokeColor(LINHA).lineWidth(0.5).stroke();
      }
      doc.y += 18;
    }

    // ── Caminho recomendado ──────────────────────────────────────────────────
    const hCaminho = doc
      .font(t.serifB)
      .fontSize(12)
      .heightOfString(d.caminho, { width: largura - 28 });
    espaco(Math.min(hCaminho + 60, 110));
    doc.fillColor(TERRA).font(t.sansB).fontSize(13.5).text('Caminho recomendado', L, doc.y);
    doc.moveDown(0.45);
    const cxC = caixa(hCaminho + 28);
    doc
      .fillColor(AZUL)
      .font(t.serifB)
      .fontSize(12)
      .text(d.caminho, L + 14, doc.y, { width: cxC.interna });
    doc.y = cxC.fim + 18;

    // ── Ressalva (texto do modelo oficial) ───────────────────────────────────
    espaco(50);
    doc.moveTo(L, doc.y).lineTo(L + largura, doc.y).strokeColor(LINHA).lineWidth(0.5).stroke();
    doc.y += 10;
    doc
      .fillColor(CINZA)
      .font(t.sans)
      .fontSize(9)
      .text(
        'O MAPA Executivo é uma visão preliminar de gestão. Não substitui diagnóstico técnico ou ' +
          'avaliação especializada.',
        L,
        doc.y,
        { width: largura },
      );

    // ── Rodapé em todas as páginas ───────────────────────────────────────────
    const faixaPag = doc.bufferedPageRange();
    for (let i = faixaPag.start; i < faixaPag.start + faixaPag.count; i += 1) {
      doc.switchToPage(i);
      // Escrever abaixo da margem inferior faz o pdfkit abrir página nova — era
      // isso que gerava uma folha em branco no fim do documento.
      const margemBaixo = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = doc.page.height - 34;
      doc.moveTo(L, y - 8).lineTo(L + largura, y - 8).strokeColor(LINHA).lineWidth(0.5).stroke();
      doc
        .fillColor(CINZA)
        .font(t.sans)
        .fontSize(8)
        .text('CRIVO™  ·  Decision Intelligence', L, y, {
          width: largura,
          align: 'center',
          lineBreak: false,
        });
      doc.page.margins.bottom = margemBaixo;
    }
    doc.flushPages();

    doc.end();
  });
}
