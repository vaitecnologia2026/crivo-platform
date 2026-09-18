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

  // Perfil da organização — lido UMA vez e repetido em todos os lotes.
  const perfil = await perfilDaOrganizacao(deps, tenantId, instrumentSlug);

  // Lotes PEQUENOS e em paralelo: cada resposta cabe no teto, e a falha de um
  // lote nao leva os outros junto — antes, uma resposta cortada descartava o
  // conjunto inteiro.
  const grupos = emLotes(matrix, FATORES_POR_LOTE);
  const partes = await Promise.all(
    grupos.map((g) => umLote(deps, tenantId, g, system, perfil, timeoutMs).catch(() => null)),
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

/**
 * Perfil da organização para a IA — porte, modelo de trabalho, setor e o
 * diagnóstico aplicado. Sem isto o prompt só dizia "uma organização", e as
 * ações saíam genéricas ("treinamento", "reuniões") para qualquer empresa
 * (homologação 17/09: "Refinar qualidade e contextualização"). Best-effort:
 * qualquer falha devolve '' e a geração segue como antes.
 */
export async function perfilDaOrganizacao(
  deps: ActionPlansDeps,
  tenantId: string,
  instrumentSlug: string,
): Promise<string> {
  try {
    // rls-allow: organization/tenant/platform_lead/contract/product são control-plane; leitura self-scoped pela empresa.
    const org = await deps.prisma.admin.organization.findUnique({
      where: { id: tenantId },
      select: { name: true, establishment: true, employeesCount: true, workModel: true },
    });
    if (!org) return '';
    // rls-allow: tenant é control-plane; self-scoped por organizationId = tenantId.
    const tenant = await deps.prisma.admin.tenant.findFirst({
      where: { organizationId: tenantId },
      select: { id: true },
    });
    // O lead convertido guarda o segmento (CNAE principal) informado no MAPA.
    // rls-allow: platform_lead é control-plane (CRM); filtrado pelo tenant convertido.
    const lead = tenant
      ? await deps.prisma.admin.platformLead.findFirst({
          where: { convertedTenantId: tenant.id },
          orderBy: { updatedAt: 'desc' },
          select: { segment: true, employeesCount: true },
        })
      : null;
    // rls-allow: contract/product são control-plane; self-scoped por organizationId = tenantId.
    const contract = await deps.prisma.admin.contract.findFirst({
      where: { organizationId: tenantId, status: 'ATIVO' },
      orderBy: { createdAt: 'desc' },
      select: { productId: true },
    });
    const product = contract?.productId
      ? await deps.prisma.admin.product.findUnique({
          where: { id: contract.productId },
          select: { name: true },
        })
      : null;
    // rls-allow: diagnostic_instruments é catálogo GLOBAL (control-plane).
    const instrumento = await deps.prisma.admin.diagnosticInstrument.findUnique({
      where: { slug: instrumentSlug },
      select: { name: true },
    });
    const linhas = [
      `- Organização: ${org.name}`,
      lead?.segment ? `- Setor / atividade (CNAE): ${lead.segment}` : null,
      org.employeesCount || lead?.employeesCount
        ? `- Porte: ${org.employeesCount || lead?.employeesCount} colaborador(es)`
        : null,
      org.workModel ? `- Modelo de trabalho: ${org.workModel}` : null,
      org.establishment ? `- Unidade/estabelecimento avaliado: ${org.establishment}` : null,
      product?.name ? `- Solução contratada: ${product.name}` : null,
      instrumento?.name ? `- Diagnóstico aplicado: ${instrumento.name}` : null,
    ].filter((l): l is string => !!l);
    return linhas.join('\n');
  } catch {
    return '';
  }
}

/** Uma chamada de IA para UM lote de fatores. */
async function umLote(
  deps: ActionPlansDeps,
  tenantId: string,
  matrix: PsychosocialRiskMatrixRow[],
  system: string,
  perfil: string,
  timeoutMs: number,
): Promise<Record<string, PsychosocialActionLibraryEntry> | null> {
  // Cada fator leva o que a Biblioteca de Riscos sabe dele (definição,
  // fonte/circunstância, agravos) e a leitura das respostas — é o que permite
  // à IA agir sobre a CAUSA daquele fator nesta empresa, e não sobre o rótulo.
  const dimensoes = matrix
    .map((r) => {
      const pctAlta = r.exposureCount > 0 ? Math.round((r.highExposureCount / r.exposureCount) * 100) : null;
      const extras = [
        r.dimensionLabel ? `dimensão: ${r.dimensionLabel}` : null,
        r.definition ? `definição: ${r.definition}` : null,
        r.sourceContext ? `fonte/circunstância: ${r.sourceContext}` : null,
        r.consequences ? `possíveis agravos: ${r.consequences}` : null,
        pctAlta != null ? `${pctAlta}% das respostas em exposição alta (${r.respondents} respondente(s))` : null,
      ].filter((x): x is string => !!x);
      return (
        `- ${r.label} (slug: ${r.slug}) — Classificação: ${r.riskClass}; ` +
        `Risco R = ${r.risk} (Probabilidade ${r.probability} × Severidade ${r.severity}); ` +
        `exposição média ${r.exposureAvg.toFixed(2)}; ` +
        `plano de ação ${r.planRequired ? 'OBRIGATÓRIO' : 'não obrigatório'}` +
        (extras.length ? `; ${extras.join('; ')}` : '')
      );
    })
    .join('\n');
  const slugs = matrix.map((r) => r.slug);
  const user =
    (perfil ? `Perfil da organização avaliada:\n${perfil}\n\n` : '') +
    'Fatores/dimensões psicossociais avaliados nesta organização, com a classificação de risco derivada ' +
    `da matriz (R = Probabilidade × Severidade):\n${dimensoes}\n\n` +
    'Gere um plano de ação de controle para CADA fator listado, retornando um JSON EXATAMENTE neste ' +
    'formato:\n' +
    '{"planos": { "<slug>": { "descricao": string, "objetivo": string, "acoes": [ ' +
    '{ "titulo": string, "prazo": "Curto prazo"|"Curto → Médio prazo"|"Médio prazo"|"Longo prazo", ' +
    '"objetivo": string, "etapas": string, "indicadores": string } ] } } }\n\n' +
    'Regras de formato: use como chave de cada plano EXATAMENTE o slug informado; gere uma entrada para ' +
    `CADA slug desta lista: ${slugs.join(', ')}. Cada fator deve ter de 2 a 3 ações — o conjunto MÍNIMO ` +
    'suficiente para controlar o fator, não uma lista; prefira 2 ações fortes a 3 fracas. "descricao" resume o ' +
    'que o fator avalia NESTA organização; "objetivo" indica o propósito do plano.\n' +
    'Regras de qualidade: (1) cada ação é ESPECÍFICA para o perfil informado (setor, porte, modelo de ' +
    'trabalho) e para a fonte/circunstância do fator — nada de recomendação que sirva para qualquer ' +
    'empresa; (2) siga a hierarquia de controle da NR-1: primeiro medidas na organização do trabalho ' +
    '(processo, carga, papéis, gestão), depois medidas coletivas, por último ações individuais — ' +
    '"treinamento" ou "palestra" não pode ser a única resposta de um fator; (3) "etapas" nomeiam QUEM ' +
    'executa (função/área) e o que entrega em cada passo; (4) "indicadores" trazem meta e periodicidade ' +
    '(ex.: "reduzir horas extras médias de 12h para 6h/mês em 90 dias"); (5) prazo coerente com a ' +
    'classificação: risco Muito alto/Alto começa em Curto prazo; (6) não repita a mesma ação em fatores ' +
    'diferentes; (7) títulos curtos (até 8 palavras), português do Brasil, sem jargão vazio.';

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
 * Planos que a IA JA escreveu para estes fatores, guardados em
 * `factor_action_plans`. E a rede de seguranca: quando a IA cai, fica sem cota
 * ou demora, o sistema serve o ultimo texto dela em vez de nada.
 *
 * Antes o unico fallback era a biblioteca embutida, chaveada por 6 slugs fixos
 * que nao existem numa metodologia montada pelo cliente — dava ZERO sugestao.
 */
async function guardados(
  deps: ActionPlansDeps,
  instrumentSlug: string,
  matrix: PsychosocialRiskMatrixRow[],
): Promise<Record<string, PsychosocialActionLibraryEntry>> {
  const out: Record<string, PsychosocialActionLibraryEntry> = {};
  try {
    // Guarda texto do FATOR (rotulo + acoes), nenhum dado de empresa.
    // rls-allow: control-plane, sem coluna de tenant — ver o modelo no schema.
    const rows = await deps.prisma.admin.factorActionPlan.findMany({
      where: { instrumentSlug, factorSlug: { in: matrix.map((r) => r.slug) } },
      select: { factorSlug: true, descricao: true, objetivo: true, acoes: true },
    });
    for (const r of rows) {
      if (!Array.isArray(r.acoes) || r.acoes.length === 0) continue;
      out[r.factorSlug] = {
        descricao: r.descricao,
        objetivo: r.objetivo,
        acoes: r.acoes as unknown as PsychosocialActionLibraryEntry['acoes'],
      };
    }
  } catch (e) {
    // Nunca derruba a geracao: sem a rede, segue a biblioteca embutida.
    log.warn(`Nao foi possivel ler os planos guardados: ${e instanceof Error ? e.message : e}`);
  }
  return out;
}

/** Guarda o que a IA acabou de escrever, para servir de rede na proxima vez. */
async function guardar(
  deps: ActionPlansDeps,
  instrumentSlug: string,
  matrix: PsychosocialRiskMatrixRow[],
  plans: Record<string, PsychosocialActionLibraryEntry>,
): Promise<void> {
  for (const row of matrix) {
    const entry = plans[row.slug];
    if (!entry || !entry.acoes.length) continue;
    const dados = {
      factorLabel: row.label,
      descricao: entry.descricao,
      objetivo: entry.objetivo,
      acoes: entry.acoes as unknown as object,
      origin: 'IA',
    };
    try {
      // rls-allow: control-plane, sem coluna de tenant.
      await deps.prisma.admin.factorActionPlan.upsert({
        where: { instrumentSlug_factorSlug: { instrumentSlug, factorSlug: row.slug } },
        create: { instrumentSlug, factorSlug: row.slug, ...dados },
        update: dados,
      });
    } catch (e) {
      log.warn(
        `Nao foi possivel guardar o plano do fator "${row.slug}": ` +
          `${e instanceof Error ? e.message : e}`,
      );
    }
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
export const AI_PLANS_TIMEOUT_LISTAGEM_MS = 12000;

export async function resolveActionPlans(
  deps: ActionPlansDeps,
  tenantId: string,
  matrix: PsychosocialRiskMatrixRow[],
  instrumentSlug: string,
  timeoutMs: number = AI_PLANS_TIMEOUT_MS,
): Promise<ResolvedActionPlans> {
  // Tres camadas, da mais fraca para a mais forte:
  //   1. biblioteca embutida — so alcanca as 6 dimensoes da metodologia original;
  //   2. planos que a IA JA escreveu para estes fatores (rede de seguranca);
  //   3. o que a IA escrever AGORA.
  // Antes era so 1 ou 3, tudo ou nada: com a IA fora do ar e uma metodologia do
  // cliente, a tela ficava com zero sugestao.
  const rede = await guardados(deps, instrumentSlug, matrix);
  const ai = await fromAI(deps, tenantId, matrix, instrumentSlug, timeoutMs).catch(() => null);
  if (ai) await guardar(deps, instrumentSlug, matrix, ai);
  const plans = { ...PSYCHOSOCIAL_ACTION_LIBRARY, ...rede, ...(ai ?? {}) };
  // O texto guardado tambem foi escrito pela IA — dizer "biblioteca" ali seria
  // mentir sobre a origem no documento.
  const origin: ResolvedActionPlans['origin'] =
    ai || Object.keys(rede).length ? 'IA' : 'biblioteca';
  if (!ai && Object.keys(rede).length) {
    log.warn(
      `IA indisponivel: servindo ${Object.keys(rede).length} plano(s) guardado(s) de ` +
        `${matrix.length} fator(es).`,
    );
  }
  return { plans, origin };
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
