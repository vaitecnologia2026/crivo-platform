import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  classifyTechnicalRisk,
  DOCUMENT_TYPE_LABEL,
  INVENTORY_RISK_LABEL,
  RESPONSIBILITY_NOTE,
  type DocumentDescriptor,
  type DocumentSection,
  type GeneratedDocument,
  type PsychosocialRiskMatrixRow,
  type RiskLevel3,
  PSYCHOSOCIAL_RISK_CLASS_LABEL,
  psychosocialRiskClass,
  type PsychosocialRiskClass,
  PSYCHOSOCIAL_RISK_CLASS_ACTION,
  PSYCHOSOCIAL_PROBABILITY_SHORT,
  PSYCHOSOCIAL_PROBABILITY_CRITERION,
  PSYCHOSOCIAL_SEVERITY_SHORT,
  findBandForScore,
  fillReportPlaceholders,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveActiveMethodology,
  resolveInstrumentForTenant,
  resolveTenantInstrument,
  usesPsychosocialEngine,
  type TenantInstrument,
} from '../admin/methodology.service';
import { getEngineConfig, resolveMinRespondents } from '../admin/engine-config';
// MESMAS funções que montam o PDF do MAPA enviado por e-mail: o relatório do
// portal e o anexo do lead têm de ser o mesmo documento, não dois parecidos.
import {
  caminhoMapa,
  panoramaMapa,
  sinteseMapa,
  umaCasa,
} from '../admin/preliminary-reports.service';
import { PsychosocialService } from '../psychosocial/psychosocial.service';
import { AiSettingsService } from '../admin/ai-settings.service';
import { planEntryFor, resolveActionPlans } from './psychosocial-action-plans';

type DiagnosticMethodLike = string | null;
type ReportTemplateSectionRow = { heading?: string; body?: string };

const METHOD_LABEL: Record<string, string> = {
  INICIAL: 'Diagnóstico Inicial',
  // Nome OFICIAL do método, como sai no campo "Método aplicado" do modelo.
  ESSENCIAL: 'Diagnóstico Essencial CRIVO',
  ORGANIZACIONAL: 'Diagnóstico Organizacional CRIVO',
};
const OUTPUT_LABEL: Record<string, string> = {
  SEM_INTEGRACAO: 'Sem integração formal',
  AEP: 'Apoio à AEP',
  AEP_PGR: 'Apoio à AEP + PGR',
};
const ACTION_LABEL: Record<string, string> = {
  SUGERIDA: 'Sugerida', EM_REVISAO: 'Em revisão', APROVADA: 'Aprovada',
  EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', REAVALIADA: 'Reavaliada',
  NAO_ADOTADA: 'Não adotada',
};
const CNAE_RISK_LABEL: Record<string, string> = {
  BAIXO: 'Baixo', BAIXO_MEDIO: 'Baixo/Médio', MEDIO: 'Médio', MEDIO_ALTO: 'Médio/Alto', ALTO: 'Alto',
};


const RISK3 = ['Baixa', 'Moderada', 'Alta'] as const;
const asRisk3 = (v: string | null | undefined): RiskLevel3 | null =>
  v && (RISK3 as readonly string[]).includes(v) ? (v as RiskLevel3) : null;

export type FactorItem = {
  point: string; origin: string | null; action: string; responsible: string | null;
  dueDate: Date | null; status: string; expectedEvidence: string | null;
  exposedGroup: string | null; severity: string | null; probability: string | null;
  riskLevel: string | null;
  // F2 — informados pela EMPRESA no Plano de Evolução (nunca inventados).
  areaProcess?: string | null; existingMeasure?: string | null; indicator?: string | null;
  /** Objetivo da medida — coluna "Objetivo" do Plano de ação no modelo. */
  objective?: string | null;
  // A4 — proveniência estruturada do fator (diagnóstico do Motor).
  sourceInstrumentSlug?: string | null;
  // A3 — evidências anexadas (status decide o bloqueio de dossiê p/ fator Alto).
  evidences?: { status: string }[];
};

/**
 * Risco técnico do fator no dossiê (doc 09 §6). DERIVADO da matriz 3x3
 * Severidade x Probabilidade — nunca digitado. Sem os dois eixos, cai no
 * `riskLevel` legado (registros anteriores à matriz) e devolve `derived:false`.
 */
export function factorRisk(i: FactorItem): { label: string; derived: boolean; isHigh: boolean } {
  const sev = asRisk3(i.severity);
  const prob = asRisk3(i.probability);
  if (sev && prob) {
    const r = classifyTechnicalRisk(prob, sev);
    return { label: r, derived: true, isHigh: r === 'Alto' };
  }
  const legacyMap = INVENTORY_RISK_LABEL as Record<string, string | undefined>;
  const legacy = i.riskLevel ? (legacyMap[i.riskLevel] ?? i.riskLevel) : '—';
  return { label: legacy, derived: false, isHigh: /alto|cr[ií]tico/i.test(legacy) };
}

/**
 * Declaração de escopo do Dossiê Técnico — o TÍTULO declara só o que o contrato
 * sustenta. O que licencia o dossiê é o DIAGNÓSTICO realizado (available());
 * sem saída técnica contratada ele continua saindo, mas em caráter técnico e
 * gerencial, sem se apresentar como subsídio contratado à AEP. Antes, este caso
 * era BLOQUEADO no generate() — enquanto available() liberava o cartão
 * 'independente da saída técnica', e o clique estourava um 400. O contrato que
 * nasce na liberação do CRM (alt. 076) vem sem saída técnica de propósito, então
 * todo cliente novo caía nesse choque.
 */
export function dossierScopeSection(output: string): { heading: string; body: string } {
  if (output === 'AEP' || output === 'AEP_PGR') {
    return {
      heading:
        output === 'AEP_PGR'
          ? 'Declaração de escopo — Integração à AEP + GRO/PGR'
          : 'Declaração de subsídio à AEP',
      body:
        'Este documento registra os fatores de risco psicossociais relacionados ao trabalho ' +
        'identificados no ciclo avaliado, com a finalidade de subsidiar a Avaliação Ergonômica ' +
        'Preliminar (AEP)' +
        (output === 'AEP_PGR' ? ' e a integração ao GRO/PGR' : '') +
        '. Não substitui a AEP, o PGR, nem a validação da empresa ou do responsável técnico.',
    };
  }
  return {
    heading: 'Declaração de escopo — documento técnico e gerencial',
    body:
      'Este documento registra os fatores de risco psicossociais relacionados ao trabalho ' +
      'identificados no ciclo avaliado, em caráter técnico, gerencial e documental. A validação ' +
      'deste conteúdo e a integração aos documentos de SST da organização são de ' +
      'responsabilidade da empresa contratante e/ou do responsável técnico/designado.',
  };
}

/**
 * Bloqueios de emissão do dossiê final (doc 09 §9). Regra de compliance,
 * validada no SERVIDOR: fator Alto exige responsável, prazo e evidência
 * esperada; e nenhuma ação pode estar sugerida ou em revisão.
 */
export function dossierBlockers(_items: FactorItem[]): string[] {
  // Decisão do cliente em 2026-09-08: relatórios, dossiê e plano saem
  // automaticamente, gerados pela IA, sem validação humana. Isto contraria a
  // Orientação Funcional §9 ("a IA sugere; não aprova plano, não valida
  // evidência e não libera dossiê") e o critério de aceite §12 — registrado
  // aqui porque a decisão é do cliente, mas a regra que ela substitui era
  // deliberada, não um esquecimento.
  //
  // Os três bloqueios que existiam (ação sugerida/em revisão, fator Alto sem
  // responsável/prazo/evidência esperada, fator Alto sem evidência aprovada)
  // dependiam todos de ação humana e travavam a emissão.
  return [];

}

/** Seção "Base Técnica da Recomendação" — classificação CNAE/NR-1 que embasou o método. */
type CnaeDecisionRow = {
  cnpj: string | null;
  divisionCode: string | null;
  riskLevel: string | null;
  recommendedMethod: string | null;
  reviewedBy: string | null;
  createdAt: Date;
  decisionResult: unknown;
};
/** Cores das classes de risco — as mesmas da tela do portal. */
const COR_CLASSE: Record<PsychosocialRiskClass, string> = {
  BAIXO: '#2E7D4F',
  MODERADO: '#8A6D1F',
  ALTO: '#C4671D',
  MUITO_ALTO: '#B3541E',
  CRITICO: '#8E2F1B',
};

const escapaHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Matriz 5x5 desenhada — Probabilidade no eixo X, Severidade no eixo Y.
 *
 * A Orientação Funcional §6 define a matriz como grade; até aqui o Dossiê só
 * trazia a lista de fatores, e quem lia não via a distribuição do risco. Cada
 * célula mostra quantos fatores caíram nela; a cor vem da classificação de
 * P × S, pela régua da Orientação (1–4 · 5–9 · 10–15 · 16–20 · 21–25).
 */
function grade5x5Html(rows: PsychosocialRiskMatrixRow[]): string {
  const porCelula = new Map<string, string[]>();
  for (const r of rows) {
    const k = `${r.probability}:${r.severity}`;
    porCelula.set(k, [...(porCelula.get(k) ?? []), r.label]);
  }
  const celula = (p: number, s: number) => {
    const risco = p * s;
    const cls = psychosocialRiskClass(risco);
    const cor = COR_CLASSE[cls];
    const fatores = porCelula.get(`${p}:${s}`) ?? [];
    const cheia = fatores.length > 0;
    // Célula ocupada: cor cheia da classe, número grande e contorno branco.
    // Célula vazia: a MESMA cor bem clara, para o mapa de calor continuar
    // legível sem competir com o que tem fator. Só a apresentação muda —
    // classe, risco e cores das classes seguem as mesmas.
    const fundo = cheia ? cor : `${cor}14`;
    const texto = cheia ? '#fff' : '#8a8378';
    const titulo = fatores.length ? ` title="${escapaHtml(fatores.join(' · '))}"` : '';
    return (
      `<td${titulo} style="background:${fundo};color:${texto};text-align:center;` +
      `padding:10px 6px;border:2px solid #fff;border-radius:3px;font-size:11px;` +
      `line-height:1.3;min-width:46px">` +
      // O modelo mostra o RISCO em destaque e, abaixo, "N fator(es)".
      `<div style="font-weight:700;font-size:${cheia ? '17px' : '12px'}">${risco}</div>` +
      `<div style="opacity:${cheia ? '.9' : '.75'};font-size:10px">` +
      `${cheia ? `${fatores.length} fator(es)` : '&nbsp;'}</div></td>`
    );
  };
  // Eixos do MODELO OFICIAL: linha = Probabilidade (5 no topo), coluna =
  // Severidade. Estava transposto — a leitura batia com a própria legenda, mas
  // não com o documento que o cliente homologa, e a matriz é item de comparação.
  const linhas: string[] = [];
  for (let p = 5; p >= 1; p--) {
    const tds = [1, 2, 3, 4, 5].map((sev) => celula(p, sev)).join('');
    linhas.push(
      `<tr><th style="text-align:right;padding:4px 10px;font-size:12px;color:#0d1f3c;` +
        `font-weight:700">${p}</th>${tds}</tr>`,
    );
  }
  const cabecalho = [1, 2, 3, 4, 5]
    .map(
      (sev) =>
        `<th style="padding:6px 4px;font-size:12px;color:#0d1f3c;font-weight:700">${sev}</th>`,
    )
    .join('');
  const legenda = (Object.keys(COR_CLASSE) as PsychosocialRiskClass[])
    .map(
      (c) =>
        `<span style="display:inline-block;margin-right:12px;font-size:10.5px;color:#4a4a4a">` +
        `<span style="display:inline-block;width:10px;height:10px;background:${COR_CLASSE[c]};` +
        `border-radius:2px;margin-right:4px;vertical-align:middle"></span>${PSYCHOSOCIAL_RISK_CLASS_LABEL[c]}</span>`,
    )
    .join('');
  return (
    `<div style="margin:12px 0 6px">` +
    `<table style="border-collapse:separate;border-spacing:0;margin:0 auto">` +
    `<tr><th style="font-size:10px;color:#8a8378;font-weight:600;padding-right:8px">P \\ S</th>` +
    `${cabecalho}</tr>${linhas.join('')}` +
    `<tr><th></th><td colspan="5" style="text-align:center;padding-top:8px;font-size:11px;` +
    `color:#0d1f3c;font-weight:600">Severidade &rarr;</td></tr></table>` +
    `<p style="text-align:center;margin:4px 0 10px;font-size:10.5px;color:#6b6459">` +
    `Linha = Probabilidade · Coluna = Severidade. O número em destaque é o risco resultante ` +
    `(P × S); abaixo dele, quantos fatores caíram na célula.</p>` +
    `<p style="text-align:center;margin:0">${legenda}</p></div>`
  );
}

/** Dimensões em barras: o quadro numérico sozinho não mostra a diferença. */
function barrasDimensoesHtml(
  itens: { label: string; value: number; faixa: string; cor?: string | null }[],
  // O MAPA do portal precisa da MESMA tabela do PDF do e-mail: cabecalho
  // Dimensao/Escala/Score/Faixa e a legenda das faixas embaixo. As outras
  // chamadas (Dossie) seguem sem cabecalho, como estavam.
  opcoes: {
    cabecalho?: boolean;
    /** Título da coluna da barra. O MAPA chama de "Escala"; o modelo do Dossiê,
     *  de "Leitura gráfica". Mesmo desenho, nomes diferentes nos dois modelos. */
    rotuloEscala?: string;
    legenda?: { label: string; min: number; max: number; cor?: string | null }[];
  } = {},
): string {
  const cab = opcoes.cabecalho
    ? '<tr>' +
      ['Dimensão', opcoes.rotuloEscala ?? 'Escala', 'Score', 'Faixa']
        .map(
          (c, i) =>
            `<th style="text-align:left;padding:6px 10px 6px ${i === 0 ? '0' : '10px'};` +
            `background:#f7f5f1;font-size:10px;font-weight:700;color:#0d1f3c">${escapaHtml(c)}</th>`,
        )
        .join('') +
      '</tr>'
    : '';
  const legenda = (opcoes.legenda ?? [])
    .map(
      (f) =>
        '<span style="white-space:nowrap;margin-right:14px">' +
        '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;' +
        `background:${f.cor ?? '#69727d'};margin-right:5px"></span>` +
        `${f.min}-${f.max} ${escapaHtml(f.label)}</span>`,
    )
    .join('');
  const rodape = legenda
    ? `<p style="margin:6px 0 0;font-size:10px;color:#69727d">${legenda}</p>`
    : '';
  const linhas = itens
    .map((d) => {
      const cor = d.cor ?? '#A8693D';
      const largura = Math.max(2, Math.min(100, d.value));
      return (
        `<tr><td style="padding:4px 10px 4px 0;font-size:11.5px;color:#0d1f3c;width:38%">${escapaHtml(d.label)}</td>` +
        `<td style="padding:4px 0"><div style="background:#e6e3dc;border-radius:6px;height:9px;width:100%">` +
        `<div style="background:${cor};height:9px;border-radius:6px;width:${largura}%"></div></div></td>` +
        `<td style="padding:4px 0 4px 10px;font-size:11.5px;font-weight:700;color:#0d1f3c;white-space:nowrap">${numeroPtBr(d.value)}</td>` +
        `<td style="padding:4px 0 4px 10px;font-size:10.5px;white-space:nowrap;` +
        `color:${opcoes.cabecalho ? '#2f343b' : cor}">` +
        (opcoes.cabecalho
          ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;` +
            `background:${cor};margin-right:5px"></span>`
          : '') +
        `${escapaHtml(d.faixa)}</td></tr>`
      );
    })
    .join('');
  return (
    `<table style="width:100%;border-collapse:collapse;margin:8px 0">${cab}${linhas}</table>` +
    rodape
  );
}

/** Caixa do Panorama, no mesmo desenho do PDF que vai anexo ao e-mail. */
function panoramaHtml(score: number, faixa: string, cor: string | null, texto: string): string {
  return (
    '<table style="width:100%;border-collapse:separate;margin:6px 0"><tr>' +
    '<td style="background:#f7f5f1;border-radius:6px;padding:14px 16px">' +
    `<div style="font:700 26px Georgia,serif;color:#0d1f3c;line-height:1.1">${umaCasa(score)}` +
    '<span style="font:400 12px Georgia,serif;color:#69727d"> / 100</span></div>' +
    `<div style="margin-top:4px;font-size:12.5px;font-weight:700;color:${cor ?? '#A8693D'}">` +
    `${escapaHtml(faixa)}</div>` +
    `<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#2f343b">${escapaHtml(texto)}</p>` +
    '</td></tr></table>'
  );
}

function buildBaseTecnicaSection(decision: CnaeDecisionRow | null): DocumentSection {
  if (!decision) {
    return {
      heading: 'Base Técnica da Recomendação',
      // O texto anterior mandava o LEITOR do dossiê "executar o Motor de Decisão
      // no Super Admin" — instrução operacional interna da CRIVO, dentro do
      // documento do cliente. Aqui só cabe dizer o que o documento tem ou não.
      body:
        'A classificação CNAE/NR-1 desta organização não está registrada nesta emissão. ' +
        'O enquadramento setorial deve ser confirmado pela empresa e pelo responsável técnico ' +
        'na integração ao GRO/PGR.',
    };
  }
  const r = (decision.decisionResult ?? {}) as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(r[k]) ? (r[k] as string[]) : []);
  const data: string[][] = [
    ['CNPJ analisado', decision.cnpj ?? '—'],
    ['CNAE principal', `${(r.cnaePrincipalCodigo as string) ?? '—'} — ${(r.cnaePrincipalDescricao as string) ?? '—'}`],
    ['Divisão CNAE', `${decision.divisionCode ?? '—'} (${(r.divisionName as string) ?? '—'})`],
    ['Risco preliminar', decision.riskLevel ? CNAE_RISK_LABEL[decision.riskLevel] ?? decision.riskLevel : '—'],
    ['Método recomendado', METHOD_LABEL[decision.recommendedMethod ?? ''] ?? '—'],
    ['Documentos recomendados', arr('requiredDocuments').join(', ') || '—'],
    ['Evidências necessárias', arr('requiredEvidences').join('; ') || '—'],
    ['Responsável pela validação', decision.reviewedBy ?? 'Pendente de validação por especialista'],
    ['Data da análise', new Date(decision.createdAt).toLocaleString('pt-BR')],
  ];
  const criterios = arr('criteriaConsidered').join(' ');
  const alertas = arr('warnings').join(' ');
  const body =
    'Classificação preliminar técnica que embasou o método de diagnóstico e as saídas técnicas. ' +
    'Não substitui laudo ou parecer jurídico; sujeita à validação por especialista conforme a realidade operacional da empresa.' +
    (criterios ? `\n\nCritérios considerados: ${criterios}` : '') +
    (alertas ? `\n\nAlertas: ${alertas}` : '');
  return { heading: 'Base Técnica da Recomendação', body, table: { columns: ['Item', 'Valor'], data } };
}

// ── Pacote Final de Templates (layouts oficiais) ─────────────────────────────

/** Códigos oficiais das dimensões do MAPA (ME1–ME6, confirmados pelo cliente). */
export const ME_CODE: Record<string, string> = {
  pressao_rotina: 'ME1',
  lideranca_sustentacao: 'ME2',
  cultura_comunicacao: 'ME3',
  fatores_psicossociais: 'ME4',
  governanca_plano: 'ME5',
  'dim-1': 'ME6', // Futuro do Trabalho e IA
};

/**
 * "Respostas válidas/adesão" do cabeçalho do Dossiê: "N de M (x%)". O campo de
 * empregados é texto livre ("1.200", "50 a 100") — só calculamos adesão quando
 * ele é UM número inequívoco (separador de milhar aceito) e coerente com o
 * volume de respostas; senão, mostramos só a contagem (nunca um % absurdo).
 */
function adhesionLabel(responses: number, employeesCount?: string | null): string {
  const raw = (employeesCount ?? '').trim().replace(/[.\s]/g, '');
  if (!/^\d+$/.test(raw)) return String(responses);
  const total = Number(raw);
  if (!total || total < responses) return String(responses);
  const pct = Math.round((responses / total) * 100);
  return `${responses} de ${total} (${pct}%)`;
}

type BandLike = { code: string; label: string; min: number; max: number; color?: string | null };
/**
 * Classificação pela régua ativa — a MESMA régua vale p/ score geral e cada
 * dimensão. Scores fracionários podem cair no VÃO entre faixas inteiras
 * (ex.: 39,4 entre 0–39 e 40–59): classifica pela faixa imediatamente abaixo,
 * no mesmo espírito do fallback do motor canônico (nunca devolve "—" para um
 * score válido).
 */
/** Documento pt-BR nunca imprime ponto decimal. Inteiro sai sem casas — não
 *  muda a leitura de quem já via só inteiros (MAPA Executivo). */
function numeroPtBr(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

function bandLabelOf(value: number, bands: BandLike[]): string {
  const exact = bands.find((b) => value >= b.min && value <= b.max);
  if (exact) return exact.label;
  const floor = [...bands].sort((a, b) => b.min - a.min).find((b) => value >= b.min);
  return floor?.label ?? bands[0]?.label ?? '—';
}

/**
 * F4 — ordem de severidade do risco técnico p/ comparar ciclos no TPL-003.
 * Cobre a matriz oficial (Baixo/Moderado/Alto) e rótulos legados; null =
 * rótulo desconhecido (a comparação vira "indisponível", nunca chuta).
 */
function riskRank(label: string | null | undefined): number | null {
  const l = (label ?? '').toLowerCase();
  if (!l || l === '—') return null;
  if (l.includes('baixo')) return 0;
  if (l.includes('moderado') || l.includes('médio') || l.includes('medio')) return 1;
  if (l.includes('crítico') || l.includes('critico')) return 3;
  if (l.includes('alto')) return 2;
  return null;
}

/** F4 — RESULTADO do comparativo fator a fator (TPL-003 §3), derivado dos ranks. */
function evolutionResult(prev: string | null, cur: string | null): string {
  if (prev == null && cur != null) return 'Novo neste ciclo';
  if (prev != null && cur == null) return 'Fora do plano no ciclo atual';
  const a = riskRank(prev);
  const b = riskRank(cur);
  if (a == null || b == null) return 'Comparação indisponível';
  if (b < a) return 'Risco reduzido';
  if (b > a) return 'Risco agravado';
  return 'Estável';
}

/**
 * F3 — quebra o texto aprovado de "Leitura dos principais sinais" em leituras
 * por código (linhas no formato "ME1 — leitura."). Linhas que NÃO casam com um
 * código listado (prosa livre, ou código fora de forças/atenções vigentes)
 * voltam como `prose` e entram no corpo da seção — NENHUMA linha aprovada se
 * perde, mesmo em casamento parcial.
 */
function signalReadings(
  text: string | undefined,
  codes: string[],
): { byCode: Record<string, string>; prose: string | null } {
  if (!text) return { byCode: {}, prose: null };
  const byCode: Record<string, string> = {};
  const leftovers: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([A-Za-z]{2}\d+)\s*[—:·–-]\s*(.+)$/);
    const code = m?.[1].toUpperCase();
    if (m && code && codes.includes(code) && !byCode[code]) byCode[code] = m[2].trim();
    else leftovers.push(trimmed);
  }
  return { byCode, prose: leftovers.length ? leftovers.join('\n') : null };
}

// ── HTML dos blocos dinâmicos (modelos FIÉIS ao arquivo importado) ───────────
// O modelo importado do Word guarda o corpo do documento em HTML, com os
// trechos que mudam marcados com {{chave}}. Estas funções convertem os blocos
// que o motor já sabe montar (`DocumentSection`) no HTML que entra no lugar do
// marcador — mesmas classes CSS do renderizador, para o visual não destoar.

function escapeHtml(v: string): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function kvTableHtml(rows: { label: string; value: string }[]): string {
  const body = rows.map((r) => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`).join('');
  return `<table class="kv">${body}</table>`;
}

function gridTableHtml(t: { columns: string[]; data: string[][] }): string {
  const head = t.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const rows = t.data.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
  return `<table class="grid"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Dimensão de melhor/pior índice, no formato do modelo oficial do MAPA:
 *  "Nome da dimensão · 62,5 / 100 · Faixa". */
function dimensionHighlight(
  dims: { label: string; value: number }[],
  bands: BandLike[],
  pick: 'max' | 'min',
): string {
  if (!dims.length) return '';
  const chosen = dims.reduce((acc, d) =>
    pick === 'max' ? (d.value > acc.value ? d : acc) : d.value < acc.value ? d : acc,
  );
  const valor = String(chosen.value).replace('.', ',');
  const faixa = bands.length ? ` · ${bandLabelOf(chosen.value, bands)}` : '';
  return `${chosen.label} · ${valor} / 100${faixa}`;
}

/** Grade de identificação em pares — mesmo formato do cabeçalho oficial. */
function identGridHtml(meta: { label: string; value: string }[]): string {
  const items = meta.filter((m) => {
    const v = (m.value ?? '').trim();
    return v !== '' && v !== '—' && v !== '-';
  });
  if (!items.length) return '';
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i];
    const b = items[i + 1];
    rows.push(
      `<tr><th>${escapeHtml(a.label)}</th><td>${escapeHtml(a.value)}</td>` +
        (b ? `<th>${escapeHtml(b.label)}</th><td>${escapeHtml(b.value)}</td>` : '<th></th><td></td>') +
        '</tr>',
    );
  }
  return `<table class="ident">${rows.join('')}</table>`;
}

/** Conteúdo da seção SEM o título: o modelo do cliente já traz o dele. */
function sectionInnerHtml(s: DocumentSection): string {
  let out = '';
  if (s.body) {
    out += s.body
      .split(/\n{2,}/)
      .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }
  if (s.rows) out += kvTableHtml(s.rows);
  if (s.table) out += gridTableHtml(s.table);
  return out;
}

/** Seção COM subtítulo (h3) — para blocos que vêm em série, como a matriz por setor. */
function sectionBlockHtml(s: DocumentSection): string {
  const inner = sectionInnerHtml(s);
  if (!inner && !s.heading) return '';
  return `${s.heading ? `<h3>${escapeHtml(s.heading)}</h3>` : ''}${inner}`;
}

/**
 * Bloco de assinatura EM BRANCO (decisão do cliente 27/07): o PDF sai com os
 * campos para assinar FORA do sistema — sem login do RT, sem assinatura na
 * CRIVO, sem upload obrigatório. Registro profissional quando aplicável.
 */
function signatureSection(conclusionBody: string): DocumentSection {
  return {
    heading: 'Conclusão e validação',
    body: conclusionBody,
    table: {
      columns: ['Responsável', 'Nome', 'Cargo', 'Registro profissional', 'Data', 'Assinatura'],
      data: [
        ['Empresa', '', '', '', '', ''],
        ['Responsável técnico/designado', '', '', '', '', ''],
      ],
    },
  };
}

/**
 * Controle documental (todos os TPL). Na PRÉ-VISUALIZAÇÃO sai como rascunho;
 * na emissão oficial, emit() substitui esta seção por status "Documento
 * emitido" + versão + data + hash reais (após calcular o hash de integridade).
 */
function docControlSection(extras: { label: string; value: string }[] = []): DocumentSection {
  return {
    heading: 'Controle documental',
    rows: [
      { label: 'Status do documento', value: 'Rascunho (pré-visualização)' },
      { label: 'Versão do documento', value: 'Atribuída na emissão oficial' },
      { label: 'Data de emissão', value: '—' },
      { label: 'Validação', value: 'Assinatura fora do sistema (empresa e responsável técnico)' },
      { label: 'Hash/Identificador', value: 'Atribuído na emissão oficial' },
      // Método e Organização: linhas do modelo oficial do Dossiê. Ficam FORA do
      // conjunto carimbado por emit(), que preserva o que não é dele.
      ...extras,
    ],
  };
}

/** Rótulos que emit() carimba no Controle documental — o resto é preservado. */
const CONTROLE_CARIMBADO = new Set([
  'Status do documento',
  'Versão do documento',
  'Data de emissão',
  'Validação',
  'Hash/Identificador',
]);

/**
 * Geração de documentos proporcionais ao produto/saída técnica (Briefing §15).
 * Lê o contrato via owner (control plane) e os dados do plano/evidências via
 * forTenant (RLS). TODO documento técnico carrega a frase de responsabilidade.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly psychosocial: PsychosocialService,
    private readonly aiSettings: AiSettingsService,
  ) {}

  private async context(tenantId: string) {
    // rls-allow: contract é control-plane (owner-only); self-scoped por organizationId = tenantId.
    let contract = await this.prisma.admin.contract.findFirst({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    // Fallback (Tela 05 [5]): sem contrato próprio, a empresa herda o contrato do GRUPO.
    if (!contract) {
      // rls-allow: tenant é control-plane; self-scoped por organizationId = tenantId.
      const t = await this.prisma.admin.tenant.findFirst({
        where: { organizationId: tenantId },
        select: { groupId: true },
      });
      if (t?.groupId) {
        // rls-allow: contract é control-plane (owner-only); herança do contrato do GRUPO via groupId.
        contract = await this.prisma.admin.contract.findFirst({
          where: { groupId: t.groupId },
          orderBy: { createdAt: 'desc' },
        });
      }
    }
    // rls-allow: organization é raiz do tenant (control-plane); leitura self-scoped por id=tenantId.
    const org = await this.prisma.admin.organization.findUnique({ where: { id: tenantId } });
    const plans = await this.prisma.forTenant(tenantId, (tx) =>
      tx.actionPlan.findMany({
        // Desempate por id: sem ele, dois planos criados no mesmo milissegundo
        // podem sair em ordem diferente a cada leitura — e `plans[0]` é quem
        // alimenta o documento. Mesmo critério já usado no histórico de alterações.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          items: {
            // Os IDs do dossiê (FP-001, A-001, R-001) são POSICIONAIS neste
            // array e entram no contentHash da emissão. Sem ordenação fixa, o
            // MESMO dado geraria numeração e hash diferentes a cada emissão,
            // quebrando a idempotência ("o conteúdo não mudou desde a v1").
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: { evidences: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
          },
        },
      }),
    );
    // Base Técnica da Recomendação: última decisão CNAE/NR-1 vinculada à empresa.
    // rls-allow: cnae_decision_history é control-plane (global); filtrado por companyId = tenantId.
    const cnaeDecision = await this.prisma.admin.cnaeDecisionHistory.findFirst({
      where: { companyId: tenantId },
      orderBy: { createdAt: 'desc' },
    });
    // Método EFETIVO: a SOLUÇÃO contratada manda; `contract.method` é exceção e
    // só vale se a solução não define o seu. Antes o override do contrato tinha
    // precedência e ficava preso ao trocar a solução (documentos saíam com o
    // método antigo). Mesma regra do portal (/me/diagnostic-context).
    const product = contract?.productId
      // rls-allow: Product é catálogo GLOBAL (sem tenantId) — control-plane.
      ? await this.prisma.admin.product.findUnique({
          where: { id: contract.productId },
          select: { method: true },
        })
      : null;
    const method = (product?.method ?? contract?.method ?? null) as DiagnosticMethodLike;
    return { contract, method, org, company: org?.name ?? 'Empresa', plans, cnaeDecision };
  }

  /**
   * Fonte do MAPA Executivo CRIVO™ (TPL-001) para a empresa: (1) o lead
   * convertido que respondeu o MAPA na LP/CRM; (2) fallback: agregado das
   * respostas do instrumento PRE_DIAGNOSTIC aplicadas pela própria empresa.
   * Template único nos dois canais — muda só a origem do dado (decisão 27/07).
   */
  private async mapaSource(tenantId: string) {
    const active = await resolveActiveMethodology(this.prisma, 'PRE_DIAGNOSTIC');
    const dims = active ? active.config.dimensions.filter((d) => !d.parentSlug) : [];
    const bands = (active?.config.bands ?? []) as BandLike[];
    // rls-allow: tenant/platform_lead são control-plane; leitura self-scoped pela empresa.
    const tenant = await this.prisma.admin.tenant.findFirst({
      where: { organizationId: tenantId },
      select: { id: true },
    });
    if (tenant) {
      // PlatformLead é control-plane (CRM de leads, sem tenantId); aqui já vem
      // filtrado pelo tenant convertido, resolvido logo acima.
      // rls-allow: tabela de control-plane, sem coluna de tenant.
      const leads = await this.prisma.admin.platformLead.findMany({
        where: { convertedTenantId: tenant.id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      });
      const lead = leads.find((l) => l.diagnosticResult && l.diagnosticScore != null);
      if (lead) {
        const r = lead.diagnosticResult as {
          score: number;
          level?: string;
          levelLabel?: string;
          byDimension?: Record<string, number>;
          dimensionLabels?: Record<string, string>;
        };
        return {
          kind: 'lead' as const,
          respondentName: lead.name,
          respondentRole: lead.company ? `Contato — ${lead.company}` : '—',
          concludedAt: lead.createdAt,
          score: r.score,
          byDimension: r.byDimension ?? {},
          dimensionLabels: r.dimensionLabels ?? {},
          dims,
          bands,
        };
      }
    }
    // Fallback: a empresa aplicou o MAPA logada (respostas do PRE_DIAGNOSTIC).
    const agg = await this.instrumentSummary(tenantId, 'PRE_DIAGNOSTIC');
    if (agg && !agg.suppressed) {
      const byDimension: Record<string, number> = {};
      const dimensionLabels: Record<string, string> = {};
      for (const d of agg.byDimension) {
        byDimension[d.slug] = d.value;
        dimensionLabels[d.slug] = d.label;
      }
      return {
        kind: 'aggregate' as const,
        respondentName: 'Aplicação coletiva',
        respondentRole: `${agg.totalRespondents} respondente(s)`,
        concludedAt: agg.lastResponseAt,
        score: agg.score,
        byDimension,
        dimensionLabels,
        dims,
        bands,
      };
    }
    return null;
  }

  /**
   * Documentos disponíveis conforme método + saída técnica do contrato.
   *
   * `ctx` opcional: quem já leu o contexto passa a MESMA leitura. Sem isso,
   * generate() lia o banco duas vezes (uma para montar o conteúdo, outra aqui
   * para o portão) — e o documento podia ser montado de um retrato enquanto o
   * portão aprovava outro. Chamada sem ctx (rota /documents) segue lendo.
   */
  async available(
    tenantId: string,
    ctx?: Awaited<ReturnType<DocumentsService['context']>>,
  ): Promise<DocumentDescriptor[]> {
    const { contract, method, plans } = ctx ?? (await this.context(tenantId));
    const output = contract?.technicalOutput ?? 'SEM_INTEGRACAO';
    const hasPlan = plans.length > 0;
    const hasValidated = plans.some((p) => p.validatedAt);

    // Bloqueios de emissão do dossiê final (doc 09 §9), avaliados no servidor.
    // Como generate() revalida via available() (C2), isto também barra a rota direta.
    const validated = plans.find((p) => p.validatedAt) ?? plans[0];
    const blockers = validated ? dossierBlockers(validated.items as FactorItem[]) : [];
    // O plano deixou de ser pré-requisito: ele é GERADO na emissão, a partir da
    // matriz de risco (decisão de 2026-09-08). `hasValidated`/`blockers` ficam
    // apenas informativos.
    void hasValidated;
    const dossieOk = blockers.length === 0;
    const dossieReason = blockers.length ? blockers.join(' ') : undefined;
    // Campanha ainda aberta: a previa continua livre, mas a versao OFICIAL dos
    // documentos que leem as respostas do ciclo espera o encerramento. Nao e
    // validacao humana (que saiu em 2026-09-08) — e o estado da coleta.
    const cicloAberto = await this.cicloEmAndamento(tenantId);
    const bloqueioDeEmissao = cicloAberto
      ? `Campanha "${cicloAberto}" ainda aberta — encerre a campanha para emitir a versão oficial. A pré-visualização continua disponível.`
      : undefined;
    const docs: DocumentDescriptor[] = [];
    const add = (
      type: string,
      available: boolean,
      reason?: string,
      subtitle?: string,
      emitBlockedReason?: string,
    ) =>
      docs.push({
        type,
        title: DOCUMENT_TYPE_LABEL[type] ?? type,
        available,
        reason,
        subtitle,
        emitBlockedReason,
      });

    if (method === 'INICIAL' || !contract) add('relatorio_preliminar', true);
    // TPL-001 — Relatório Executivo do MAPA CRIVO™: evento de geração é "MAPA
    // concluído" (Pacote §1) — precisa existir a fonte do MAPA (lead convertido
    // ou aplicação do PRE_DIAGNOSTIC pela empresa).
    const mapa = await this.mapaSource(tenantId);
    add(
      'relatorio_executivo',
      !!mapa,
      mapa ? undefined : 'Requer o MAPA Executivo CRIVO™ concluído (diagnóstico inicial respondido)',
    );
    // TPL-004 — Extrato do Plano de Ação Preventivo: quando há plano.
    if (hasPlan) add('plano_acao', true);
    // TPL-002 — Dossiê Técnico (template ÚNICO, Pacote §3).
    // REGRA: concluir o Diagnóstico Organizacional (respondentes >= mínimo) já
    // libera o Dossiê para leitura (Matriz de Risco Psicossocial) — INDEPENDENTE
    // da saída técnica (AEP/AEP+PGR/sem integração) e de haver Plano de Evolução
    // validado. Antes, com saída AEP/AEP+PGR o Dossiê ficava preso em "Requer
    // plano validado" mesmo com o diagnóstico feito — por isso não aparecia.
    // A EMISSÃO oficial (emit) mantém as exigências (plano validado, textos
    // aprovados, cadastro completo); aqui é a disponibilidade para gerar/ver.
    const psy = await this.psychosocial.results(tenantId).catch(() => null);
    const diagOk = !!psy && psy.totalRespondents >= psy.minRespondents;
    // Nome do diagnóstico que origina o Dossiê (aparece na lista de Documentos).
    // Era fixo em "Diagnóstico Organizacional (NR-1)" — e uma empresa que
    // contratou o Essencial via na lista o nome de um diagnóstico que não é o
    // dela. Agora vem do instrumento contratado.
    const slugContratado = await resolveInstrumentForTenant(this.prisma, tenantId);
    const instrumentoDoDossie = slugContratado
      ? // rls-allow: DiagnosticInstrument é catálogo GLOBAL (control-plane), sem tenantId.
        await this.prisma.admin.diagnosticInstrument
          .findFirst({ where: { slug: slugContratado }, select: { name: true } })
          .catch(() => null)
      : null;
    const dossieDiag = instrumentoDoDossie?.name ?? 'Diagnóstico Organizacional (NR-1)';
    if (output === 'AEP' || output === 'AEP_PGR') {
      const ok = dossieOk || diagOk;
      add('dossie_tecnico', ok, ok ? undefined : dossieReason, dossieDiag, bloqueioDeEmissao);
    } else if (method === 'ORGANIZACIONAL' || diagOk) {
      add(
        'dossie_tecnico',
        diagOk,
        diagOk ? undefined : 'Requer o Diagnóstico Organizacional respondido (respondentes suficientes)',
        dossieDiag,
        bloqueioDeEmissao,
      );
    }
    if (method === 'ORGANIZACIONAL') {
      add('relatorio_tecnico', true, undefined, undefined, bloqueioDeEmissao);
    }
    // TPL-003 — Relatório de Evolução e Efetividade: compara os DOIS últimos
    // CICLOS FORMAIS encerrados (definição do cliente 27/07: ciclo = aplicação
    // aberta e encerrada; atualizar ação/prazo NÃO cria ciclo). A comparação é
    // fator a fator sobre os SNAPSHOTS congelados no encerramento (F4).
    const comparable = await this.comparableCycles(tenantId);
    add(
      'relatorio_evolucao',
      comparable.ok,
      comparable.ok ? undefined : comparable.reason,
    );

    // Relatórios cadastrados no Motor 4 e VINCULADOS a um diagnóstico do Motor
    // de Diagnósticos (cultura, NR-1, IA, governança…). Ficam disponíveis quando
    // a empresa aplicou aquele diagnóstico e o volume permite divulgar (supressão).
    for (const t of await this.reportTemplates()) {
      const agg = await this.instrumentSummary(tenantId, t.instrumentSlug);
      const ok = !!agg && !agg.suppressed;
      docs.push({
        type: `tpl:${t.key}`,
        title: t.name,
        // Um MESMO modelo pode estar cadastrado para mais de um diagnóstico — o
        // Dossiê oficial serve o Essencial e o Organizacional. Sem o nome do
        // diagnóstico o cliente via dois cartões de título idêntico e nenhuma
        // forma de saber qual era qual.
        subtitle: t.instrumentName,
        available: ok,
        reason: ok
          ? undefined
          : !agg || agg.totalRespondents === 0
            ? `Requer respostas do diagnóstico "${t.instrumentName}"`
            : `Requer ao menos ${agg.minRespondents} respostas no diagnóstico "${t.instrumentName}" (hoje: ${agg.totalRespondents}) — regra de anonimato`,
      });
    }
    return docs;
  }

  /**
   * Documento de um MODELO cadastrado: junta o texto fixo do modelo com o
   * RESULTADO REAL do diagnóstico vinculado (agregado, com supressão) e, se
   * marcado, as ações do Plano de Evolução. É o que liga o Motor 4 ao Motor de
   * Diagnósticos: trocar a metodologia muda o conteúdo do relatório.
   */
  private async generateFromTemplate(
    tenantId: string,
    key: string,
    ctx: {
      company: string;
      org: { taxId: string | null } | null;
      contract: { technicalOutput?: string | null; responsible?: string | null } | null;
      method: DiagnosticMethodLike;
      plans: { title: string; validatedAt: Date | null; items: FactorItem[] }[];
    },
  ): Promise<GeneratedDocument> {
    // rls-allow: report_templates é control-plane (catálogo global, owner-only).
    const tpl = await this.prisma.admin.reportTemplate.findUnique({
      where: { key },
      include: { instrument: { select: { name: true, slug: true } } },
    });
    if (!tpl) throw new BadRequestException('Modelo de relatório não encontrado.');

    const agg = await this.instrumentSummary(tenantId, tpl.instrumentSlug);
    if (!agg || agg.suppressed) {
      throw new BadRequestException(
        `Sem respostas suficientes no diagnóstico "${tpl.instrument.name}" para emitir este relatório.`,
      );
    }

    const output = ctx.contract?.technicalOutput ?? 'SEM_INTEGRACAO';
    // Identificação no padrão do modelo oficial (grade de pares). Campos sem
    // valor saem vazios e o renderizador os OMITE — o modelo proíbe campo vazio.
    // "Responsável CRIVO" não entra: a responsabilidade legal é da organização.
    const meta: GeneratedDocument['meta'] = [
      { label: 'Organização', value: ctx.company },
      { label: 'CNPJ', value: ctx.org?.taxId ?? '' },
      { label: 'Método aplicado', value: tpl.instrument.name },
      { label: 'Data de emissão', value: fmt(new Date()) },
      { label: 'Saída técnica', value: OUTPUT_LABEL[output] ?? output },
      { label: 'Respostas válidas', value: String(agg.totalRespondents) },
    ];

    // Blocos que o motor injeta. Montados uma vez e usados pelos DOIS caminhos:
    // o modelo FIEL (substituição na posição do marcador) e o modelo por seções
    // (empilhados no fim, comportamento histórico).
    const resultsSection: DocumentSection = {
      heading: 'Resultado do diagnóstico',
      body:
        `Resultado agregado de "${tpl.instrument.name}" com base em ${agg.totalRespondents} ` +
        `respondente(s)${agg.sectors ? ` em ${agg.sectors} setor(es)` : ''}. ` +
        'Resultado coletivo — nenhuma resposta individual é exibida ou identificável.',
      rows: [
        { label: 'Índice do diagnóstico (0–100)', value: String(agg.score) },
        { label: 'Faixa', value: agg.levelLabel },
        { label: 'Respondentes', value: String(agg.totalRespondents) },
        { label: 'Última resposta', value: agg.lastResponseAt ? fmt(agg.lastResponseAt) : '—' },
      ],
    };

    const dimensionsSection: DocumentSection | null = agg.byDimension.length
      ? {
          heading: 'Resultado por dimensão',
          body: 'Média por dimensão da versão da metodologia ativa no período.',
          table: {
            columns: ['Dimensão', 'Índice (0–100)'],
            data: agg.byDimension.map((d) => [d.label, String(d.value)]),
          },
        }
      : null;

    const planOf = (): DocumentSection => {
      const plan = ctx.plans.find((p) => p.validatedAt) ?? ctx.plans[0];
      const items = plan?.items ?? [];
      return {
        heading: 'Plano de Evolução vinculado',
        body: plan
          ? `Ações registradas em "${plan.title}"${plan.validatedAt ? ' (plano validado)' : ' (plano ainda não validado)'}.`
          : 'Nenhum plano de evolução registrado para esta empresa até o momento.',
        table: items.length
          ? {
              columns: ['Ponto de atenção', 'Ação', 'Responsável', 'Prazo', 'Risco', 'Status'],
              data: items.map((i) => [
                i.point,
                i.action,
                i.responsible ?? '—',
                i.dueDate ? fmt(i.dueDate) : '—',
                factorRisk(i).label,
                ACTION_LABEL[i.status] ?? i.status,
              ]),
            }
          : undefined,
      };
    };

    const signature = signatureSection(
      'A revisão, validação e integração formal deste relatório às obrigações aplicáveis são de ' +
        'responsabilidade da empresa contratante e/ou do responsável técnico/designado.',
    );
    const docControl = docControlSection();

    const sections: DocumentSection[] = [];
    const tplHtml = typeof tpl.html === 'string' ? tpl.html.trim() : '';

    if (tplHtml) {
      // ── Modelo FIEL ao arquivo importado ─────────────────────────────────
      // O corpo é o próprio documento do cliente (títulos, tabelas, listas e
      // formatação preservados); só os marcadores {{...}} mudam. É isso que faz
      // o relatório sair na ORDEM e no formato do modelo, em vez de empilhar os
      // blocos dinâmicos no fim.
      const wants = (key: string) => tplHtml.includes(`{{${key}}}`);
      const matrixSections = wants('matriz_risco')
        ? (await this.psychosocialMatrixSections(tenantId)).sections
        : [];
      const adhesion = wants('participacao')
        ? await this.sectorAdhesion(tenantId, {
            slug: tpl.instrumentSlug,
            motorPsicossocial: await usesPsychosocialEngine(this.prisma, tpl.instrumentSlug),
          })
        : null;

      const filled = fillReportPlaceholders(tplHtml, (key) => {
        switch (key) {
          case 'empresa':
            return escapeHtml(ctx.company);
          case 'cnpj':
            return escapeHtml(ctx.org?.taxId ?? '');
          case 'data_emissao':
            return escapeHtml(fmt(new Date()));
          case 'diagnostico':
            return escapeHtml(tpl.instrument.name);
          case 'saida_tecnica':
            return escapeHtml(OUTPUT_LABEL[output] ?? output);
          case 'respondentes':
            return String(agg.totalRespondents);
          case 'setores':
            return agg.sectors ? String(agg.sectors) : '';
          case 'score':
            return String(agg.score);
          case 'faixa':
            return escapeHtml(agg.levelLabel);
          case 'ultima_resposta':
            return agg.lastResponseAt ? escapeHtml(fmt(agg.lastResponseAt)) : '';
          case 'maior_pontuacao':
            return escapeHtml(dimensionHighlight(agg.byDimension, agg.bands, 'max'));
          case 'maior_atencao':
            return escapeHtml(dimensionHighlight(agg.byDimension, agg.bands, 'min'));
          case 'identificacao':
            return identGridHtml(meta);
          case 'resultado':
            return sectionInnerHtml(resultsSection);
          case 'tabela_dimensoes':
            return dimensionsSection ? sectionInnerHtml(dimensionsSection) : '';
          case 'matriz_risco':
            return matrixSections.map(sectionBlockHtml).join('');
          case 'participacao':
            return adhesion && adhesion.sectors.length
              ? gridTableHtml({
                  columns: ['Setor', 'Respondentes'],
                  data: adhesion.sectors.map((x) => [
                    x.sector,
                    // Recorte abaixo do mínimo tem o número ocultado (Bloqueio §5).
                    x.suppressed ? `Suprimido (< ${adhesion.minRespondents})` : String(x.respondents),
                  ]),
                })
              : '';
          case 'plano_acao':
            return sectionInnerHtml(planOf());
          case 'assinaturas':
            return sectionInnerHtml(signature);
          case 'controle_documental':
            return sectionInnerHtml(docControl);
          default:
            return '';
        }
      });

      // Se o modelo posiciona a identificação no corpo, o cabeçalho não a
      // repete — senão a mesma grade sairia duas vezes no documento.
      if (filled.used.includes('identificacao')) meta.length = 0;

      // Heading vazio: o corpo fiel já traz a titulação do próprio modelo.
      sections.push({ heading: '', html: filled.html });

      // Bloco que o modelo NÃO posicionou continua sendo anexado quando a flag
      // está marcada — o admin não perde conteúdo por esquecer o marcador.
      if (tpl.includeResults && !filled.used.includes('resultado')) sections.push(resultsSection);
      if (tpl.includeDimensions && dimensionsSection && !filled.used.includes('tabela_dimensoes')) {
        sections.push(dimensionsSection);
      }
      if (tpl.includePlan && !filled.used.includes('plano_acao')) sections.push(planOf());
      if (!filled.used.includes('assinaturas')) sections.push(signature);
      if (!filled.used.includes('controle_documental')) sections.push(docControl);
    } else {
      // ── Modelo por seções (escrito à mão ou importado antes desta versão) ──
      // 1) Texto fixo do modelo (contexto, metodologia, limites).
      for (const s of (tpl.sections as ReportTemplateSectionRow[] | null) ?? []) {
        if (s?.heading || s?.body) {
          sections.push({ heading: s.heading || 'Contexto', body: s.body || '' });
        }
      }
      // 2) Resultado do diagnóstico (score + faixa) direto do motor.
      if (tpl.includeResults) sections.push(resultsSection);
      // 3) Dimensões do instrumento (a estrutura publicada na metodologia ativa).
      if (tpl.includeDimensions && dimensionsSection) sections.push(dimensionsSection);
      // 4) Ações do Plano de Evolução (quando o modelo pede).
      if (tpl.includePlan) sections.push(planOf());
      sections.push(signature);
      sections.push(docControl);
    }

    return {
      type: `tpl:${tpl.key}`,
      title: tpl.name,
      subtitle:
        tpl.description ||
        (/^diagn[óo]stico/i.test(tpl.instrument.name)
          ? `Relatório vinculado ao ${tpl.instrument.name}`
          : `Relatório vinculado ao diagnóstico ${tpl.instrument.name}`),
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  /**
   * Adesão por setor/área/turno com SUPRESSÃO por volume mínimo (Bloqueio §5:
   * "não exibir recorte com volume inferior ao mínimo de confidencialidade").
   * Volume = número de respondentes do recorte; recortes abaixo do mínimo têm o
   * número ocultado. Fonte: respostas psicossociais (o dossiê é psicossocial).
   */
  /**
   * Instrumento que ESTA empresa aplica, e em qual motor ele grava.
   *
   * Este arquivo resolvia o instrumento por `resolvePsychosocialInstrument`, que
   * devolve SEMPRE o do método ORGANIZACIONAL, ignorando o tenant. Como os dois
   * motores gravam em tabelas diferentes — Organizacional em
   * `psychosocial_responses`, Essencial em `diagnostic_responses` —, o Dossiê de
   * quem contratou o Essencial lia ZERO resposta e saía suprimido por
   * confidencialidade: sem score, sem faixa, sem dimensões, sem período e sem
   * participação, com as respostas todas lá, na outra tabela.
   *
   * Mesma resolução que `psychosocial.results()` já usa para a matriz — é por
   * isso que a matriz do Essencial funcionava e o resto do documento não. Para
   * tenant Organizacional o resultado é idêntico ao de antes.
   */
  private async instrumentoDoTenant(
    tenantId: string,
    method?: DiagnosticMethodLike,
  ): Promise<TenantInstrument> {
    return resolveTenantInstrument(this.prisma, tenantId, method);
  }

  /**
   * `instrumento`, quando informado, evita reconsultar o contrato (o chamador
   * já resolveu) e permite um instrumento EXPLÍCITO diferente do tenant — caso
   * de `generateFromTemplate`, onde o recorte por setor é do instrumento do
   * MODELO (Motor 4), não necessariamente o que a empresa contratou.
   */
  private async sectorAdhesion(tenantId: string, instrumento?: TenantInstrument) {
    const minRespondents = await resolveMinRespondents(this.prisma, tenantId);
    const { slug, motorPsicossocial } = instrumento ?? (await this.instrumentoDoTenant(tenantId));
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows: { sector: string | null }[] = motorPsicossocial
        ? await tx.psychosocialResponse.findMany({ select: { sector: true } })
        : await tx.diagnosticResponse.findMany({
            where: { instrumentSlug: slug },
            select: { sector: true },
          });
      const bySector = new Map<string, number>();
      for (const r of rows) {
        const k = r.sector?.trim() || 'Não informado';
        bySector.set(k, (bySector.get(k) ?? 0) + 1);
      }
      const sectors = [...bySector.entries()]
        .map(([sector, respondents]) => ({
          sector,
          respondents,
          suppressed: respondents < minRespondents,
        }))
        .sort((a, b) => b.respondents - a.respondents);
      return { minRespondents, total: rows.length, sectors };
    });
  }

  /** Modelos ATIVOS do catálogo (control-plane). */
  private async reportTemplates() {
    // rls-allow: report_templates é control-plane (catálogo global, owner-only).
    const rows = await this.prisma.admin.reportTemplate.findMany({
      where: { active: true, instrument: { active: true } },
      orderBy: { name: 'asc' },
      include: { instrument: { select: { name: true } } },
    });
    return rows.map(({ instrument, ...t }) => ({ ...t, instrumentName: instrument.name }));
  }

  /**
   * Agregado do instrumento para a empresa — MESMA regra da tela de resultados:
   * média das respostas, faixa da metodologia ativa e supressão por volume
   * mínimo (Configuração do Motor). Nunca expõe resposta individual.
   */
  private async instrumentSummary(tenantId: string, instrumentSlug: string) {
    const minRespondents = await resolveMinRespondents(this.prisma, tenantId);
    const active = await resolveActiveMethodology(this.prisma, instrumentSlug);
    const dims = active ? active.config.dimensions.filter((d) => !d.parentSlug) : [];
    const bands = active?.config.bands ?? [];
    // Um modelo do Motor 4 pode estar vinculado ao instrumento do método
    // ORGANIZACIONAL — e esse instrumento grava em `psychosocial_responses`,
    // não em `diagnostic_responses`. Fixo na segunda, o modelo nunca ficava
    // disponível para essa empresa, por mais respostas que ela coletasse.
    const motorPsicossocial = await usesPsychosocialEngine(this.prisma, instrumentSlug);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = motorPsicossocial
        ? await tx.psychosocialResponse.findMany({
            select: { score: true, byDimension: true, sector: true, submittedAt: true },
          })
        : await tx.diagnosticResponse.findMany({
            where: { instrumentSlug },
            select: { score: true, byDimension: true, sector: true, submittedAt: true },
          });
      const total = rows.length;
      if (total === 0 || total < minRespondents) {
        return { suppressed: true as const, totalRespondents: total, minRespondents };
      }
      const score = Math.round((rows.reduce((s, r) => s + r.score, 0) / total) * 10) / 10;
      const byDimension = dims.map((d) => {
        const vals = rows.map((r) => Number((r.byDimension as Record<string, number>)?.[d.slug] ?? 0));
        return {
          slug: d.slug,
          label: d.label,
          value: Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10,
        };
      });
      const band = bands.find((b) => score >= b.min && score <= b.max);
      const sectors = new Set(rows.map((r) => r.sector).filter(Boolean));
      const last = rows.reduce<Date | null>(
        (acc, r) => (!acc || r.submittedAt > acc ? r.submittedAt : acc),
        null,
      );
      return {
        suppressed: false as const,
        totalRespondents: total,
        minRespondents,
        score,
        levelLabel: band?.label ?? '—',
        byDimension,
        // Faixas da metodologia ativa: rotulam a dimensao destaque nos
        // marcadores {{maior_pontuacao}} / {{maior_atencao}}.
        bands,
        sectors: sectors.size,
        lastResponseAt: last,
      };
    });
  }

  /**
   * Agregado do questionário PSICOSSOCIAL da empresa (tabela própria, não a de
   * instrumentos dinâmicos): score/dimensões pela metodologia ATIVA, período
   * (1ª e última resposta) e supressão pelo mínimo de confidencialidade.
   */
  private async psychosocialSummary(
    tenantId: string,
    range?: { from: Date; to: Date },
    instrumento?: TenantInstrument,
  ) {
    const minRespondents = await resolveMinRespondents(this.prisma, tenantId);
    const { slug, motorPsicossocial } = instrumento ?? (await this.instrumentoDoTenant(tenantId));
    const active = await resolveActiveMethodology(this.prisma, slug);
    const dims = active ? active.config.dimensions.filter((d) => !d.parentSlug) : [];
    const bands = (active?.config.bands ?? []) as BandLike[];
    // Casas decimais da METODOLOGIA. Era `Math.round` fixo: a média de 7
    // respondentes saía 70 onde o gabarito da Massa Ouro diz 69,64, e a regra de
    // homologação trata diferença de score como FAIL. Ausente/0 mantém inteiro.
    const casas = Math.max(0, Math.min(6, Math.trunc(active?.config.rounding ?? 0)));
    const arredonda = (x: number) => {
      const f = 10 ** casas;
      return Math.round((x + Number.EPSILON) * f) / f;
    };
    return this.prisma.forTenant(tenantId, async (tx) => {
      // F4: com `range`, só as respostas DA JANELA DO CICLO entram no
      // snapshot congelado — a aplicação formal é o período aberto/encerrado.
      const janela = range ? { submittedAt: { gte: range.from, lte: range.to } } : {};
      const rows: {
        sector: string | null;
        score: number;
        byDimension: unknown;
        submittedAt: Date;
      }[] = motorPsicossocial
        ? await tx.psychosocialResponse.findMany({
            where: janela,
            select: { sector: true, score: true, byDimension: true, submittedAt: true },
          })
        : await tx.diagnosticResponse.findMany({
            where: { instrumentSlug: slug, ...janela },
            select: { sector: true, score: true, byDimension: true, submittedAt: true },
          });
      const total = rows.length;
      const dates = rows.map((r) => r.submittedAt).sort((a, b) => a.getTime() - b.getTime());
      const period =
        dates.length > 0 ? `${fmt(dates[0])} a ${fmt(dates[dates.length - 1])}` : '—';
      if (total < minRespondents) {
        return { suppressed: true as const, totalRespondents: total, minRespondents, period };
      }
      const score = arredonda(rows.reduce((s, r) => s + r.score, 0) / total);
      const byDimension = dims.map((d) => {
        const vals = rows.map((r) => Number((r.byDimension as Record<string, number>)?.[d.slug] ?? 0));
        return {
          slug: d.slug,
          label: d.label,
          value: arredonda(vals.reduce((s, x) => s + x, 0) / vals.length),
        };
      });
      const sectorsList = [...new Set(rows.map((r) => r.sector?.trim()).filter(Boolean))] as string[];
      return {
        suppressed: false as const,
        totalRespondents: total,
        minRespondents,
        period,
        score,
        // findBandForScore — o MESMO fallback que psychosocial.results()/a tela
        // de resultados usam — não `bandLabelOf`: os dois classificavam o vão
        // entre faixas em direções OPOSTAS (pior vs melhor), e só passou a
        // importar quando o score deixou de ser sempre inteiro.
        levelLabel: findBandForScore(bands, score)?.label ?? '—',
        byDimension,
        bands,
        sectorsList,
      };
    });
  }

  /**
   * F3 — TEXTOS APROVADOS do documento (decisão 1-A): a IA rascunha, a equipe
   * CRIVO aprova no Super Admin, e SÓ o texto aprovado entra aqui. Retorna o
   * mapa campo → texto aprovado (campos sem aprovação ficam de fora).
   */
  private async approvedTextsOf(tenantId: string, docType: string): Promise<Record<string, string>> {
    // rls-allow: approved_texts é control-plane (fila de aprovação, owner-only).
    const rows = await this.prisma.admin.approvedText.findMany({
      where: { tenantId, docType },
      select: { field: true, approvedContent: true },
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
      const text = r.approvedContent?.trim();
      if (text) out[r.field] = text;
    }
    return out;
  }

  // ── F4 · Ciclos formais de diagnóstico (snapshot p/ TPL-003) ───────────────

  /**
   * SNAPSHOT congelado no ENCERRAMENTO do ciclo: fatores do plano com risco
   * derivado + evidências + agregado psicossocial DA JANELA do ciclo. É a fonte
   * imutável do comparativo do TPL-003 — nunca recalculada depois.
   */
  async cycleSnapshot(tenantId: string, from: Date, to: Date) {
    const { method, plans } = await this.context(tenantId);
    const instrumento = await this.instrumentoDoTenant(tenantId, method);
    const plan = plans.find((p) => p.validatedAt) ?? plans[0];
    const items = (plan?.items ?? []) as (Omit<FactorItem, 'evidences'> & {
      evidences: { title: string; status: string }[];
    })[];
    const factors = items.map((i) => {
      const risk = factorRisk(i);
      return {
        point: i.point,
        action: i.action,
        risk: risk.label,
        riskDerived: risk.derived,
        status: i.status,
        areaProcess: i.areaProcess ?? null,
        indicator: i.indicator ?? null,
        // A4 — proveniência congelada junto com o fator (auditoria/TPL-003).
        origin: i.origin ?? null,
        sourceInstrumentSlug: i.sourceInstrumentSlug ?? null,
        evidences: i.evidences.map((e) => ({ title: e.title, status: e.status })),
      };
    });
    const psy = await this.psychosocialSummary(tenantId, { from, to }, instrumento);
    return {
      method: method ?? null,
      methodologyVersion: await this.activeVersionLabel(instrumento.slug),
      snapshot: {
        planTitle: plan?.title ?? null,
        planValidatedAt: plan?.validatedAt ? new Date(plan.validatedAt).toISOString() : null,
        factors,
        psychosocial: {
          totalRespondents: psy.totalRespondents,
          suppressed: psy.suppressed,
          score: psy.suppressed ? null : psy.score,
          levelLabel: psy.suppressed ? null : psy.levelLabel,
        },
      },
    };
  }

  /** Os DOIS últimos ciclos ENCERRADOS com fatores congelados (base do TPL-003). */
  private async comparableCycles(tenantId: string) {
    const closed = await this.prisma.forTenant(tenantId, (tx) =>
      tx.diagnosticCycle.findMany({
        where: { status: 'ENCERRADO' },
        orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
        // Snapshots são JSONB inteiros — limitar a janela recente basta (o
        // comparativo usa só os 2 últimos com fatores) e evita carregar anos.
        take: 24,
      }),
    );
    type Snap = { factors?: unknown[] };
    const withFactors = closed.filter((c) => ((c.snapshot as Snap | null)?.factors ?? []).length > 0);
    if (withFactors.length < 2) {
      const semFatores = closed.length - withFactors.length;
      return {
        ok: false as const,
        reason:
          `Requer dois ciclos formais de diagnóstico encerrados com fatores registrados — hoje: ` +
          `${closed.length} encerrado(s)${semFatores > 0 ? ` (${semFatores} sem fatores no plano)` : ''}. ` +
          'Abra e encerre ciclos em Plano de Evolução · Ciclos de diagnóstico.',
      };
    }
    return { ok: true as const, current: withFactors[0], previous: withFactors[1] };
  }

  /** Número da versão metodológica ATIVA de um instrumento (rótulo "v N"). */
  private async activeVersionLabel(instrument: string): Promise<string> {
    // rls-allow: methodology_versions é control-plane (catálogo global).
    const v = await this.prisma.admin.methodologyVersion.findFirst({
      where: { instrument, status: 'ACTIVE' },
      select: { version: true },
    });
    return v ? `v${v.version}` : '—';
  }

  // ── TPL-001 · Relatório Executivo do MAPA CRIVO™ (layout oficial) ──────────
  private async generateMapaExecutivo(
    tenantId: string,
    ctx: { company: string; org: { taxId: string | null } | null; cnaeDecision: CnaeDecisionRow | null },
  ): Promise<GeneratedDocument> {
    const mapa = await this.mapaSource(tenantId);
    if (!mapa) throw new BadRequestException('Requer o MAPA Executivo CRIVO™ concluído.');
    const approved = await this.approvedTextsOf(tenantId, 'relatorio_executivo');

    // Os MESMOS tres campos do modelo aprovado e do PDF que vai por e-mail.
    // CNPJ, cargo e versao metodologica sairam: nao estao no modelo e faziam a
    // tela divergir do anexo que o cliente recebe.
    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: ctx.company },
      { label: 'Respondente', value: mapa.respondentName },
      { label: 'Data da conclusão', value: mapa.concludedAt ? fmt(mapa.concludedAt) : '—' },
    ];

    // Dimensões na ordem da metodologia ativa, com código oficial ME1–ME6.
    const dimRows = mapa.dims.map((d, i) => {
      const value = mapa.byDimension[d.slug];
      const name = mapa.dimensionLabels[d.slug] ?? d.label;
      return {
        code: ME_CODE[d.slug] ?? `ME${i + 1}`,
        name,
        value: typeof value === 'number' ? value : null,
      };
    });
    // Fallback: o snapshot do respondente pode ter dimensões que a metodologia
    // ATIVA não tem mais (republicação com slugs novos, ou sem versão ativa).
    // Os valores gravados NÃO são descartados — entram com o rótulo do snapshot.
    const knownSlugs = new Set(mapa.dims.map((d) => d.slug));
    for (const slug of Object.keys(mapa.byDimension)) {
      if (knownSlugs.has(slug)) continue;
      const value = mapa.byDimension[slug];
      if (typeof value !== 'number') continue;
      dimRows.push({
        code: ME_CODE[slug] ?? `ME${dimRows.length + 1}`,
        name: mapa.dimensionLabels[slug] ?? slug,
        value,
      });
    }
    const scored = dimRows.filter((d): d is typeof d & { value: number } => d.value != null);
    const sorted = [...scored].sort((a, b) => b.value - a.value);
    // Forças e Atenções são conjuntos DISJUNTOS: as atenções saem do restante
    // (com ≤2 dimensões pontuadas não há "atenção" separada — nada duplica).
    const forces = sorted.slice(0, 2);
    const attentions = sorted.slice(2).slice(-2).reverse();

    // F3 — leitura dos sinais aprovada, quebrada por código oficial (ME1–ME6).
    const sinais = signalReadings(
      approved['sinais_leitura'],
      [...forces, ...attentions].map((d) => d.code),
    );

    // O MAPA do portal é O MESMO documento que vai anexo ao e-mail do lead:
    // mesma ordem de blocos do modelo aprovado e MESMAS funções de texto.
    // Antes esta tela tinha estrutura própria — inclusive um bloco "Principais
    // sinais" que rotulava de "Força" a dimensão de maior nota mesmo em faixa
    // de atenção, o oposto do que o modelo diz.
    const faixaGeral = bandLabelOf(mapa.score, mapa.bands);
    const dimsMapa = dimRows
      .filter((d) => d.value != null)
      .map((d) => ({
        label: d.name,
        score: d.value as number,
        faixaLabel: bandLabelOf(d.value as number, mapa.bands),
      }));
    const faixas = mapa.bands.map((b) => ({ min: b.min, max: b.max }));
    // A cor sai da FAIXA cadastrada no Motor — a mesma fonte que o PDF do
    // e-mail usa. Antes era uma rampa fixa aqui, entao a mesma faixa aparecia
    // numa cor na tela e noutra no anexo.
    const corDaFaixa = (v: number) =>
      [...mapa.bands].sort((a, b) => a.min - b.min).find((f) => v >= f.min && v <= f.max)?.color ??
      null;

    const sections: DocumentSection[] = [
      {
        heading: 'Panorama',
        html: panoramaHtml(
          mapa.score,
          faixaGeral,
          corDaFaixa(mapa.score),
          panoramaMapa(mapa.score, faixaGeral, dimsMapa.length),
        ),
      },
      {
        // UMA tabela so, com a coluna Escala — como no modelo. Antes saiam duas
        // leituras da mesma coisa: as barras e, logo abaixo, um quadro
        // "Codigo/Dimensao/Score/Faixa" que o documento do e-mail nao tem.
        heading: 'Dimensões',
        html: barrasDimensoesHtml(
          dimsMapa.map((d) => ({
            label: d.label,
            value: d.score,
            faixa: d.faixaLabel,
            cor: corDaFaixa(d.score),
          })),
          {
            cabecalho: true,
            legenda: mapa.bands.map((b) => ({
              label: b.label,
              min: b.min,
              max: b.max,
              cor: b.color ?? null,
            })),
          },
        ),
      },
      {
        heading: 'Síntese executiva',
        // O texto aprovado pela equipe CRIVO no Super Admin continua vencendo:
        // é revisão editorial deliberada, não divergência acidental.
        body: approved['sintese_executiva'] ?? sinteseMapa(dimsMapa, faixas),
      },
      // Só a síntese e o caminho: é o que o modelo aprovado traz de prosa. A
      // leitura de qual dimensão pontuou mais e qual pesa mais fica dentro da
      // síntese, não em blocos separados.
      { heading: 'Caminho recomendado', body: caminhoMapa(dimsMapa) },
      {
        heading: 'Sobre esta leitura',
        body:
          'O MAPA Executivo é uma visão preliminar de gestão. Não substitui diagnóstico ' +
          'técnico ou avaliação especializada.',
      },
    ];

    return {
      type: 'relatorio_executivo',
      // Mesmo titulo e subtitulo do documento que o lead recebe. O codigo do
      // template (TPL-001) e controle interno da CRIVO, nao informacao do
      // documento da empresa.
      title: 'MAPA Executivo',
      subtitle: 'Visão preliminar da organização',
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  /** Seções do Dossiê com a Matriz de Risco Psicossocial vinda do DIAGNÓSTICO
   *  organizacional (P × S por dimensão, por GHE/setor), no formato do relatório
   *  de referência. Reusa o MESMO cálculo da tela de resultados (results()). */
  private async psychosocialMatrixSections(
    tenantId: string,
  ): Promise<{ sections: DocumentSection[]; matrix: PsychosocialRiskMatrixRow[] }> {
    let res: Awaited<ReturnType<PsychosocialService['results']>> | null = null;
    try {
      res = await this.psychosocial.results(tenantId);
    } catch {
      return { sections: [], matrix: [] };
    }
    if (!res || res.totalRespondents < res.minRespondents) return { sections: [], matrix: [] };
    const table = (rows: PsychosocialRiskMatrixRow[]) => ({
      columns: ['Fator', 'Exposição média', 'Probabilidade', 'Severidade', 'Risco', 'Classificação', 'Ação recomendada', 'Plano de ação'],
      data: rows.map((r) => [
        r.label,
        r.exposureAvg.toFixed(2).replace('.', ','),
        String(r.probability),
        String(r.severity),
        String(r.risk),
        // Rótulo legível — antes saía o código cru (ACEITAVEL, SIGNIFICATIVO…).
        PSYCHOSOCIAL_RISK_CLASS_LABEL[r.riskClass],
        r.actionLabel ?? PSYCHOSOCIAL_RISK_CLASS_ACTION[r.riskClass],
        r.planRequired ? 'Obrigatório' : 'Não obrigatório',
      ]),
    });
    const sections: DocumentSection[] = [];
    sections.push({
      heading: 'Matriz de Risco Psicossocial — leitura',
      body:
        'Probabilidade (1–5): frequência com que o risco é percebido, calculada pela exposição média das ' +
        'respostas vinculadas ao fator (exposição = 6 − resposta, pois as perguntas são afirmativas ' +
        'positivas); acima de 60% das respostas em exposição alta, a probabilidade é 5. Severidade (1–5): ' +
        'potencial de impacto do fator, fixo na metodologia. Risco = Probabilidade × Severidade (1–25): ' +
        '1–4 Baixo (monitorar) · 5–9 Moderado (prevenir) · 10–15 Alto (corrigir) · 16–20 Muito alto ' +
        '(mitigar urgentemente) · 21–25 Crítico (ação imediata). A partir de 10, o plano de ação é ' +
        'obrigatório — corte definido pela metodologia CRIVO para priorizar o tratamento.',
    });
    const overall = res.overall && !res.overall.suppressed ? res.overall : null;
    const consolidada =
      overall && 'riskMatrix' in overall && overall.riskMatrix.length ? overall.riskMatrix : [];
    if (consolidada.length) {
      sections.push({
        heading: 'Distribuição do risco na matriz 5 × 5',
        body:
          'Cada célula cruza a Probabilidade (eixo horizontal) com a Severidade (eixo vertical). ' +
          'O número em destaque é a quantidade de fatores naquela posição; o número abaixo é o ' +
          'risco resultante (P × S).',
        html: grade5x5Html(consolidada),
      });
      sections.push({
        heading: `Matriz de Risco — Consolidado da organização (${res.totalRespondents} avaliados)`,
        table: table(consolidada),
      });
    }
    for (const s of res.sectors) {
      if (s.suppressed || !('riskMatrix' in s) || !s.riskMatrix || !s.riskMatrix.length) continue;
      // Recorte que cobre a MESMA população do consolidado repetiria a tabela
      // inteira sem acrescentar leitura nenhuma (é o caso de empresa com um
      // único setor). O consolidado já responde por esse grupo.
      if (consolidada.length && s.respondents === res.totalRespondents) continue;
      sections.push({
        heading: `Matriz de Risco — Grupo: ${s.sector} (${s.respondents} avaliados)`,
        table: table(s.riskMatrix),
      });
    }
    if (sections.length === 1) {
      sections.push({
        heading: 'Matriz de Risco Psicossocial',
        body:
          'A matriz será exibida quando a severidade das dimensões estiver parametrizada no Motor de ' +
          'Diagnósticos e houver respondentes suficientes por grupo (respeitando a supressão de anonimato).',
      });
    }

    // ── Plano de Ação para Controle dos Riscos Psicossociais, por dimensão ──
    // Preenche automaticamente o plano de ação (biblioteca Mapa HDS) para as
    // dimensões presentes na matriz do CONSOLIDADO; se não houver consolidado,
    // usa a primeira seção (setor) não suprimida com matriz. A matriz já vem
    // ordenada por risco desc — então o plano sai priorizado pela classificação.
    let planMatrix: PsychosocialRiskMatrixRow[] = [];
    if (overall && 'riskMatrix' in overall && overall.riskMatrix.length) {
      planMatrix = overall.riskMatrix;
    } else {
      for (const s of res.sectors) {
        if (s.suppressed || !('riskMatrix' in s) || !s.riskMatrix || !s.riskMatrix.length) continue;
        planMatrix = s.riskMatrix;
        break;
      }
    }
    if (planMatrix.length) {
      // Resolve o MAPA de planos por dimensão: IA da plataforma quando disponível
      // e válida, senão a biblioteca técnica fixa (fallback automático). O layout
      // de saída é IDÊNTICO nos dois casos — muda só a ORIGEM do conteúdo.
      const { plans, origin } = await resolveActionPlans(
        { prisma: this.prisma, aiSettings: this.aiSettings },
        tenantId,
        planMatrix,
        // MESMO instrumento que produziu a matriz (psychosocial.results resolve
        // pelo contrato do tenant). Esta função é chamada tanto por
        // generateDossieTecnico quanto por generateFromTemplate (Motor 4), que
        // não têm um `instrumento` comum já resolvido — resolve aqui mesmo.
        (await this.instrumentoDoTenant(tenantId)).slug,
      );
      const originNote =
        origin === 'IA'
          ? 'Redação apoiada pela IA da plataforma, sobre a biblioteca técnica CRIVO.'
          : 'Conteúdo da biblioteca técnica CRIVO.';
      sections.push({
        heading: 'Tratamento sugerido — proposta técnica, ainda NÃO aprovada',
        body:
          'As medidas abaixo são SUGESTÃO técnica derivada da classificação de risco ' +
          '(R = Probabilidade × Severidade) e não constituem plano aprovado. Elas só passam a ' +
          'valer depois de aceitas, editadas ou substituídas pela organização no Plano de ' +
          'Evolução — o que está aprovado aparece na seção 8. ' +
          `${originNote}`,
      });
      for (const r of planMatrix) {
        // A biblioteca é chaveada pela DIMENSÃO. Com fatores cadastrados a linha
        // traz o slug do fator, então resolvemos pela dimensão de origem — sem
        // isto o Dossiê perderia o Plano de Ação em silêncio.
        const entry = planEntryFor(plans, r);
        if (!entry) continue;
        sections.push({
          heading: `Sugestão — ${r.label} (Classificação: ${PSYCHOSOCIAL_RISK_CLASS_LABEL[r.riskClass]})`,
          body: `${entry.descricao}\n\nObjetivo do plano de ação: ${entry.objetivo}`,
        });
        sections.push({
          heading: 'Ações sugeridas (pendentes de validação)',
          table: {
            columns: ['Ação', 'Prazo', 'Objetivo', 'Etapas', 'Indicadores'],
            data: entry.acoes.map((a) => [a.titulo, a.prazo, a.objetivo, a.etapas, a.indicadores]),
          },
        });
      }
    }
    return { sections, matrix: consolidada.length ? consolidada : planMatrix };
  }

  // ── TPL-002 · Dossiê Técnico (template ÚNICO, 14 seções na ordem oficial) ──
  private async generateDossieTecnico(
    tenantId: string,
    ctx: {
      company: string;
      org: {
        legalName: string | null;
        taxId: string | null;
        establishment?: string | null;
        employeesCount?: string | null;
        workModel?: string | null;
      } | null;
      contract: { technicalOutput?: string | null; responsible?: string | null } | null;
      method: DiagnosticMethodLike;
      plans: {
        title: string;
        validatedAt: Date | null;
        validatedBy: string | null;
        items: (FactorItem & { evidences: { title: string; kind: string; url: string | null; status: string; reviewedAt: Date | null }[] })[];
      }[];
      cnaeDecision: CnaeDecisionRow | null;
    },
  ): Promise<GeneratedDocument> {
    const output = ctx.contract?.technicalOutput ?? 'SEM_INTEGRACAO';
    const instrumento = await this.instrumentoDoTenant(tenantId, ctx.method);
    const psy = await this.psychosocialSummary(tenantId, undefined, instrumento);
    const approvedTexts = await this.approvedTextsOf(tenantId, 'dossie_tecnico');
    const plan = ctx.plans.find((p) => p.validatedAt) ?? ctx.plans[0];
    const items = (plan?.items ?? []) as (FactorItem & {
      evidences: { title: string; kind: string; url: string | null; status: string; reviewedAt: Date | null }[];
    })[];

    // ── Identificação · página 1 do modelo ────────────────────────────────
    // Campos e ordem do modelo oficial. Saíram "Público elegível",
    // "Respostas válidas/adesão" e "Responsável CRIVO": o modelo não os tem, e a
    // instrução de homologação é explícita — nº de respondentes não é nº de
    // expostos, e dado contextual só aparece quando a organização o cadastrou.
    const versaoMetodologica = await this.activeVersionLabel(instrumento.slug);
    const meta: GeneratedDocument['meta'] = [
      { label: 'Organização', value: ctx.org?.legalName ?? ctx.company },
      { label: 'CNPJ', value: ctx.org?.taxId ?? '—' },
      { label: 'Estabelecimento', value: ctx.org?.establishment ?? '—' },
      { label: 'Método aplicado', value: ctx.method ? METHOD_LABEL[ctx.method] ?? ctx.method : '—' },
      { label: 'Período avaliado', value: psy.period },
      { label: 'Data de emissão', value: fmt(new Date()) },
      { label: 'Versão metodológica', value: versaoMetodologica },
      { label: 'Respostas válidas', value: String(psy.totalRespondents) },
    ];

    const sections: DocumentSection[] = [];
    // `psy` é união (suprimido | agregado). Um alias estreitado evita repetir a
    // checagem em cada uso de bands/byDimension/score.
    const agregado = psy.suppressed ? null : psy;

    // Matriz calculada UMA vez: alimenta síntese, inventário e anexo.
    //
    // `psyMatriz.sections` fica de fora DE PROPÓSITO. Ali vivem a leitura da
    // matriz, as tabelas por grupo e o bloco de TRATAMENTO SUGERIDO — proposta
    // que ninguém aprovou. O modelo oficial é a saída limpa do cliente, e a
    // instrução de homologação manda a orientação sobre validação do Plano de
    // Evolução ficar no documento de instrução separado. A sugestão continua
    // viva onde ela decide algo: a tela do Plano de Evolução.
    const psyMatriz = await this.psychosocialMatrixSections(tenantId);
    const matriz = psyMatriz.matrix;
    // ANEXO sai na ordem do catálogo (RPS-001, RPS-002…); a matriz chega
    // ordenada por risco desc, que é a ordem das PRIORIDADES.
    const porCodigo = [...matriz].sort((a, b) =>
      (a.code ?? a.label).localeCompare(b.code ?? b.label, 'pt-BR'),
    );
    const idPorSlug = new Map<string, string>();
    porCodigo.forEach((r, n) =>
      idPorSlug.set(r.slug, r.code ?? `FP-${String(n + 1).padStart(3, '0')}`),
    );
    const idDe = (r: PsychosocialRiskMatrixRow) => idPorSlug.get(r.slug) ?? '—';
    const prioritarios = matriz.filter((r) => r.planRequired);
    const adh = await this.sectorAdhesion(tenantId, instrumento);
    const exibidos = adh.sectors.filter((x) => !x.suppressed);

    // ── Objetivo e escopo ─────────────────────────────────────────────────
    sections.push({
      heading: 'Objetivo e escopo',
      body:
        'Este dossiê consolida os fatores de riscos psicossociais relacionados ao trabalho ' +
        'identificados no ciclo avaliado e organiza informações técnicas para apoiar a gestão ' +
        'preventiva da organização, a Avaliação Ergonômica Preliminar e, quando aplicável, a ' +
        'atualização do Inventário de Riscos e do Plano de Ação do PGR.\n\n' +
        'O escopo é restrito às condições, à organização e à gestão do trabalho. O documento não ' +
        'realiza diagnóstico clínico individual, avaliação psicológica individual nem análise de ' +
        'aspectos pessoais desvinculados do trabalho.' +
        (approvedTexts['finalidade_limites'] ? `\n\n${approvedTexts['finalidade_limites']}` : ''),
    });

    // RESSALVA de rascunho sem ações aprovadas. Não existe no modelo porque o
    // modelo é o estado normal (plano aprovado); aparece só quando a
    // organização ainda não decidiu nada, e sem ela o leitor recebe um
    // documento cuja tabela de plano sai vazia sem explicação.
    if (!items.length) {
      sections.push({
        heading: 'Ressalva — documento ainda sem plano de ação aprovado',
        body:
          'A avaliação técnica dos fatores e a matriz de risco estão completas e valem como ' +
          'leitura. O que falta é a decisão da organização: nenhuma ação foi aprovada no Plano de ' +
          'Evolução, então a tabela do plano sai sem conteúdo. Nada aqui atesta conformidade nem ' +
          'ausência de risco. A emissão oficial ocorre depois que a organização aprovar as ações.',
      });
    }

    sections.push({
      heading: 'Responsabilidades',
      rows: [
        {
          label: 'CRIVO',
          value:
            'Aplica a metodologia configurada, processa os dados conforme a versão registrada e ' +
            'gera este dossiê como instrumento técnico de apoio.',
        },
        {
          label: 'Organização',
          value:
            'Valida as informações de contexto, define e implementa medidas de prevenção, mantém ' +
            'seus documentos de SST atualizados e realiza as integrações documentais aplicáveis.',
        },
      ],
    });

    sections.push({
      heading: 'Escopo da avaliação',
      rows: [
        { label: 'Respostas válidas', value: String(psy.totalRespondents) },
        { label: 'Estrutura considerada', value: 'Empresa e áreas cadastradas no ciclo' },
        // Só os recortes EXIBIDOS são nomeados: nomear o omitido devolveria, por
        // via indireta, a informação que a supressão existe para proteger.
        { label: 'Recortes exibidos', value: exibidos.map((x) => x.sector).join(', ') || '—' },
        {
          label: 'Confidencialidade',
          value:
            `Recortes estatísticos somente quando atingido o mínimo de ${psy.minRespondents} ` +
            'respostas válidas. Respostas individuais e recortes abaixo do mínimo não são exibidos.',
        },
        // Adesão só quando a empresa informou o público elegível — dado
        // contextual, nunca inferido do número de respondentes.
        ...(ctx.org?.employeesCount
          ? [
              {
                label: 'Adesão',
                value: adhesionLabel(psy.totalRespondents, ctx.org.employeesCount),
              },
            ]
          : []),
      ],
    });

    // ── Metodologia e critérios · página 2 do modelo ──────────────────────
    const reguaDoScore = [...(agregado?.bands ?? [])]
      .sort((a, b) => a.min - b.min)
      .map((x) => x.label)
      .join(' · ');
    const CLASSES: PsychosocialRiskClass[] = ['BAIXO', 'MODERADO', 'ALTO', 'MUITO_ALTO', 'CRITICO'];
    sections.push({
      heading: 'Metodologia e critérios',
      body:
        'O diagnóstico utiliza as informações coletadas no ciclo conforme o método aplicado. O ' +
        'score do instrumento é uma leitura agregada e não corresponde, por si só, ao nível ' +
        'técnico de risco. A avaliação técnica é realizada por Risco/Fator Psicossocial vinculado ' +
        'às perguntas do instrumento.',
      table: {
        columns: ['Camada', 'Finalidade', 'Classificação'],
        data: [
          ['Score executivo', 'Contextualizar o diagnóstico', reguaDoScore || '—'],
          [
            'Risco técnico',
            'Priorizar a prevenção',
            CLASSES.map((c) => PSYCHOSOCIAL_RISK_CLASS_LABEL[c]).join(' · '),
          ],
        ],
      },
    });

    if (matriz.length) {
      sections.push({ heading: 'Matriz de risco 5 × 5', html: grade5x5Html(matriz) });
    }

    sections.push({
      heading: 'Probabilidade, severidade e risco',
      rows: [
        {
          label: 'Probabilidade (1–5)',
          value:
            'Calculada a partir das exposições das respostas válidas vinculadas ao mesmo fator. ' +
            'Exposição = 6 − resposta. Faixas: 1,00–1,49 = 1; 1,50–2,49 = 2; 2,50–3,49 = 3; ' +
            '3,50–4,49 = 4; 4,50–5,00 = 5. Quando mais de 60% das respostas válidas do fator ' +
            'estiverem em exposição alta (respostas 1 ou 2), a probabilidade é 5.',
        },
        {
          label: 'Severidade (1–5)',
          value:
            'É a severidade-base cadastrada para o Risco/Fator Psicossocial. Não é calculada pela ' +
            'dimensão e não é digitada livremente na pergunta.',
        },
        {
          label: 'Risco = P × S',
          value:
            '1–4 Baixo / Tolerável · 5–9 Moderado / Atenção pontual · 10–15 Alto / Requer plano ' +
            'de ação · 16–20 Muito alto / Prioridade imediata · 21–25 Crítico / Intolerável.',
        },
      ],
    });

    sections.push({
      heading: 'Critérios expressos',
      table: {
        columns: ['N', 'Probabilidade', 'Critério', 'Severidade', 'Critério'],
        data: [1, 2, 3, 4, 5].map((n) => [
          String(n),
          PSYCHOSOCIAL_PROBABILITY_SHORT[n],
          PSYCHOSOCIAL_PROBABILITY_CRITERION[n],
          PSYCHOSOCIAL_SEVERITY_SHORT[n],
          `Severidade-base ${n}.`,
        ]),
      },
    });

    // ── Síntese do ciclo · página 3 do modelo ─────────────────────────────
    //
    // DETERMINÍSTICA por decisão: a homologação compara o conteúdo técnico do
    // Dossiê com o gabarito, e prosa reescrita a cada emissão nunca fecharia. O
    // texto APROVADO pela equipe CRIVO (fluxo F3, rascunhado pela IA) vence
    // quando existe — é ali que a redação da IA entra neste documento.
    const nomesPrioritarios = prioritarios.map((r) => r.label);
    const sinteseAutomatica = !agregado
      ? `O ciclo registrou ${psy.totalRespondents} resposta(s) válida(s), abaixo do mínimo de ` +
        `${psy.minRespondents} exigido para exibição estatística. Os resultados agregados ficam ` +
        'omitidos por confidencialidade.'
      : `O ciclo apresenta score executivo geral de ${numeroPtBr(agregado.score)} (${agregado.levelLabel}). ` +
        (nomesPrioritarios.length
          ? `A priorização técnica identifica ${nomesPrioritarios.join(', ')} como ` +
            `${nomesPrioritarios.length === 1 ? 'fator que requer' : 'fatores que requerem'} ` +
            'plano de ação pela metodologia CRIVO. '
          : 'A priorização técnica não identificou fatores que requeiram plano de ação pela ' +
            'metodologia CRIVO. ') +
        'O score executivo e a classificação técnica de risco são leituras distintas.';
    sections.push({
      heading: 'Síntese executiva',
      body: approvedTexts['sintese_ciclo'] || sinteseAutomatica,
    });

    if (agregado && agregado.byDimension.length) {
      // Cor CADASTRADA na faixa vence; a rampa é o fallback de quem não
      // configurou cor no Motor de Diagnósticos.
      const RAMPA = ['#8E2F1B', '#C4671D', '#8A6D1F', '#2E7D4F'];
      const faixasOrdenadas = [...agregado.bands].sort((a, b) => a.min - b.min);
      const corDaFaixa = (v: number): string | null => {
        const i = faixasOrdenadas.findIndex((x) => v >= x.min && v <= x.max);
        if (i < 0) return null;
        const propria = faixasOrdenadas[i].color?.trim();
        if (propria) return propria;
        if (faixasOrdenadas.length < 2) return null;
        const passo = (RAMPA.length - 1) / (faixasOrdenadas.length - 1);
        return RAMPA[Math.min(RAMPA.length - 1, Math.round(i * passo))] ?? null;
      };
      sections.push({
        heading: 'Resultados por dimensão',
        html: barrasDimensoesHtml(
          agregado.byDimension.map((d) => ({
            label: d.label,
            value: d.value,
            faixa: findBandForScore(agregado.bands, d.value)?.label ?? '—',
            cor: corDaFaixa(d.value),
          })),
          { cabecalho: true, rotuloEscala: 'Leitura gráfica' },
        ),
      });
    }

    if (prioritarios.length) {
      sections.push({
        heading: 'Prioridades técnicas',
        table: {
          columns: ['Fator', 'P', 'S', 'R', 'Classificação'],
          data: prioritarios.map((r) => [
            r.label,
            String(r.probability),
            String(r.severity),
            String(r.risk),
            PSYCHOSOCIAL_RISK_CLASS_LABEL[r.riskClass],
          ]),
        },
      });
    }

    sections.push({
      heading: 'Participação e recortes',
      table: {
        columns: ['Recorte', 'Situação'],
        data: exibidos.length
          ? exibidos.map((x) => [x.sector, 'Exibido'])
          : [['Consolidado da organização', 'Exibido']],
      },
    });

    // ── Inventário técnico · página 4 do modelo ───────────────────────────
    if (prioritarios.length) {
      sections.push({
        heading: 'Caracterização dos fatores prioritários',
        table: {
          columns: ['ID', 'Dimensão relacionada', 'Fator', 'Caracterização da exposição'],
          data: prioritarios.map((r) => {
            const media = `Exposição média ${r.exposureAvg.toFixed(2)}`;
            const pct = r.exposureCount
              ? `; ${((r.highExposureCount / r.exposureCount) * 100).toFixed(1)}% das respostas ` +
                'válidas do fator em exposição alta (respostas 1 ou 2).'
              : '.';
            return [idDe(r), r.dimensionLabel ?? '—', r.label, `${media}${pct}`];
          }),
        },
      });
      sections.push({
        heading: 'Possíveis agravos / consequências',
        table: {
          columns: ['ID', 'Possíveis agravos / consequências', 'P', 'S', 'R', 'Classificação'],
          data: prioritarios.map((r) => [
            idDe(r),
            r.consequences ?? '—',
            String(r.probability),
            String(r.severity),
            String(r.risk),
            PSYCHOSOCIAL_RISK_CLASS_LABEL[r.riskClass],
          ]),
        },
      });
      // Sem título: no modelo é a nota de rodapé da página, não uma seção.
      sections.push({
        heading: '',
        body:
          'As possíveis lesões ou agravos à saúde indicados neste dossiê têm caráter preventivo e ' +
          'documental, com base nos fatores de risco psicossociais relacionados ao trabalho. Não ' +
          'constituem diagnóstico clínico, médico ou psicológico individual.',
      });
    }

    // ── Plano, registros e responsabilidade · página 5 do modelo ──────────
    const aprovadas = items.filter(
      (i) =>
        i.status === 'APROVADA' ||
        i.status === 'EM_ANDAMENTO' ||
        i.status === 'CONCLUIDA' ||
        i.status === 'REAVALIADA',
    );
    const aguardando = items.filter((i) => i.status === 'SUGERIDA' || i.status === 'EM_REVISAO').length;
    sections.push({
      heading: 'Plano de ação',
      body:
        'As medidas abaixo correspondem às ações aprovadas pela organização e vinculadas aos ' +
        'fatores prioritários deste ciclo.' +
        (aguardando
          ? ` ${aguardando} ação(ões) permanece(m) como sugestão pendente de validação e não ` +
            'compõe(m) este documento.'
          : ''),
      table: {
        columns: ['Fator', 'Medida definida', 'Objetivo', 'Responsável', 'Prazo', 'Acompanhamento'],
        data: aprovadas.length
          ? aprovadas.map((i) => [
              i.point,
              i.action,
              i.objective ?? '—',
              i.responsible ?? '—',
              i.dueDate ? fmt(i.dueDate) : '—',
              i.indicator ?? '—',
            ])
          : [['—', '—', '—', '—', '—', '—']],
      },
    });

    // Registros que a ORGANIZAÇÃO cadastrou. Não estão no modelo porque a massa
    // de homologação não os tem — mas quem preencheu não pode perdê-los.
    const comMedida = items.filter((i) => i.existingMeasure?.trim());
    if (comMedida.length) {
      sections.push({
        heading: 'Medidas existentes',
        body: 'Medidas informadas pela própria organização para os fatores identificados.',
        table: {
          columns: ['Fator', 'Medida existente'],
          data: comMedida.map((i) => [i.point, i.existingMeasure ?? '—']),
        },
      });
    }

    const evidenciasAprovadas = items
      .flatMap((i) => i.evidences)
      .filter((e) => e.status === 'APROVADA');
    if (evidenciasAprovadas.length) {
      sections.push({
        heading: 'Evidências',
        body: 'Somente evidência aprovada compõe a documentação técnica.',
        table: {
          columns: ['Evidência', 'Tipo', 'Vínculo/Referência', 'Validada em'],
          data: evidenciasAprovadas.map((e) => [
            e.title,
            e.kind,
            e.url ?? '—',
            e.reviewedAt ? fmt(e.reviewedAt) : '—',
          ]),
        },
      });
    }

    const devolutivas = await this.prisma.forTenant(tenantId, (tx) =>
      tx.devolutivaRecord.findMany({ orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 10 }),
    );
    if (devolutivas.length) {
      sections.push({
        heading: 'Registro de comunicação e devolutiva',
        body:
          'Comunicações dos resultados e medidas aos trabalhadores, registradas pela organização.',
        table: {
          columns: ['Data', 'Formato', 'Público envolvido', 'Temas comunicados', 'Medidas comunicadas'],
          data: devolutivas.map((r) => [
            fmt(r.date),
            r.format,
            r.audience ?? '—',
            r.topics ?? '—',
            r.communicatedMeasures ?? '—',
          ]),
        },
      });
    }

    // Integração documental só faz sentido quando o contrato prevê integração.
    if (output === 'AEP' || output === 'AEP_PGR') {
      sections.push({
        heading: 'Indicação de integração documental',
        table: {
          columns: ['Elemento do dossiê', 'Destino recomendado'],
          data: [
            ['Matriz de fatores', 'Registro da AEP e base para inventário de riscos ocupacionais.'],
            ['Anexo técnico', 'Inventário de riscos ocupacionais, após validação da organização/responsável.'],
            ['Plano de ação aprovado', 'Plano de ação do PGR/GRO ou plano preventivo vinculado à AEP.'],
            ['Evidências', 'Registros de implementação e acompanhamento.'],
          ],
        },
      });
    }

    // Controle documental — as duas últimas linhas são do modelo e sobrevivem à
    // emissão oficial (emit() só carimba o que é dele).
    sections.push(
      docControlSection([
        { label: 'Método', value: versaoMetodologica },
        { label: 'Organização', value: ctx.org?.legalName ?? ctx.company },
      ]),
    );

    // A CONCLUSÃO TÉCNICA aprovada pela equipe CRIVO, quando existir, entra
    // antes das referências. A frase de responsabilidade sai no rodapé do
    // documento (`responsibilityNote`), como no modelo.
    if (approvedTexts['conclusao_tecnica']) {
      sections.push({ heading: 'Conclusão técnica', body: approvedTexts['conclusao_tecnica'] });
    }
    sections.push({
      heading: 'Referências',
      body:
        'NR-1 — Disposições Gerais e Gerenciamento de Riscos Ocupacionais; NR-17 — Ergonomia; ' +
        'Guia de Informações sobre os Fatores de Riscos Psicossociais Relacionados ao Trabalho — ' +
        'Ministério do Trabalho e Emprego.',
    });

    // ── Anexo técnico · última página do modelo ───────────────────────────
    if (porCodigo.length) {
      sections.push({
        heading: 'Anexo técnico — fatores classificados',
        body: 'Resultado consolidado do ciclo.',
        table: {
          columns: ['ID', 'Fator', 'Dimensão relacionada', 'Exposição', 'P', 'S', 'R', 'Classificação'],
          data: porCodigo.map((r) => [
            idDe(r),
            r.label,
            r.dimensionLabel ?? '—',
            r.exposureAvg.toFixed(2),
            String(r.probability),
            String(r.severity),
            String(r.risk),
            PSYCHOSOCIAL_RISK_CLASS_LABEL[r.riskClass],
          ]),
        },
      });
      // Colunas de inventário (definição, fonte/circunstância, agravos) só
      // quando o contrato integra o GRO/PGR — é ali que elas são exigidas.
      if (output === 'AEP_PGR') {
        sections.push({
          heading: 'Anexo técnico para integração ao inventário',
          body:
            'Relação dos fatores psicossociais para integração ao inventário de riscos do GRO/PGR ' +
            'pelo responsável técnico, após validação da organização.',
          table: {
            columns: ['ID risco', 'Processo/Dimensão', 'Fator psicossocial', 'Definição', 'Fonte/Circunstância', 'Possíveis agravos', 'Risco (P × S)', 'Classificação'],
            data: porCodigo.map((r) => [
              idDe(r),
              r.dimensionLabel ?? '—',
              r.label,
              r.definition ?? '—',
              r.sourceContext ?? '—',
              r.consequences ?? '—',
              `${r.probability} × ${r.severity} = ${r.risk}`,
              PSYCHOSOCIAL_RISK_CLASS_LABEL[r.riskClass],
            ]),
          },
        });
      }
    }

    return {
      type: 'dossie_tecnico',
      title: DOCUMENT_TYPE_LABEL['dossie_tecnico'],
      // O código do template é controle interno da CRIVO; não é informação do
      // documento que a empresa recebe e integra ao GRO/PGR.
      subtitle: 'Documento técnico de apoio · NR-1 / GRO / PGR',
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  // ── TPL-003 · Relatório de Evolução e Efetividade (layout oficial) ─────────
  /**
   * Compara os DOIS últimos ciclos formais ENCERRADOS, fator a fator, usando os
   * snapshots congelados no encerramento. Colunas derivadas (RESULTADO,
   * AVALIAÇÃO) vêm exclusivamente da matriz de risco e do status REGISTRADOS —
   * a leitura final é da empresa/responsável técnico (nota no §4).
   */
  private async generateRelatorioEvolucao(
    tenantId: string,
    ctx: {
      company: string;
      org: { legalName: string | null; taxId: string | null } | null;
      contract: { responsible?: string | null } | null;
      method: DiagnosticMethodLike;
    },
  ): Promise<GeneratedDocument> {
    const comparable = await this.comparableCycles(tenantId);
    if (!comparable.ok) throw new BadRequestException(comparable.reason);
    const { previous, current } = comparable;
    const approvedTexts = await this.approvedTextsOf(tenantId, 'relatorio_evolucao');

    type SnapFactor = {
      point: string; action: string; risk: string; riskDerived: boolean; status: string;
      areaProcess: string | null; indicator: string | null;
      evidences: { title: string; status: string }[];
    };
    const factorsOf = (c: typeof current): SnapFactor[] =>
      ((c.snapshot as { factors?: SnapFactor[] } | null)?.factors ?? []);
    const prevFactors = factorsOf(previous);
    const curFactors = factorsOf(current);
    const norm = (s: string) => s.trim().toLowerCase();
    const prevByPoint = new Map(prevFactors.map((f) => [norm(f.point), f]));
    const curPoints = new Set(curFactors.map((f) => norm(f.point)));

    const cycleRange = (c: typeof current) =>
      `${fmt(c.openedAt)} a ${c.closedAt ? fmt(c.closedAt) : '—'}`;
    const methodLabel = (m: string | null) => (m ? METHOD_LABEL[m] ?? m : null);
    const vPrev = previous.methodologyVersion ?? '—';
    const vCur = current.methodologyVersion ?? '—';
    // '—' não é versão comparável: sem registro em um dos ciclos, a
    // compatibilidade é DESCONHECIDA (nunca afirmada como "mesma versão").
    const compat =
      vPrev === '—' || vCur === '—'
        ? 'Versão metodológica não registrada em um dos ciclos — comparação com ressalva'
        : vPrev === vCur
          ? `Mesma versão metodológica (${vCur})`
          : `Versões metodológicas diferentes (${vPrev} → ${vCur}) — comparação com ressalva`;

    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: ctx.org?.legalName ?? ctx.company },
      { label: 'CNPJ', value: ctx.org?.taxId ?? '—' },
      { label: 'Ciclo anterior', value: `${previous.label} (${cycleRange(previous)})` },
      { label: 'Ciclo atual', value: `${current.label} (${cycleRange(current)})` },
      {
        label: 'Método',
        value: methodLabel(current.method) ?? (ctx.method ? METHOD_LABEL[ctx.method] ?? ctx.method : '—'),
      },
      { label: 'Compatibilidade metodológica', value: compat },
      { label: 'Responsável CRIVO', value: ctx.contract?.responsible ?? '—' },
    ];

    const sections: DocumentSection[] = [];

    // 1. FINALIDADE — texto do template oficial.
    sections.push({
      heading: '1. Finalidade',
      body:
        'Comparar a evolução dos fatores de riscos psicossociais, o status das ações, as evidências ' +
        'e a efetividade das medidas entre ciclos formais de diagnóstico.',
    });

    // 2. SÍNTESE DA EVOLUÇÃO.
    //
    // A emissão oficial não espera mais aprovação da equipe CRIVO, então este
    // bloco não pode sair com "pendente de aprovação" congelado num documento
    // entregue. A síntese automática abaixo é factual: conta o que a própria
    // comparação mostra. O texto aprovado no Super Admin, quando existir,
    // continua vencendo.
    const evolucao = curFactors.reduce(
      (acc, f) => {
        const antes = prevByPoint.get(norm(f.point));
        const r = evolutionResult(antes?.risk ?? null, f.risk);
        if (r === 'Risco reduzido') acc.reduzidos += 1;
        else if (r === 'Risco agravado') acc.agravados += 1;
        else if (r === 'Novo neste ciclo') acc.novos += 1;
        else if (r === 'Estável') acc.estaveis += 1;
        return acc;
      },
      { reduzidos: 0, agravados: 0, novos: 0, estaveis: 0 },
    );
    const sinteseAutomatica =
      `Comparação entre ${previous.label} e ${current.label}: ${curFactors.length} fator(es) no ` +
      `ciclo atual e ${prevFactors.length} no anterior. ${evolucao.reduzidos} com risco reduzido, ` +
      `${evolucao.estaveis} estável(is), ${evolucao.agravados} agravado(s) e ${evolucao.novos} ` +
      `novo(s) neste ciclo. ${compat}. A leitura de causas e a decisão sobre as próximas medidas ` +
      'são da organização.';
    sections.push({
      heading: '2. Síntese da evolução',
      body: approvedTexts['sintese_evolucao'] ?? sinteseAutomatica,
    });

    // 3. COMPARATIVO DOS FATORES — união dos fatores dos dois snapshots.
    const evidCell = (f: SnapFactor) => {
      const ok = f.evidences.filter((e) => e.status === 'APROVADA').length;
      return ok > 0 ? `${ok} aprovada(s)` : '—';
    };
    const compRows: string[][] = curFactors.map((f) => {
      const before = prevByPoint.get(norm(f.point));
      return [
        f.point,
        before ? before.risk : '— (novo)',
        f.risk,
        f.action,
        evidCell(f),
        evolutionResult(before?.risk ?? null, f.risk),
      ];
    });
    for (const f of prevFactors) {
      if (curPoints.has(norm(f.point))) continue;
      compRows.push([f.point, f.risk, '— (fora do plano)', f.action, evidCell(f), evolutionResult(f.risk, null)]);
    }
    sections.push({
      heading: '3. Comparativo dos fatores',
      body:
        'Risco anterior e atual congelados no encerramento de cada ciclo (matriz Severidade × ' +
        'Probabilidade). O resultado é derivado da variação do risco registrado.',
      table: {
        columns: ['Fator', 'Risco anterior', 'Risco atual', 'Ação', 'Evidência', 'Resultado'],
        data: compRows,
      },
    });

    // 4. EFETIVIDADE DAS AÇÕES — derivação mecânica de risco/status registrados.
    const NEXT_DECISION: Record<string, string> = {
      CONCLUIDA: 'Manter e monitorar',
      EM_ANDAMENTO: 'Continuar execução',
      APROVADA: 'Executar conforme plano',
      REAVALIADA: 'Reavaliar no próximo ciclo',
      SUGERIDA: 'Aprovar/revisar a ação',
      EM_REVISAO: 'Aprovar/revisar a ação',
    };
    sections.push({
      heading: '4. Efetividade das ações',
      body:
        'Avaliação DERIVADA da variação do risco e do status registrados — não substitui a leitura ' +
        'da empresa e/ou do responsável técnico, que valida este documento na conclusão.',
      table: {
        columns: ['Ação', 'Status', 'Avaliação de efetividade', 'Próxima decisão'],
        data: curFactors.map((f) => {
          const before = prevByPoint.get(norm(f.point));
          const res = before ? evolutionResult(before.risk, f.risk) : null;
          // Cada resultado tem leitura EXPLÍCITA — "Comparação indisponível"
          // nunca vira "estável" (seria conclusão fabricada em doc oficial).
          const aval = !before
            ? 'Fator novo neste ciclo — sem base de comparação'
            : res === 'Risco reduzido'
              ? `Risco reduzido (${before.risk} → ${f.risk})`
              : res === 'Risco agravado'
                ? `Risco agravado (${before.risk} → ${f.risk})`
                : res === 'Estável'
                  ? `Risco estável (${f.risk})`
                  : 'Comparação indisponível — risco não classificado em um dos ciclos';
          return [f.action, ACTION_LABEL[f.status] ?? f.status, aval, NEXT_DECISION[f.status] ?? '—'];
        }),
      },
    });

    // 5. FATORES PERSISTENTES E NOVAS AÇÕES — presentes nos DOIS ciclos sem redução.
    const persistent = curFactors.filter((f) => {
      const before = prevByPoint.get(norm(f.point));
      if (!before) return false;
      const a = riskRank(before.risk);
      const b = riskRank(f.risk);
      return a != null && b != null && b >= a;
    });
    // Fatores comuns cuja comparação de risco é INDISPONÍVEL não podem ser
    // afirmados nem como persistentes nem como reduzidos — contados à parte.
    const unavailableCount = curFactors.filter((f) => {
      const before = prevByPoint.get(norm(f.point));
      if (!before) return false;
      return riskRank(before.risk) == null || riskRank(f.risk) == null;
    }).length;
    sections.push({
      heading: '5. Fatores persistentes e novas ações',
      body: persistent.length
        ? 'Fatores presentes nos dois ciclos sem redução de risco. A justificativa é registro da empresa.' +
          (unavailableCount ? ` ${unavailableCount} fator(es) comum(ns) com comparação indisponível não entram nesta leitura.` : '')
        : unavailableCount
          ? `Nenhum fator persistente CLASSIFICÁVEL entre os ciclos — ${unavailableCount} fator(es) comum(ns) com comparação de risco indisponível (risco não classificado em um dos ciclos).`
          : 'Nenhum fator persistente entre os ciclos comparados — todos os fatores comuns tiveram redução de risco ou saíram do plano.',
      table: persistent.length
        ? {
            columns: ['Fator', 'Justificativa', 'Nova decisão/ação'],
            data: persistent.map((f) => [f.point, '— (registro da empresa)', f.action]),
          }
        : undefined,
    });

    // 6. EVIDÊNCIAS DO CICLO — só evidência APROVADA (regra do pacote v3.1).
    const evidRows: string[][] = [];
    for (const f of curFactors) {
      for (const e of f.evidences) {
        if (e.status !== 'APROVADA') continue;
        evidRows.push([`EV-${String(evidRows.length + 1).padStart(3, '0')}`, e.title, f.point, 'Aprovada']);
      }
    }
    sections.push({
      heading: '6. Evidências do ciclo',
      body: evidRows.length
        ? 'Somente evidência aprovada compõe a documentação técnica.'
        : 'Nenhuma evidência aprovada registrada no ciclo atual.',
      table: evidRows.length
        ? { columns: ['ID', 'Evidência', 'Vínculo', 'Status'], data: evidRows }
        : undefined,
    });

    // 7. CONCLUSÃO E VALIDAÇÃO — conclusão aprovada (F3) + assinatura fora do sistema.
    sections.push(
      signatureSection(
        (approvedTexts['conclusao_evolucao'] ? `${approvedTexts['conclusao_evolucao']}\n\n` : '') +
          'A revisão, validação, assinatura e integração formal deste documento às obrigações ' +
          'aplicáveis são de responsabilidade da empresa contratante e/ou do responsável ' +
          'técnico/designado. A empresa baixa o documento, assina fora do sistema e o integra à ' +
          'sua documentação.',
      ),
    );

    // 8. CONTROLE DOCUMENTAL.
    sections.push(docControlSection());

    return {
      type: 'relatorio_evolucao',
      title: DOCUMENT_TYPE_LABEL['relatorio_evolucao'],
      subtitle: 'Template final · TPL-003 · Documento técnico controlado',
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  // ── TPL-004 · Extrato do Plano de Ação Preventivo (layout oficial) ─────────
  private async generateExtratoPlano(
    tenantId: string,
    ctx: {
      company: string;
      org: { taxId: string | null } | null;
      plans: {
        title: string;
        source: string | null;
        validatedAt: Date | null;
        validatedBy: string | null;
        updatedAt: Date;
        items: (FactorItem & { id: string })[];
      }[];
    },
  ): Promise<GeneratedDocument> {
    const plan = ctx.plans.find((p) => p.validatedAt) ?? ctx.plans[0];
    const items = plan?.items ?? [];

    // F2 — última alteração registrada de cada ação (action_item_history).
    const historyRows: string[][] = [];
    if (items.length) {
      const ids = items.map((i) => i.id);
      const hist = await this.prisma.forTenant(tenantId, (tx) =>
        tx.actionItemHistory.findMany({
          where: { actionItemId: { in: ids } },
          // Tiebreak por id: duas linhas no mesmo milissegundo não podem tornar
          // a "última alteração" (e o hash da emissão) não determinísticos.
          orderBy: [{ at: 'desc' }, { id: 'desc' }],
        }),
      );
      const lastByItem = new Map<string, (typeof hist)[number]>();
      for (const h of hist) if (!lastByItem.has(h.actionItemId)) lastByItem.set(h.actionItemId, h);
      for (const i of items) {
        const h = lastByItem.get(i.id);
        if (!h) continue;
        historyRows.push([
          i.action,
          h.change,
          h.changedBy ?? '—',
          plan?.validatedBy ?? '—',
          fmt(h.at),
        ]);
      }
    }

    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: ctx.company },
      { label: 'Origem', value: plan?.source ?? '—' },
      { label: 'Ciclo', value: '—' },
      // Data derivada do DADO (última alteração do plano), não do relógio —
      // usar new Date() aqui mudava o hash todo dia e quebrava a idempotência.
      { label: 'Data de referência', value: plan?.updatedAt ? fmt(plan.updatedAt) : '—' },
      { label: 'Status do plano', value: plan?.validatedAt ? 'Validado' : 'Minuta' },
    ];

    const sections: DocumentSection[] = [
      {
        heading: 'Documento operacional controlado',
        body:
          'Este documento é uma exportação do Plano de Evolução. Não existe cadastro paralelo de ' +
          'ações no Motor de Relatórios.',
      },
      {
        heading: '1. Ações aprovadas',
        table: {
          columns: ['ID', 'Fator/Risco', 'Ação aprovada', 'Responsável', 'Prazo', 'Indicador', 'Evidência esperada', 'Status'],
          data: items.length
            ? items.map((i, n) => [
                `A-${String(n + 1).padStart(3, '0')}`,
                `${i.point} (${factorRisk(i).label})`,
                i.action,
                i.responsible ?? '—',
                i.dueDate ? fmt(i.dueDate) : '—',
                i.indicator ?? '—',
                i.expectedEvidence ?? '—',
                ACTION_LABEL[i.status] ?? i.status,
              ])
            : [['—', '—', '—', '—', '—', '—', '—', '—']],
        },
      },
      {
        heading: '2. Histórico e validação',
        body:
          'Última alteração registrada por ação (trilha do Plano de Evolução). A validação do ' +
          'plano é registrada no nível do documento.',
        table: {
          columns: ['Ação', 'Última alteração', 'Alterado por', 'Validado por', 'Data'],
          data: historyRows.length
            ? historyRows
            : [
                [
                  plan ? `Plano "${plan.title}" (todas as ações)` : '—',
                  '—',
                  '—',
                  plan?.validatedBy ?? '—',
                  plan?.validatedAt ? fmt(plan.validatedAt) : '—',
                ],
              ],
        },
      },
      docControlSection(),
    ];

    return {
      type: 'plano_acao',
      title: DOCUMENT_TYPE_LABEL['plano_acao'],
      subtitle: 'Exportação opcional do Plano de Evolução · TPL-004',
      company: ctx.company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  /** Monta o conteúdo estruturado do documento a partir dos dados reais. */
  async generate(
    tenantId: string,
    type: string,
    ctxIn?: Awaited<ReturnType<DocumentsService['context']>>,
  ): Promise<GeneratedDocument> {
    // emit() passa o contexto que ele já leu — a emissão oficial congela UM
    // retrato do banco do começo ao fim (gate, conteúdo e hash).
    const ctx = ctxIn ?? (await this.context(tenantId));
    const { contract, method, org, company, plans, cnaeDecision } = ctx;
    const isTemplate = type.startsWith('tpl:');
    if (!isTemplate && !DOCUMENT_TYPE_LABEL[type]) {
      throw new BadRequestException('Tipo de documento inválido');
    }

    // GATE server-side: repetir a elegibilidade de available(). Sem isto, bastava
    // chamar generate() com um tipo válido para emitir documento que o contrato
    // não libera (ou sem plano validado) — brecha de autorização de saída.
    // Mesmo retrato do banco que monta o conteúdo abaixo: portão e documento
    // não podem discordar sobre qual plano está valendo.
    const eligible = await this.available(tenantId, ctx);
    const desc = eligible.find((d) => d.type === type);
    if (!desc || !desc.available) {
      throw new BadRequestException(
        desc?.reason ?? 'Este documento não está liberado para o contrato desta empresa.',
      );
    }

    // Relatório cadastrado no Motor 4 e vinculado a um diagnóstico do motor.
    if (isTemplate) {
      return this.generateFromTemplate(tenantId, type.slice(4), {
        company,
        org,
        contract,
        method,
        plans,
      });
    }

    const output = contract?.technicalOutput ?? 'SEM_INTEGRACAO';

    // A saída técnica NÃO barra mais o Dossiê (decisão do cliente 01/09): o que
    // o licencia é o diagnóstico realizado — a MESMA regra do available(), que
    // já liberava o cartão "independente da saída técnica" enquanto este gate
    // estourava 400 no clique. O documento declara só o que o contrato sustenta
    // (dossierScopeSection); a emissão OFICIAL segue com as exigências do emit().

    // ── Templates-base do Pacote Final: builders no layout oficial ───────────
    if (type === 'relatorio_executivo') {
      return this.generateMapaExecutivo(tenantId, { company, org, cnaeDecision });
    }
    if (type === 'plano_acao') {
      return this.generateExtratoPlano(tenantId, { company, org, plans });
    }
    if (type === 'dossie_tecnico') {
      return this.generateDossieTecnico(tenantId, { company, org, contract, method, plans, cnaeDecision });
    }
    if (type === 'relatorio_evolucao') {
      return this.generateRelatorioEvolucao(tenantId, { company, org, contract, method });
    }

    const meta: GeneratedDocument['meta'] = [
      { label: 'Empresa', value: company },
      { label: 'Método', value: method ? METHOD_LABEL[method] : '—' },
      { label: 'Saída técnica', value: OUTPUT_LABEL[output] ?? output },
      { label: 'Responsável CRIVO', value: contract?.responsible ?? '—' },
    ];

    const sections: DocumentSection[] = [];

    // Plano de ação (tabela) — núcleo dos dossiês.
    const validatedPlan = plans.find((p) => p.validatedAt) ?? plans[0];

    // Matriz de fatores de risco psicossociais (doc 09 §6 / doc 10). O risco é
    // DERIVADO de Severidade x Probabilidade — separado do índice do
    // questionário, que orienta achados mas não classifica o dossiê.
    if (validatedPlan && validatedPlan.items.length) {
      const its = validatedPlan.items as FactorItem[];
      sections.push({
        heading: 'Matriz de fatores de risco psicossociais',
        table: {
          columns: ['ID', 'Fator', 'Fonte/circunstância', 'Grupo exposto', 'Sev.', 'Prob.', 'Risco', 'Ação'],
          data: its.map((i, n) => [
            `FP-${String(n + 1).padStart(3, '0')}`,
            i.point,
            i.origin ?? '—',
            i.exposedGroup ?? '—',
            asRisk3(i.severity) ?? '—',
            asRisk3(i.probability) ?? '—',
            factorRisk(i).label,
            i.action,
          ]),
        },
      });
      const semMatriz = its.filter((i) => !factorRisk(i).derived).length;
      if (semMatriz > 0) {
        sections.push({
          heading: 'Nota sobre a classificação de risco',
          body:
            `${semMatriz} fator(es) ainda usam a classificação manual anterior. A classificação ` +
            'técnica oficial do dossiê vem da matriz Severidade × Probabilidade (Baixo/Moderado/Alto); ' +
            'informe os dois eixos para que o risco seja derivado automaticamente.',
        });
      }
    }

    if (validatedPlan) {
      sections.push({
        heading: `Plano de ação${validatedPlan.validatedAt ? ' (validado)' : ' (minuta)'}`,
        body: validatedPlan.validatedAt
          ? `Validado por ${validatedPlan.validatedBy ?? '—'} em ${fmt(validatedPlan.validatedAt)}.`
          : 'Plano ainda não validado pela empresa/responsável.',
        table: {
          columns: ['Ponto', 'Ação', 'Responsável', 'Prazo', 'Status', 'Evidência esperada'],
          data: validatedPlan.items.map((i) => [
            i.point,
            i.action,
            i.responsible ?? '—',
            i.dueDate ? fmt(i.dueDate) : '—',
            ACTION_LABEL[i.status] ?? i.status,
            i.expectedEvidence ?? '—',
          ]),
        },
      });

      // REGRA DO PACOTE v3.1: só evidência APROVADA alimenta dossiê/relatório.
      // Antes entravam também REJEITADA/SUBSTITUIDA/pendente — o documento saía
      // apoiado em prova recusada (exposição em AEP/GRO/PGR).
      const allEvid = validatedPlan.items.flatMap((i) => i.evidences);
      const approved = allEvid.filter((e) => e.status === 'APROVADA');
      const excluded = allEvid.length - approved.length;
      if (approved.length) {
        sections.push({
          heading: 'Evidências validadas',
          table: {
            columns: ['Evidência', 'Tipo', 'Link/Referência', 'Validada em'],
            data: approved.map((e) => [
              e.title,
              e.kind,
              e.url ?? '—',
              e.reviewedAt ? fmt(e.reviewedAt) : '—',
            ]),
          },
        });
      }
      if (excluded > 0) {
        sections.push({
          heading: 'Evidências não incluídas',
          body:
            `${excluded} evidência(s) enviada(s) não entram neste documento por não estarem ` +
            'validadas (pendentes, rejeitadas ou substituídas). Somente evidência aprovada ' +
            'compõe a documentação técnica.',
        });
      }
    } else {
      sections.push({ heading: 'Plano de ação', body: 'Nenhum plano de ação registrado.' });
    }

    // Seções específicas por tipo.
    if (type === 'inventario_pgr') {
      const invItems = validatedPlan?.items ?? [];
      sections.unshift({
        heading: 'Inventário de fatores psicossociais (apoio ao PGR)',
        body:
          'Relação dos fatores psicossociais identificados, com fonte/origem, grupos expostos, ' +
          'medida de controle e classificação de risco — para integração ao GRO/PGR pelo responsável técnico. ' +
          'Derivado dos pontos do plano de ação.',
        table: {
          columns: ['Fator / ponto', 'Origem', 'Grupos expostos', 'Medida de controle', 'Risco', 'Responsável'],
          data: invItems.length
            ? invItems.map((i) => [
                i.point,
                i.origin ?? '—',
                i.exposedGroup ?? '—',
                i.action,
                i.riskLevel ? (INVENTORY_RISK_LABEL[i.riskLevel as keyof typeof INVENTORY_RISK_LABEL] ?? i.riskLevel) : '—',
                i.responsible ?? '—',
              ])
            : [['—', '—', '—', '—', '—', '—']],
        },
      });
    }
    if (type === 'relatorio_preliminar') {
      sections.unshift({
        heading: 'Leitura preliminar',
        body:
          'Resultado preliminar de maturidade e riscos invisíveis. Este documento NÃO substitui o ' +
          'CRIVO Diagnóstico™ completo nem caracteriza, por si só, a AEP ou o PGR.',
      });
    }
    // (relatorio_executivo, plano_acao e dossie_tecnico saem pelos builders
    //  oficiais acima e nunca chegam a este fluxo comum.)

    // #13 — Declaração de escopo dos dossiês LEGADOS (emissões antigas só).
    if (type === 'dossie_aep' || type === 'dossie_aep_pgr') {
      sections.unshift({
        heading: 'Declaração de escopo',
        body:
          'Este documento registra os fatores de risco psicossociais relacionados ao trabalho ' +
          'identificados no ciclo avaliado, com a finalidade de subsidiar a Avaliação Ergonômica ' +
          'Preliminar (AEP)' +
          (output === 'AEP_PGR' ? ' e a integração ao GRO/PGR' : '') +
          '. Não substitui a AEP, o PGR, nem a validação da empresa ou do responsável técnico.',
      });
    }

    // Base Técnica da Recomendação (Motor CNAE/NR-1) — embasa o método e as saídas.
    sections.push(buildBaseTecnicaSection(cnaeDecision));

    // #13 — Conclusão e validação: fechamento formal com assinaturas (todos os documentos).
    sections.push({
      heading: 'Conclusão e validação',
      body:
        'A revisão, validação, assinatura e integração formal deste documento à AEP, ao GRO/PGR e ' +
        'às demais obrigações aplicáveis são de responsabilidade da empresa contratante e/ou do ' +
        'responsável técnico/designado.',
      table: {
        columns: ['Responsável', 'Nome', 'Cargo', 'Data', 'Validação'],
        data: [
          ['Empresa', '—', '—', '—', 'Validação eletrônica'],
          ['Responsável SST/designado', '—', '—', '—', 'Validação eletrônica'],
        ],
      },
    });

    sections.push(docControlSection());

    return {
      type,
      title: DOCUMENT_TYPE_LABEL[type],
      subtitle: 'Documento de apoio técnico · CRIVO',
      company,
      generatedAt: new Date().toISOString(),
      meta,
      sections,
      responsibilityNote: RESPONSIBILITY_NOTE,
    };
  }

  /**
   * Motor 4 (R-001) — EMITE a versão oficial: gera o documento (com todos os
   * gates de available()/§9 via generate) e o CONGELA como ReportEmission —
   * conteúdo + contexto do contrato + hash + numeração sequencial por tipo.
   * O preview (GET) continua dinâmico; a emissão nunca é reprocessada.
   */
  /**
   * Nome da campanha ABERTA do tenant, ou null. E o que separa "coleta em
   * andamento" de "ciclo fechado" — e o que faltava ser olhado na emissao: o
   * dossie saia no meio da coleta, congelado, sem dizer que era parcial.
   */
  private async cicloEmAndamento(tenantId: string): Promise<string | null> {
    const aberto = await this.prisma.forTenant(tenantId, async (tx) =>
      tx.assessmentCycle.findFirst({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        select: { name: true },
      }),
    );
    return aberto?.name ?? null;
  }

  async emit(tenantId: string, type: string, actorEmail?: string) {
    // Snapshot do contexto no momento da emissão — método EFETIVO (solução
    // contratada primeiro), o mesmo que aparece no documento e no portal.
    const ctxEmissao = await this.context(tenantId);
    const { contract, method, org, plans } = ctxEmissao;

    // O bloqueio de "plano sem nenhuma ação" saiu junto com os demais gates
    // (2026-09-08). Ele existia porque a seção 8 afirmava "plano aprovado";
    // hoje ela declara o estado real de cada ação, e o plano é gerado logo
    // acima — então plano vazio significa apenas que nenhum fator atingiu
    // risco suficiente para exigir ação, e o documento diz isso.

    // EMISSÃO FINAL (decisão do cliente 27/07): o rascunho/pré-visualização é
    // livre, mas os documentos TÉCNICOS só são emitidos com a identificação
    // completa da organização — o PGR reúne inventário e plano sob
    // responsabilidade do empregador, então o vínculo precisa ser inequívoco.
    // O portao que vale e este, no servidor: a tela desabilita o botao, mas a
    // rota nao pode depender do front.
    if (type === 'dossie_tecnico' || type === 'relatorio_tecnico') {
      const aberto = await this.cicloEmAndamento(tenantId);
      if (aberto) {
        throw new BadRequestException(
          `Campanha "${aberto}" ainda está aberta. Encerre a campanha para emitir a versão ` +
            'oficial — a pré-visualização continua disponível a qualquer momento.',
        );
      }
    }

    if (type === 'dossie_tecnico' || type === 'relatorio_evolucao') {
      const missing: string[] = [];
      if (!org?.legalName?.trim()) missing.push('razão social');
      if (!org?.taxId?.trim()) missing.push('CNPJ/identificador legal');
      if (!method) missing.push('método aplicado');
      if (!contract?.responsible?.trim()) missing.push('responsável da empresa');
      if (missing.length) {
        throw new BadRequestException(
          `Emissão final bloqueada — complete no cadastro/contrato: ${missing.join(', ')}. ` +
            'A pré-visualização (rascunho) continua disponível.',
        );
      }
    }

    // A emissão oficial NÃO depende mais de aprovação de texto pela equipe
    // CRIVO (decisão do cliente em 2026-09-08). Antes, três documentos ficavam
    // presos esperando um texto que só existe no Super Admin — tela que o
    // cliente não tem —, e a empresa simplesmente não conseguia emitir.
    //
    // O que sustenta soltar o gate: todo campo que ele exigia tem hoje conteúdo
    // automático de verdade. `sintese_executiva` cai na síntese do MAPA,
    // `sintese_evolucao` na síntese automática da comparação, e
    // `conclusao_tecnica`/`conclusao_evolucao` sempre foram PREFIXO opcional de
    // um texto de responsabilidade que já sai completo. Nenhum documento é
    // emitido com placeholder.
    //
    // O texto aprovado continua VENCENDO quando existe: a revisão editorial da
    // equipe segue valendo, deixou apenas de ser obrigatória.

    const doc = await this.generate(tenantId, type, ctxEmissao); // reaplica elegibilidade + bloqueios
    // Hash de integridade sobre o CONTEÚDO estável — generatedAt muda a cada
    // geração e não pode participar, senão a idempotência nunca dispara.
    const { generatedAt: _volatile, ...stable } = doc;
    const contentHash = createHash('sha256').update(JSON.stringify(stable)).digest('hex');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const last = await tx.reportEmission.findFirst({
        where: { type },
        orderBy: { emissionNumber: 'desc' },
        select: { emissionNumber: true, contentHash: true },
      });
      // Idempotência amigável: conteúdo idêntico ao da última emissão não gera
      // versão nova — devolve a existente (evita v2 igual à v1 por duplo clique).
      if (last && last.contentHash === contentHash) {
        const existing = await tx.reportEmission.findFirst({
          where: { type, emissionNumber: last.emissionNumber },
        });
        return { emission: existing!, reused: true as const };
      }
      const emissionNumber = (last?.emissionNumber ?? 0) + 1;
      // Carimbo do CONTROLE DOCUMENTAL no conteúdo congelado: status "Documento
      // emitido" + versão + data + hash reais. Feito APÓS o cálculo do hash — a
      // idempotência compara o conteúdo SEM o carimbo (determinístico). Só a
      // ÚLTIMA seção com esse título é substituída (os geradores sempre a põem
      // por último) — uma seção de texto livre homônima criada no Super Admin
      // em um modelo do Motor 4 não é tocada.
      const controlIdx = doc.sections.map((s) => s.heading).lastIndexOf('Controle documental');
      // Linhas do gerador que NÃO são carimbo (Método, Organização — exigidas
      // pelo modelo do Dossiê) sobrevivem à emissão; antes a seção era
      // substituída inteira e elas sumiam justamente na versão oficial.
      const preservadas = (doc.sections[controlIdx]?.rows ?? []).filter(
        (r) => !CONTROLE_CARIMBADO.has(r.label),
      );
      const emittedDoc: GeneratedDocument = {
        ...doc,
        sections: doc.sections.map((s, i) =>
          i === controlIdx
            ? {
                heading: 'Controle documental',
                rows: [
                  { label: 'Status do documento', value: 'Documento emitido' },
                  { label: 'Versão do documento', value: `v${emissionNumber}` },
                  { label: 'Data de emissão', value: fmt(new Date()) },
                  { label: 'Validação', value: 'Assinatura fora do sistema (empresa e responsável técnico)' },
                  { label: 'Hash/Identificador', value: contentHash.slice(0, 16) },
                  ...preservadas,
                ],
              }
            : s,
        ),
      };
      const emission = await tx.reportEmission.create({
        data: {
          tenantId,
          type,
          title: doc.title,
          emissionNumber,
          method,
          technicalOutput: contract?.technicalOutput ?? null,
          content: emittedDoc as unknown as object,
          contentHash,
          generatedBy: actorEmail ?? null,
        },
      });
      return { emission, reused: false as const };
    });
  }

  /** Repositório do TENANT: emissões próprias (metadados; conteúdo sob demanda). */
  async listEmissions(tenantId: string) {
    return this.prisma.forTenant(tenantId, (tx) =>
      tx.reportEmission.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, type: true, title: true, emissionNumber: true, method: true,
          technicalOutput: true, contentHash: true, status: true, generatedBy: true,
          createdAt: true, reviewedBy: true, reviewedAt: true,
        },
      }),
    );
  }

  /** Conteúdo congelado de uma emissão do tenant (para reimprimir a versão exata). */
  async getEmission(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const e = await tx.reportEmission.findUnique({ where: { id } });
      if (!e) throw new BadRequestException('Emissão não encontrada.');
      return e;
    });
  }
}

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString('pt-BR');
}
