import { BadRequestException, Injectable } from '@nestjs/common';
import {
  computePeopleTrends,
  mergePeopleCatalog,
  PEOPLE_METHODOLOGICAL_ENTRIES,
  type PeopleCatalogEntry,
  type PeopleHeadcountByArea,
  type PeoplePeriod,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from '../admin/ai-settings.service';
import { AiPromptsService } from '../admin/ai-prompts.service';
import { SavePeopleAnalyticsDto, SavePeopleCatalogDto } from './dto';

type PeopleAnalysis = {
  summary: string;
  alerts: string[];
  hypotheses: string[];
  recommendations: string[];
};

/**
 * People Analytics (Fase 4 — §10/§14). Indicadores de RH por período (RLS por
 * tenant) + IA Analítica que interpreta os indicadores + o contexto CRIVO,
 * gerando alertas/hipóteses/recomendações — sem afirmar causalidade.
 */
@Injectable()
export class PeopleAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiSettingsService,
    private readonly prompts: AiPromptsService,
  ) {}

  async get(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.peopleAnalyticsData.findUnique({ where: { tenantId } });
      return {
        periods: (row?.periods as unknown as PeoplePeriod[]) ?? [],
        analysis: (row?.analysis as PeopleAnalysis | null) ?? null,
        analysisAt: row?.analysisAt ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async save(tenantId: string, dto: SavePeopleAnalyticsDto, actor?: string) {
    // Coage os valores para número | null (a tela manda números, mas garantimos).
    const periods = dto.periods.map((p) => ({
      period: p.period,
      headcount: p.headcount == null ? null : Number(p.headcount),
      values: Object.fromEntries(
        Object.entries(p.values ?? {}).map(([k, v]) => [k, v == null || (v as unknown) === '' ? null : Number(v)]),
      ),
      // Recorte por área (opcional): guarda limpo; a supressão n<5 é no render.
      headcountByArea: sanitizeHeadcountByArea(p.headcountByArea),
    }));
    return this.prisma.forTenant(tenantId, async (tx) => {
      const data = { periods: periods as unknown as object, updatedBy: actor ?? null };
      const row = await tx.peopleAnalyticsData.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
      return {
        periods: row.periods as unknown as PeoplePeriod[],
        analysis: (row.analysis as PeopleAnalysis | null) ?? null,
        analysisAt: row.analysisAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  /** Catálogo efetivo: scores metodológicos (fixos) + indicadores fixos com os
   *  metadados do tenant + customizados. Só metadados — nunca valores. */
  async getCatalog(tenantId: string): Promise<{ entries: PeopleCatalogEntry[]; updatedAt: Date | null }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.peopleAnalyticsData.findUnique({ where: { tenantId } });
      return {
        entries: mergePeopleCatalog((row?.catalog as unknown as PeopleCatalogEntry[] | null) ?? null),
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  /**
   * Grava o catálogo do tenant. Regra de governança: natureza 'Score
   * metodológico' é READ-ONLY aqui (vem do ICD/NR-1 — People Analytics nunca
   * escreve em score metodológico), e as chaves desses scores não podem ser
   * reaproveitadas por indicador customizado.
   */
  async saveCatalog(tenantId: string, dto: SavePeopleCatalogDto, actor?: string) {
    const entries = validateCatalogEntries(dto.entries);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.peopleAnalyticsData.upsert({
        where: { tenantId },
        create: { tenantId, periods: [], catalog: entries as unknown as object, updatedBy: actor ?? null },
        update: { catalog: entries as unknown as object, updatedBy: actor ?? null },
      });
      return {
        entries: mergePeopleCatalog(row.catalog as unknown as PeopleCatalogEntry[]),
        updatedAt: row.updatedAt,
      };
    });
  }

  async analyze(tenantId: string, context: string | undefined, actor?: string) {
    // Respeita o interruptor GLOBAL de IA (governança/custo): se a IA estiver
    // desativada em Configurações de IA, não chama (nem cobra) a OpenAI.
    const settings = await this.ai.get();
    if (!settings.enabled) {
      throw new BadRequestException('IA desativada nas Configurações de IA (Super Admin).');
    }
    // Respeita o escopo de módulos da IA (vazio = todos liberados).
    if (settings.enabledModules.length > 0 && !settings.enabledModules.includes('analytics')) {
      throw new BadRequestException('IA não está habilitada para People Analytics em Configurações de IA.');
    }
    const key = await this.ai.getApiKey();
    if (!key) {
      throw new BadRequestException('IA não configurada. Defina a chave da OpenAI em Configurações de IA (Super Admin).');
    }
    const current = await this.prisma.forTenant(tenantId, async (tx) =>
      tx.peopleAnalyticsData.findUnique({ where: { tenantId } }),
    );
    const periods = (current?.periods as unknown as PeoplePeriod[]) ?? [];
    if (!periods.length) {
      throw new BadRequestException('Adicione ao menos um período de indicadores antes de gerar a análise.');
    }
    const analysis = await this.callOpenAi(tenantId, periods, context);
    const saved = await this.prisma.forTenant(tenantId, async (tx) =>
      tx.peopleAnalyticsData.update({
        where: { tenantId },
        data: { analysis: analysis as unknown as object, analysisAt: new Date(), updatedBy: actor ?? null },
      }),
    );
    return { analysis, analysisAt: saved.analysisAt };
  }

  private async callOpenAi(tenantId: string, periods: PeoplePeriod[], context?: string): Promise<PeopleAnalysis> {
    const trends = computePeopleTrends(periods);
    const indicatorsTxt = trends.trends
      .map((t) => {
        const val = t.latest == null ? '—' : `${t.latest}${t.unit === '%' ? '%' : ` ${t.unit}`}`;
        const delta = t.delta == null ? '' : ` (Δ ${t.delta > 0 ? '+' : ''}${t.delta}, ${t.direction}${t.good === false ? ', desfavorável' : t.good ? ', favorável' : ''})`;
        return `- ${t.label}: ${val}${delta}`;
      })
      .join('\n');

    const system = await this.prompts.resolve('people_analytics');
    const user =
      `Indicadores de RH (último período: ${trends.latestPeriod ?? '—'}, ${trends.periodsCount} período(s)):\n${indicatorsTxt}\n\n` +
      `Contexto CRIVO da empresa (diagnóstico/risco psicossocial/custos/plano):\n${context?.trim() || '(não informado)'}\n\nGere a análise.`;

    // Modelo vem das Configurações de IA (era hardcoded gpt-4o-mini — corrigido
    // na centralização do motor de IA).
    const r = await this.ai.chat({
      useCase: 'people_analytics',
      tenantId,
      temperature: 0.4,
      timeoutMs: 45000,
      responseFormat: 'json_object',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    if (!r.ok) {
      if (r.kind === 'timeout' || r.kind === 'network') {
        throw new BadRequestException('A IA demorou demais para responder. Tente novamente.');
      }
      if (r.kind === 'no_key') {
        throw new BadRequestException('IA não configurada. Defina a chave da OpenAI em Configurações de IA (Super Admin).');
      }
      if (r.kind !== 'empty') {
        throw new BadRequestException('A IA não conseguiu gerar a análise agora. Tente novamente.');
      }
    }
    const content = r.ok ? r.content : '{}';
    let parsed: Partial<PeopleAnalysis> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content };
    }
    const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).slice(0, 12) : []);
    return {
      summary: String(parsed.summary ?? ''),
      alerts: arr(parsed.alerts),
      hypotheses: arr(parsed.hypotheses),
      recommendations: arr(parsed.recommendations),
    };
  }
}

/** Limpa o recorte por área: área sem nome ou n inválido cai fora; ausente vira null. */
export function sanitizeHeadcountByArea(
  input: PeopleHeadcountByArea[] | null | undefined,
): PeopleHeadcountByArea[] | null {
  if (!input || !Array.isArray(input)) return null;
  const out = input
    .map((a) => ({ area: String(a.area ?? '').trim(), n: Number(a.n) }))
    .filter((a) => a.area.length > 0 && Number.isFinite(a.n) && a.n >= 0)
    .map((a) => ({ area: a.area, n: Math.round(a.n) }));
  return out.length ? out : null;
}

/**
 * Regras do PUT /people-analytics/catalog (puras, testáveis):
 *  - nenhuma entrada pode ter nature SCORE_METODOLOGICO (read-only);
 *  - chave de score metodológico (icd, psicossocial) não pode ser usada;
 *  - chaves únicas; campos de texto aparados; `builtin` nunca é gravado.
 * Devolve só o que o tenant pode gravar (entradas IMPORTADO).
 */
export function validateCatalogEntries(entries: SavePeopleCatalogDto['entries']): PeopleCatalogEntry[] {
  const methodological = new Set(PEOPLE_METHODOLOGICAL_ENTRIES.map((e) => e.key));
  const seen = new Set<string>();
  const out: PeopleCatalogEntry[] = [];
  for (const e of entries) {
    const key = e.key.trim();
    if (e.nature === 'SCORE_METODOLOGICO') {
      throw new BadRequestException(
        `"${e.name}": indicadores de natureza "Score metodológico" vêm do ICD/NR-1 e não podem ser editados em People Analytics.`,
      );
    }
    if (methodological.has(key)) {
      throw new BadRequestException(`A chave "${key}" é reservada a um score metodológico.`);
    }
    if (seen.has(key)) {
      throw new BadRequestException(`Indicador duplicado no catálogo: "${key}".`);
    }
    seen.add(key);
    const txt = (v: string | null | undefined, max: number) => {
      const t = (v ?? '').trim();
      return t ? t.slice(0, max) : null;
    };
    out.push({
      key,
      name: e.name.trim(),
      category: e.category.trim() || 'Geral',
      formula: txt(e.formula, 400),
      unit: txt(e.unit, 30),
      source: txt(e.source, 120),
      period: txt(e.period, 60),
      frequency: txt(e.frequency, 40),
      owner: txt(e.owner, 120),
      version: txt(e.version, 20),
      confidence: (e.confidence as PeopleCatalogEntry['confidence']) ?? null,
      slices: txt(e.slices, 160),
      status: e.status as PeopleCatalogEntry['status'],
      nature: 'IMPORTADO',
    });
  }
  return out;
}
