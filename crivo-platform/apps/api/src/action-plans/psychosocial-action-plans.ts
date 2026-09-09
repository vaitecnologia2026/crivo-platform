import { Logger } from '@nestjs/common';
import type { PsychosocialRiskMatrixRow } from '@crivo/types';
import type { PrismaService } from '../prisma/prisma.service';
import type { AiSettingsService } from '../admin/ai-settings.service';
import {
  buildPromptReferenceBlocks,
  findActiveCustomPromptForInstrument,
} from '../admin/ai-custom-prompts.service';
import {
  PSYCHOSOCIAL_ACTION_LIBRARY,
  type PsychosocialActionLibraryEntry,
} from './psychosocial-action-library';

const log = new Logger('ActionPlansAI');

/**
 * Quantos fatores por chamada.
 *
 * Era UMA chamada para todos. Com 14 fatores obrigatorios x 3-4 acoes x cinco
 * campos, a resposta batia no teto de saida e vinha CORTADA: o `JSON.parse`
 * lancava e o catch devolvia null em silencio — ou seja, toda chamada que dava
 * `ok: true` era jogada fora. Medido em producao: `completion_tokens` = 2800,
 * exatamente o teto, nas duas chamadas bem-sucedidas.
 */
const FATORES_POR_LOTE = 4;
/** Teto de saida por fator, com folga para 4 acoes de cinco campos. */
const TOKENS_POR_FATOR = 800;
/** Piso, para um lote de 1 fator nao ficar sem espaco. */
const TOKENS_MINIMO = 1200;

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

/**
 * Conteúdo dos planos de ação psicossociais, por dimensão.
 *
 * Extraído do DocumentsService para ser usado por DOIS caminhos com o mesmo
 * resultado: o Dossiê (que imprime o plano como texto) e as SUGESTÕES do Plano
 * de Evolução (que viram ações reais quando a empresa aceita). Sem isso, os dois
 * caminhos divergiriam com o tempo — e a empresa leria uma coisa no documento e
 * veria outra na tela.
 *
 * A IA personaliza quando está ligada; a biblioteca fixa garante o resultado
 * quando não está. O formato de saída é IDÊNTICO nos dois casos: muda só a
 * ORIGEM do conteúdo.
 */

/**
 * Obrigação de FORMATO do gerador. Anexada SEMPRE — inclusive quando um prompt
 * PERSONALIZADO (ai_custom_prompts) substitui o corpo do system: o schema
 * {"planos":{...}} vive na mensagem `user` e o parse depende desta garantia.
 */
export const PSY_JSON_FORMAT_GUARD =
  'Responda ESTRITAMENTE em JSON válido no schema pedido, sem nenhum ' +
  'texto fora do JSON. NUNCA invente diagnóstico clínico individual nem faça referência a respondentes ' +
  'específicos; trate os riscos sempre de forma coletiva e organizacional.';

export type ActionPlansDeps = {
  prisma: PrismaService;
  aiSettings: AiSettingsService;
};

export type ResolvedActionPlans = {
  plans: Record<string, PsychosocialActionLibraryEntry>;
  origin: 'IA' | 'biblioteca';
};

/**
 * Planos GERADOS pela IA da plataforma, por linha da matriz. Devolve `null`
 * sempre que a IA está desligada, sem chave, indisponível ou retorna algo
 * inválido — o chamador cai na biblioteca fixa.
 */
async function fromAI(
  deps: ActionPlansDeps,
  tenantId: string,
  matrix: PsychosocialRiskMatrixRow[],
  instrumentSlug: string,
  timeoutMs: number,
): Promise<Record<string, PsychosocialActionLibraryEntry> | null> {
  const s = await deps.aiSettings.get();
  if (!s.enabled || !s.enabledModules.includes('relatorios') || matrix.length === 0) return null;

  // Prompt PERSONALIZADO do super admin (IA da Plataforma), vinculado ao
  // DIAGNOSTICO processado. O guard de JSON e anexado SEMPRE e a mensagem `user`
  // fica intacta. Permissivo: qualquer falha na consulta cai no prompt fixo.
  const custom = await findActiveCustomPromptForInstrument(deps.prisma, instrumentSlug);
  let system: string;
  if (custom) {
    const refs = buildPromptReferenceBlocks(custom.files);
    system = `${custom.body}${refs ? `\n\n${refs}` : ''}\n\n${PSY_JSON_FORMAT_GUARD}`;
  } else {
    system =
      'Você é um especialista em riscos psicossociais ocupacionais no contexto da NR-1 brasileira ' +
      '(Gerenciamento de Riscos Ocupacionais). Sua tarefa é elaborar planos de ação de CONTROLE dos ' +
      'riscos psicossociais por dimensão avaliada, com linguagem técnica, objetiva e prática, aplicável à ' +
      `realidade de uma organização. ${PSY_JSON_FORMAT_GUARD}`;
  }

  // Lotes PEQUENOS e em paralelo: cada resposta cabe no teto, e a falha de um
  // lote nao leva os outros junto — antes, uma resposta cortada descartava o
  // conjunto inteiro.
  const grupos = emLotes(matrix, FATORES_POR_LOTE);
  const partes = await Promise.all(
    grupos.map((g) => umLote(deps, tenantId, g, system, timeoutMs).catch(() => null)),
  );
  const out: Record<string, PsychosocialActionLibraryEntry> = {};
  for (const p of partes) if (p) Object.assign(out, p);
  const cobertos = Object.keys(out).length;
  if (!cobertos) {
    log.warn(
      `IA nao cobriu nenhum dos ${matrix.length} fatores (${grupos.length} lote(s)) — usando a biblioteca tecnica.`,
    );
    return null;
  }
  if (cobertos < matrix.length) {
    log.warn(`IA cobriu ${cobertos} de ${matrix.length} fatores; o restante sai da biblioteca tecnica.`);
  }
  return out;
}

/** Uma chamada de IA para UM lote de fatores. */
async function umLote(
  deps: ActionPlansDeps,
  tenantId: string,
  matrix: PsychosocialRiskMatrixRow[],
  system: string,
  timeoutMs: number,
): Promise<Record<string, PsychosocialActionLibraryEntry> | null> {
  const dimensoes = matrix
    .map(
      (r) =>
        `- ${r.label} (slug: ${r.slug}) — Classificação: ${r.riskClass}; ` +
        `Risco R = ${r.risk} (Probabilidade ${r.probability} × Severidade ${r.severity}); ` +
        `exposição média ${r.exposureAvg.toFixed(2)}; ` +
        `plano de ação ${r.planRequired ? 'OBRIGATÓRIO' : 'não obrigatório'}`,
    )
    .join('\n');
  const slugs = matrix.map((r) => r.slug);
  const user =
    'Dimensões psicossociais avaliadas nesta organização, com a classificação de risco derivada da ' +
    `matriz (R = Probabilidade × Severidade):\n${dimensoes}\n\n` +
    'Gere um plano de ação de controle para CADA dimensão listada, retornando um JSON EXATAMENTE neste ' +
    'formato:\n' +
    '{"planos": { "<slug>": { "descricao": string, "objetivo": string, "acoes": [ ' +
    '{ "titulo": string, "prazo": "Curto prazo"|"Curto → Médio prazo"|"Médio prazo"|"Longo prazo", ' +
    '"objetivo": string, "etapas": string, "indicadores": string } ] } } }\n\n' +
    'Regras: use como chave de cada plano EXATAMENTE o slug informado; gere uma entrada para CADA slug ' +
    `desta lista: ${slugs.join(', ')}. Cada dimensão deve ter de 3 a 4 ações. "descricao" resume o que a ` +
    'dimensão avalia; "objetivo" indica o propósito do plano; cada ação traz "etapas" concretas e ' +
    '"indicadores" mensuráveis de acompanhamento. Priorize ações mais estruturantes nas dimensões de ' +
    'classificação de risco mais alta.';

  const r = await deps.aiSettings.chat({
    useCase: 'dossie_action_plan',
    tenantId,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    responseFormat: 'json_object',
    temperature: 0.3,
    // Proporcional ao LOTE. Fixo em 2800 para a matriz inteira, a resposta vinha
    // cortada no teto e o JSON quebrava.
    maxTokens: Math.max(TOKENS_MINIMO, TOKENS_POR_FATOR * matrix.length),
    // O orçamento vem de QUEM CHAMA: a emissão de documento pode esperar, a
    // listagem do Plano de Evolução não. Este comentário dizia "o portal espera
    // até 60s" — verdade para os documentos, falso para a listagem, que usa o
    // tempo limite genérico de 15s. Era essa premissa que derrubava a tela.
    model: 'gpt-4o-mini',
    timeoutMs,
  });
  if (!r.ok) return null;

  try {
    const parsed: unknown = JSON.parse(r.content);
    if (!parsed || typeof parsed !== 'object') return null;
    const container = parsed as Record<string, unknown>;
    const planosRaw = (container.planos ?? container) as unknown;
    if (!planosRaw || typeof planosRaw !== 'object' || Array.isArray(planosRaw)) return null;
    const planos = planosRaw as Record<string, unknown>;

    const isString = (v: unknown): v is string => typeof v === 'string';
    const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

    // Normaliza APENAS os slugs presentes na matriz que vieram válidos da IA.
    const out: Record<string, PsychosocialActionLibraryEntry> = {};
    for (const row of matrix) {
      const raw = planos[row.slug];
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const entry = raw as Record<string, unknown>;
      if (!isNonEmpty(entry.descricao) || !isString(entry.objetivo)) continue;
      const descricao = entry.descricao;
      const objetivo = entry.objetivo;
      if (!Array.isArray(entry.acoes)) continue;
      const acoes = entry.acoes
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object' && !Array.isArray(a))
        .filter(
          (a) =>
            isString(a.titulo) &&
            isString(a.prazo) &&
            isString(a.objetivo) &&
            isString(a.etapas) &&
            isString(a.indicadores),
        )
        .map((a) => ({
          titulo: a.titulo as string,
          prazo: a.prazo as string,
          objetivo: a.objetivo as string,
          etapas: a.etapas as string,
          indicadores: a.indicadores as string,
        }));
      if (acoes.length < 1) continue;
      out[row.slug] = { descricao, objetivo, acoes };
    }
    // Nenhuma dimensão válida no conjunto → fallback para a biblioteca fixa.
    if (Object.keys(out).length === 0) {
      log.warn(
        `Lote de ${matrix.length} fator(es): resposta valida, mas nenhum fator reconhecido ` +
          `(${r.content.length} chars). Slugs pedidos: ${matrix.map((x) => x.slug).join(', ')}.`,
      );
      return null;
    }
    return out;
  } catch (e) {
    // Este catch era mudo. Era ele que escondia o defeito real: JSON cortado no
    // teto de saida, chamada marcada como `ok` e conteudo descartado.
    log.warn(
      `Lote de ${matrix.length} fator(es): resposta nao pode ser lida (${r.content.length} chars, ` +
        `possivel corte no teto de saida): ${e instanceof Error ? e.message : e}`,
    );
    return null;
  }
}

/**
 * Mapa de planos para a matriz dada: IA quando disponível e válida, senão a
 * biblioteca técnica fixa. Nunca lança — o pior caso é devolver a biblioteca.
 */
/** Orçamento padrão: emissão de documento, onde o cliente espera. */
export const AI_PLANS_TIMEOUT_MS = 22000;
/**
 * Orçamento da LISTAGEM do Plano de Evolução. Tem de terminar com folga dentro
 * dos 15s do `apiFetch` do portal, senão a tela morre em "Não foi possível
 * carregar" e o usuário nunca chega a ver o fallback da biblioteca.
 */
export const AI_PLANS_TIMEOUT_LISTAGEM_MS = 9000;

export async function resolveActionPlans(
  deps: ActionPlansDeps,
  tenantId: string,
  matrix: PsychosocialRiskMatrixRow[],
  instrumentSlug: string,
  timeoutMs: number = AI_PLANS_TIMEOUT_MS,
): Promise<ResolvedActionPlans> {
  const ai = await fromAI(deps, tenantId, matrix, instrumentSlug, timeoutMs).catch(() => null);
  // A biblioteca e a BASE e a IA entra por cima, fator a fator. Antes era um ou
  // outro: se a IA cobrisse 8 de 14, os 14 vinham da biblioteca.
  return ai
    ? { plans: { ...PSYCHOSOCIAL_ACTION_LIBRARY, ...ai }, origin: 'IA' }
    : { plans: PSYCHOSOCIAL_ACTION_LIBRARY, origin: 'biblioteca' };
}

/**
 * Entrada de plano para uma linha da matriz. A biblioteca é chaveada pela
 * DIMENSÃO; com fatores cadastrados a linha traz o slug do FATOR, então tentamos
 * a dimensão de origem também — sem isto o plano some em silêncio.
 */
export function planEntryFor(
  plans: Record<string, PsychosocialActionLibraryEntry>,
  row: PsychosocialRiskMatrixRow,
): PsychosocialActionLibraryEntry | undefined {
  return plans[row.slug] ?? (row.sourceSlug ? plans[row.sourceSlug] : undefined);
}
