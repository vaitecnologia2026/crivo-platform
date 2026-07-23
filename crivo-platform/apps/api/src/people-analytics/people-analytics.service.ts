import { BadRequestException, Injectable } from '@nestjs/common';
import { computePeopleTrends, type PeoplePeriod } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from '../admin/ai-settings.service';
import { AiPromptsService } from '../admin/ai-prompts.service';
import { SavePeopleAnalyticsDto } from './dto';

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
