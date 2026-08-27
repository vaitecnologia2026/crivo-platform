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
): Promise<Record<string, PsychosocialActionLibraryEntry> | null> {
  const s = await deps.aiSettings.get();
  if (!s.enabled || !s.enabledModules.includes('relatorios') || matrix.length === 0) return null;

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

  // Prompt PERSONALIZADO do super admin (IA da Plataforma · Prompts e Políticas)
  // vinculado ao DIAGNÓSTICO que está sendo processado: quando existir um ativo,
  // o corpo dele (+ material de referência anexado) substitui o system fixo. O
  // guard de JSON é anexado SEMPRE e a mensagem `user` fica intacta → o parse
  // nunca quebra. O slug vem de quem chamou porque o mesmo prompt pode atender
  // mais de um diagnóstico (ex.: Essencial e Organizacional sob uma política só).
  // Permissivo: qualquer falha na consulta cai no prompt fixo.
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
    maxTokens: 2800,
    // gpt-4o-mini + timeout curto: a geração é síncrona (o portal espera até
    // 60s). Se a IA demorar além disto, o fallback entra bem antes de estourar.
    model: 'gpt-4o-mini',
    timeoutMs: 22000,
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
    if (Object.keys(out).length === 0) return null;
    return out;
  } catch {
    return null;
  }
}

/**
 * Mapa de planos para a matriz dada: IA quando disponível e válida, senão a
 * biblioteca técnica fixa. Nunca lança — o pior caso é devolver a biblioteca.
 */
export async function resolveActionPlans(
  deps: ActionPlansDeps,
  tenantId: string,
  matrix: PsychosocialRiskMatrixRow[],
  instrumentSlug: string,
): Promise<ResolvedActionPlans> {
  const ai = await fromAI(deps, tenantId, matrix, instrumentSlug).catch(() => null);
  return ai
    ? { plans: ai, origin: 'IA' }
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
