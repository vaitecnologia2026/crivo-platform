import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  computePsychosocial,
  scoreWithMethodology,
  findBandForScore,
  psychosocialLevel,
  psychosocialProbabilityFrom,
  psychosocialRiskClass,
  exposuresFromAnswers,
  PSYCHOSOCIAL_RISK_CLASS_ACTION,
  PSYCHOSOCIAL_RISK_PLAN_REQUIRED,
  type MethodologyConfig,
  PSYCHOSOCIAL_DIMENSIONS,
  PSYCHOSOCIAL_DIMENSION_LABEL,
  PSYCHOSOCIAL_QUESTIONS,
  type PsychosocialProfileRow,
  type PsychosocialRiskMatrixRow,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  loadActiveMethodologyConfig,
  loadMethodologyConfigByVersion,
  resolveActiveMethodology,
  resolvePsychosocialInstrument,
} from '../admin/methodology.service';
import { getEngineConfig, resolveMinRespondents } from '../admin/engine-config';
import { SubmitPsychosocialDto } from './dto';

// Resultado psicossocial em formato "superset" — compatível com o storage/telas
// antigos (level/byDimension) + rótulos da metodologia ATIVA (Fase 1C).
type DimensionBandMap = Record<string, { code: string; label: string; color: string | null }>;
type PsyResult = {
  score: number;
  level: string;
  levelLabel?: string;
  levelColor?: string | null;
  byDimension: Record<string, number>;
  dimensionLabels?: Record<string, string>;
  dimensionBands?: DimensionBandMap;
  /** 0–100 por FATOR (perguntas vinculadas) — alimenta a probabilidade da matriz. */
  byFactor?: Record<string, number>;
  topRisk: string;
};

/** Slug curto e legível: base do nome + sufixo aleatório (colisão ~nula). */
function makeSlug(orgName: string): string {
  const base = orgName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'empresa';
  // 8 bytes = 64 bits de entropia (antes 3 = 24 bits): impede enumeração/brute-force do slug público.
  return `${base}-${randomBytes(8).toString('hex')}`;
}

/**
 * Questionário Psicossocial Organizacional (Briefing §6 — diagnóstico AMPLO por
 * colaborador). DISTINTO do ICD (líder/decisão): mede a PERCEPÇÃO de fatores
 * psicossociais reconhecidos por colaborador, agregada por setor.
 *
 * Confidencialidade (§11/§14): a resposta é ANÔNIMA (não guardamos userId) e a
 * agregação SUPRIME qualquer recorte com menos de MIN_LEADERS_FOR_DISCLOSURE
 * respondentes — não há como reidentificar ninguém a partir dos agregados.
 * Data plane: tudo sob forTenant (RLS por tenant).
 */
@Injectable()
export class PsychosocialService {
  constructor(private readonly prisma: PrismaService) {}

  /** Submete uma resposta anônima. Retorna o resultado individual ao respondente.
   *  `beforeCreate` roda na MESMA transação, ANTES do create — usado pelo fluxo de
   *  colaboradores para marcar participação (respondedAt) de forma atômica sem
   *  gravar nenhum identificador na resposta (mantém o anonimato). Se lançar,
   *  nada é gravado. */
  async submit(
    tenantId: string,
    dto: SubmitPsychosocialDto,
    beforeCreate?: (tx: Parameters<Parameters<PrismaService['forTenant']>[1]>[0]) => Promise<void>,
  ) {
    // Pontua pela metodologia ATIVA do Organizacional (Fase 1C); fallback ao padrão.
    // MET1: capturamos o versionId da metodologia que pontuou, para pinar a trilha
    // na resposta — republicar depois não re-pontua o que já foi respondido.
    const active = await resolveActiveMethodology(this.prisma, await resolvePsychosocialInstrument(this.prisma));
    let result: PsyResult;
    let methodologyVersionId: string | null = null;
    try {
      if (active) {
        methodologyVersionId = active.versionId;
        const s = scoreWithMethodology(dto.answers ?? [], active.config);
        const byDimension: Record<string, number> = {};
        const dimensionLabels: Record<string, string> = {};
        const dimensionBands: DimensionBandMap = {};
        for (const d of s.byDimension) {
          byDimension[d.slug] = d.value;
          dimensionLabels[d.slug] = d.label;
          const b = findBandForScore(active.config.bands, d.value);
          if (b) dimensionBands[d.slug] = { code: b.code, label: b.label, color: b.color ?? null };
        }
        // Leitura de RISCO: média por fator das perguntas vinculadas (NR-1 §9).
        // Gravada junto da resposta para a matriz não depender de recálculo.
        const byFactor: Record<string, number> = {};
        for (const f of s.byFactor ?? []) byFactor[f.slug] = f.value;
        result = {
          score: s.score, level: s.levelCode, levelLabel: s.levelLabel,
          levelColor: findBandForScore(active.config.bands, s.score)?.color ?? null,
          byDimension, dimensionLabels, dimensionBands,
          ...(Object.keys(byFactor).length ? { byFactor } : {}),
          topRisk: s.topAttentions[0] ?? '',
        };
      } else {
        const r = computePsychosocial(dto.answers ?? []);
        result = { score: r.score, level: r.level, byDimension: r.byDimension as Record<string, number>, topRisk: r.topRisk };
      }
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Respostas inválidas');
    }
    const sector = dto.sector?.trim() || null;
    return this.prisma.forTenant(tenantId, async (tx) => {
      // Gate atômico (colaboradores): marca respondedAt e aborta se já respondeu,
      // ANTES de criar a resposta — na mesma transação, então ou grava os dois ou
      // nenhum. A resposta em si NÃO recebe nenhum identificador do colaborador.
      if (beforeCreate) await beforeCreate(tx);
      await tx.psychosocialResponse.create({
        data: {
          tenantId,
          sector,
          answers: dto.answers as unknown as object,
          score: result.score,
          level: result.level,
          byDimension: result.byDimension as unknown as object,
          // null quando a versão não tem fatores/vínculos — a matriz IGNORA a
          // resposta nesse fator (nunca conta como zero).
          byFactor: (result.byFactor ?? null) as unknown as object,
          methodologyVersionId,
        },
      });
      // Devolve só o resultado próprio (anônimo) — nenhum identificador é guardado.
      return { ok: true as const, result };
    });
  }

  /** Perguntas do questionário — da metodologia ATIVA (Fase 1C); fallback ao padrão. */
  async getQuestions() {
    const cfg = await loadActiveMethodologyConfig(this.prisma, await resolvePsychosocialInstrument(this.prisma));
    return cfg
      ? cfg.questions.map((q, i) => ({ id: i + 1, dimension: q.dimensionSlug, text: q.text }))
      : PSYCHOSOCIAL_QUESTIONS;
  }

  // ── Link público anônimo (Briefing §6) ────────────────────────────────────

  /** Slug público atual da empresa (null se ainda não gerado). */
  async getLink(tenantId: string): Promise<{ slug: string | null }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: tenantId },
        select: { psychosocialSlug: true },
      });
      return { slug: org?.psychosocialSlug ?? null };
    });
  }

  /** Gera (idempotente) o slug público da empresa. Retorna o existente se já houver. */
  async ensureLink(tenantId: string): Promise<{ slug: string }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: tenantId },
        select: { name: true, psychosocialSlug: true },
      });
      if (!org) throw new NotFoundException('Empresa não encontrada.');
      if (org.psychosocialSlug) return { slug: org.psychosocialSlug };
      // Tenta algumas vezes para o caso (raríssimo) de colisão no unique.
      for (let i = 0; i < 5; i++) {
        const slug = makeSlug(org.name);
        try {
          await tx.organization.update({ where: { id: tenantId }, data: { psychosocialSlug: slug } });
          return { slug };
        } catch {
          // colisão de unique — tenta outro sufixo
        }
      }
      throw new BadRequestException('Não foi possível gerar o link. Tente novamente.');
    });
  }

  /**
   * Perguntas do Diagnóstico Organizacional pela metodologia ATIVA (fallback ao
   * padrão embutido). Público e sem tenant: é a mesma lista para /q/<slug> e para
   * a campanha /p/c/<slug> — uma fonte só, para os dois links não divergirem.
   */
  async publicQuestions() {
    const cfg = await loadActiveMethodologyConfig(this.prisma, await resolvePsychosocialInstrument(this.prisma));
    return cfg
      ? cfg.questions.map((q, i) => ({ id: i + 1, dimension: q.dimensionSlug, text: q.text }))
      : PSYCHOSOCIAL_QUESTIONS;
  }

  /** Resolve um slug público → nome da empresa + perguntas (sem auth, sem dados internos). */
  async getPublicBySlug(slug: string) {
    // rls-allow: endpoint público anônimo (/q/<slug>), sem tenant no contexto; resolve slug→nome (select mínimo).
    const org = await this.prisma.admin.organization.findUnique({
      where: { psychosocialSlug: slug },
      select: { name: true },
    });
    if (!org) throw new NotFoundException('Questionário não encontrado ou link inválido.');
    return { tenantName: org.name, questions: await this.publicQuestions() };
  }

  /** Submissão pública anônima via slug. Resolve o tenant e grava sob a RLS dele. */
  async submitPublic(slug: string, dto: SubmitPsychosocialDto) {
    // rls-allow: endpoint público anônimo; resolve slug→tenantId. submit() grava sob a RLS do tenant.
    const org = await this.prisma.admin.organization.findUnique({
      where: { psychosocialSlug: slug },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Questionário não encontrado ou link inválido.');
    return this.submit(org.id, dto);
  }

  /**
   * Agregação para RH/gestão: visão geral + por setor, com supressão §14.
   * Cada recorte (geral e cada setor) só revela agregados se tiver ≥ minRespondents.
   */
  async results(tenantId: string) {
    // Limiar de supressão DEFINIDO na Configuração do Motor (não mais hardcoded).
    const minRespondents = await resolveMinRespondents(this.prisma, tenantId);
    // Dimensões/faixas da metodologia ATIVA (Fase 1C); fallback ao padrão.
    // O instrumento é o do método ORGANIZACIONAL (configurável no Motor): sem
    // isto, a matriz continuaria lendo o slug legado e saindo vazia.
    const instrumento = await resolvePsychosocialInstrument(this.prisma);
    const cfg = await loadActiveMethodologyConfig(this.prisma, instrumento);
    // Severidade e hierarquia (escala × fator) vêm DIRETO da versão ativa, não do
    // MethodologyConfig: o motor de score não usa severidade, e manter o contrato
    // do cálculo intocado evita mexer em quem já pontua com ele.
    // rls-allow: methodology_* é catálogo GLOBAL (control-plane), não é dado do tenant.
    const activeVersion = await this.prisma.admin.methodologyVersion.findFirst({
      where: { instrument: instrumento, status: 'ACTIVE' },
      select: {
        dimensions: { select: { slug: true, severity: true, parentSlug: true } },
        factors: { select: { slug: true, label: true, severity: true, dimensionSlug: true }, orderBy: { order: 'asc' } },
        questions: { select: { dimensionSlug: true, factorSlugs: true } },
      },
    });
    const metaBySlug = new Map(
      (activeVersion?.dimensions ?? []).map((d) => [d.slug, { severity: d.severity, parentSlug: d.parentSlug }]),
    );
    const dims = cfg
      ? cfg.dimensions.map((d) => ({
          slug: d.slug,
          label: d.label,
          severity: metaBySlug.get(d.slug)?.severity ?? null,
          parentSlug: metaBySlug.get(d.slug)?.parentSlug ?? null,
        }))
      : PSYCHOSOCIAL_DIMENSIONS.map((d) => ({
          slug: d as string,
          label: PSYCHOSOCIAL_DIMENSION_LABEL[d],
          severity: null,
          parentSlug: null,
        }));

    // Linhas da Matriz de Risco. A severidade pertence ao FATOR (Orientação NR-1
    // §8): havendo fatores cadastrados na versão ativa, eles mandam e a
    // probabilidade sai da dimensão vinculada. Sem fatores, cai no comportamento
    // anterior (dimensão de topo com severidade) — nada muda para quem já
    // parametrizou assim.
    const factors = activeVersion?.factors ?? [];
    const activeQuestions = activeVersion?.questions ?? [];
    /** Dimensão majoritária entre as perguntas do fator — mantém a chave da
     *  biblioteca de ações do Dossiê (que é por DIMENSÃO) quando o fator não
     *  declara `dimensionSlug`. */
    const mainDimensionOf = (factorSlug: string): string | null => {
      const count = new Map<string, number>();
      for (const q of activeQuestions) {
        if (!q.factorSlugs?.includes(factorSlug)) continue;
        count.set(q.dimensionSlug, (count.get(q.dimensionSlug) ?? 0) + 1);
      }
      let best: string | null = null;
      let bestN = 0;
      for (const [dim, n] of count) if (n > bestN) { best = dim; bestN = n; }
      return best;
    };
    const matrixRows: MatrixSource[] = factors.length
      ? factors
          .map((f): MatrixSource | null => {
            // Cascata da PROBABILIDADE (NR-1 §9): perguntas vinculadas ao fator →
            // dimensão de fallback → fora da matriz. Nunca entra com 0 (que na
            // régua de proteção viraria "100% crítico" e inflaria o risco).
            const hasQuestions = activeQuestions.some((q) => q.factorSlugs?.includes(f.slug));
            const dimForPlan = f.dimensionSlug ?? mainDimensionOf(f.slug);
            if (hasQuestions) {
              return {
                slug: f.slug,
                label: f.label,
                severity: f.severity,
                from: 'factor' as const,
                sourceSlug: f.slug,
                // A biblioteca de ações do Dossiê resolve por DIMENSÃO.
                planSlug: dimForPlan,
              };
            }
            if (dimForPlan) {
              return {
                slug: f.slug,
                label: f.label,
                severity: f.severity,
                from: 'dimension' as const,
                sourceSlug: dimForPlan,
                planSlug: dimForPlan,
              };
            }
            return null; // sem perguntas e sem dimensão: fica fora da matriz
          })
          .filter((r): r is MatrixSource => r !== null)
      : dims
          .filter((d) => !d.parentSlug && d.severity != null)
          .map((d) => ({ slug: d.slug, label: d.label, severity: d.severity as number, from: 'dimension' as const, sourceSlug: d.slug, planSlug: d.slug }));
    const bands = cfg?.bands ?? null;
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.psychosocialResponse.findMany({
        select: { sector: true, score: true, byDimension: true, byFactor: true, answers: true, methodologyVersionId: true },
      });

      // §6.1/§6.2 — EXPOSIÇÃO por resposta, recalculada das respostas CRUAS contra
      // a config da versão que pontuou (os agregados 0–100 gravados já vêm
      // normalizados/ponderados/arredondados e não permitem derivar exposição).
      // Uma carga de config por versão distinta, reaproveitada por todas as linhas.
      const cfgByVersion = new Map<string, MethodologyConfig | null>();
      for (const vId of new Set(rows.map((r) => r.methodologyVersionId).filter((v): v is string => !!v))) {
        cfgByVersion.set(vId, await loadMethodologyConfigByVersion(this.prisma, vId));
      }
      for (const r of rows as RowWithExposure[]) {
        // Sem versão pinada (pontuada pelo padrão embutido) não há config para
        // reconstruir: a resposta não entra na matriz — melhor ausente que errada.
        const rc = r.methodologyVersionId ? cfgByVersion.get(r.methodologyVersionId) ?? null : null;
        if (!rc) continue;
        const ans = Array.isArray(r.answers) ? (r.answers as { questionId: number; value: number }[]) : [];
        r.exposures = exposuresFromAnswers(ans, rc);
      }

      // MET1 — trilha: quantas versões de metodologia pontuaram este conjunto.
      // >1 sinaliza que o recorte mistura metodologias (comparabilidade limitada).
      const methodologyVersionIds = Array.from(
        new Set(rows.map((r) => r.methodologyVersionId).filter((v): v is string => !!v)),
      );

      const overall = aggregate(rows, dims, bands, matrixRows);
      const overallSuppressed = rows.length < minRespondents;

      // Agrupa por setor.
      const bySectorMap = new Map<string, typeof rows>();
      for (const r of rows) {
        const key = r.sector ?? '—';
        const arr = bySectorMap.get(key) ?? [];
        arr.push(r);
        bySectorMap.set(key, arr);
      }
      const sectors = Array.from(bySectorMap.entries())
        .map(([sector, list]) => {
          const suppressed = list.length < minRespondents;
          return {
            sector,
            respondents: list.length,
            suppressed,
            ...(suppressed ? {} : aggregate(list, dims, bands, matrixRows)),
          };
        })
        .sort((a, b) => b.respondents - a.respondents);

      return {
        minRespondents,
        totalRespondents: rows.length,
        // Trilha MET1: versões de metodologia presentes no recorte. `mixed`=true
        // avisa que as respostas foram pontuadas por metodologias diferentes.
        methodologyVersionIds,
        methodologyMixed: methodologyVersionIds.length > 1,
        overall: overallSuppressed
          ? { suppressed: true as const }
          : { suppressed: false as const, ...overall },
        sectors,
      };
    });
  }
}

type Exposures = { byFactor: Record<string, number[]>; byDimension: Record<string, number[]> };
type Row = { score: number; byDimension: unknown; byFactor?: unknown; exposures?: Exposures };
/** Linha do banco + as exposições recalculadas (preenchidas em results()). */
type RowWithExposure = Row & { methodologyVersionId: string | null; answers: unknown };
type AggDim = { slug: string; label: string; severity?: number | null; parentSlug?: string | null };
type AggBand = { code: string; label: string; min: number; max: number; color?: string | null };
/** Linha da Matriz de Risco: o que a compõe (fator ou, no fallback, dimensão de
 *  topo) e de qual dimensão sai a probabilidade (`sourceSlug`). */
type MatrixSource = {
  slug: string;
  label: string;
  severity: number;
  /** De onde sai a probabilidade: das perguntas do fator ou da dimensão. */
  from: 'factor' | 'dimension';
  /** Chave usada para ler o valor do respondente (byFactor ou byDimension). */
  sourceSlug: string;
  /** Chave da DIMENSÃO para a biblioteca de ações do Dossiê (pode ser null). */
  planSlug: string | null;
};

/** Média do score geral + por dimensão + nível + dimensão de maior risco. Config-driven.
 *  Acrescenta o Perfil de grupo (distribuição de pessoas por faixa) e a Matriz de
 *  Risco (R = P × S) — ambos derivados do MESMO conjunto de respostas já agregado,
 *  sem consulta extra e sem alterar nenhum dos campos que já saíam daqui. */
function aggregate(
  rows: Row[],
  dims: AggDim[],
  bands: AggBand[] | null,
  matrixRows: MatrixSource[] = [],
): {
  score: number;
  level: string;
  levelLabel?: string;
  levelColor?: string | null;
  byDimension: Record<string, number>;
  dimensionLabels: Record<string, string>;
  dimensionBands: DimensionBandMap;
  topRisk: string;
  profile: PsychosocialProfileRow[];
  riskMatrix: PsychosocialRiskMatrixRow[];
} {
  const score = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
  const byDimension: Record<string, number> = {};
  const dimensionLabels: Record<string, string> = {};
  const dimensionBands: DimensionBandMap = {};
  const valuesOf = (slug: string) =>
    rows.map((r) => Number((r.byDimension as Record<string, number>)?.[slug] ?? 0));
  for (const d of dims) {
    const vals = valuesOf(d.slug);
    const dv = Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
    byDimension[d.slug] = dv;
    dimensionLabels[d.slug] = d.label;
    const db = findBandForScore(bands ?? undefined, dv);
    if (db) dimensionBands[d.slug] = { code: db.code, label: db.label, color: db.color ?? null };
  }
  const topRisk = dims.reduce((min, d) => (byDimension[d.slug] < byDimension[min] ? d.slug : min), dims[0]?.slug ?? '');
  const band = findBandForScore(bands ?? undefined, score);

  // Faixas em ordem crescente: a PRIMEIRA é a crítica (menor pontuação = maior
  // risco, na régua de proteção). Sem faixas configuradas não há como dizer o que
  // é crítico — então nem perfil nem matriz são produzidos, em vez de chutar.
  const ordered = bands ? [...bands].sort((a, b) => a.min - b.min) : [];
  const inBand = (v: number, b: AggBand) => v >= b.min && v <= b.max;

  // Perfil de grupo: quantas PESSOAS caem em cada faixa, dimensão a dimensão.
  const profile: PsychosocialProfileRow[] = ordered.length
    ? dims.map((d) => {
        const vals = valuesOf(d.slug);
        return {
          slug: d.slug,
          label: d.label,
          respondents: vals.length,
          byBand: ordered.map((b) => {
            const count = vals.filter((v) => inBand(v, b)).length;
            return {
              code: b.code,
              label: b.label,
              count,
              percent: vals.length ? Math.round((count / vals.length) * 100) : 0,
            };
          }),
        };
      })
    : [];

  // Matriz de Risco: só ESCALAS (dimensão de topo) COM severidade parametrizada.
  // Escala sem severidade fica de fora — entrar com 0 produziria "aceitável" falso.
  const critical = ordered[0] ?? null;
  /** Valores do recorte para uma linha da matriz. No caminho FATOR lemos o
   *  `byFactor` gravado e DESCARTAMOS quem não tem o fator (resposta anterior ao
   *  cadastro) — contar como 0 viraria "100% crítico" e inflaria o risco. */
  const matrixValuesOf = (src: MatrixSource): number[] => {
    if (src.from === 'dimension') return valuesOf(src.sourceSlug);
    const out: number[] = [];
    for (const r of rows) {
      const map = r.byFactor as Record<string, number> | null | undefined;
      const v = map?.[src.sourceSlug];
      if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
    }
    return out;
  };

  /** POOL de exposições vinculadas à linha: todas as respostas válidas das
   *  perguntas do fator (ou da dimensão, no fallback) — §6.2 pede a média do
   *  conjunto, não a média das médias por respondente. */
  const exposuresOf = (src: MatrixSource): number[] => {
    const out: number[] = [];
    for (const r of rows) {
      const e = r.exposures;
      if (!e) continue;
      const list = src.from === 'factor' ? e.byFactor[src.sourceSlug] : e.byDimension[src.sourceSlug];
      if (list?.length) out.push(...list);
    }
    return out;
  };

  const riskMatrix: PsychosocialRiskMatrixRow[] = critical
    ? matrixRows
        .map((d) => {
          // Exposição (§6.1) → probabilidade por faixa + regra dos 60% (§6.2).
          const exposures = exposuresOf(d);
          const { probability, exposureAvg, highExposureCount } = psychosocialProbabilityFrom(exposures);
          // Mantido para leitura: quantos respondentes ficaram na faixa crítica.
          const vals = matrixValuesOf(d);
          const criticalCount = vals.filter((v) => inBand(v, critical)).length;
          const percentCritical = vals.length ? (criticalCount / vals.length) * 100 : 0;
          const severity = d.severity;
          const risk = probability * severity;
          const riskClass = psychosocialRiskClass(risk);
          return {
            slug: d.slug,
            label: d.label,
            // Chave da DIMENSÃO para a biblioteca de ações do Dossiê.
            sourceSlug: d.planSlug ?? d.slug,
            probabilitySource: d.from === 'factor' ? ('perguntas' as const) : ('dimensao' as const),
            criticalCount,
            respondents: vals.length,
            percentCritical: Math.round(percentCritical),
            exposureAvg: Math.round(exposureAvg * 100) / 100,
            highExposureCount,
            probability,
            severity,
            risk,
            riskClass,
            actionLabel: PSYCHOSOCIAL_RISK_CLASS_ACTION[riskClass],
            planRequired: PSYCHOSOCIAL_RISK_PLAN_REQUIRED[riskClass],
          };
        })
        // Linha sem nenhum respondente elegível (ex.: fator novo, respostas
        // antigas) não entra: probabilidade sobre zero respostas não é medida.
        // Sem nenhuma exposição válida não há probabilidade a medir (ex.: fator
        // novo, ou respostas sem versão pinada) — a linha não entra.
        .filter((r) => r.exposureAvg > 0)
        // Mesma ordenação do relatório de referência: maior risco primeiro.
        .sort((a, b) => b.risk - a.risk)
    : [];

  return {
    score,
    level: band?.code ?? psychosocialLevel(score),
    levelLabel: band?.label,
    levelColor: band?.color ?? null,
    byDimension,
    dimensionLabels,
    dimensionBands,
    topRisk,
    profile,
    riskMatrix,
  };
}
