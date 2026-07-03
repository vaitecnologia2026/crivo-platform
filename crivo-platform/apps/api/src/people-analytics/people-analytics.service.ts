import { BadRequestException, Injectable } from '@nestjs/common';
import { computePeopleTrends, type PeoplePeriod } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from '../admin/ai-settings.service';
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
    const analysis = await this.callOpenAi(key, periods, context);
    const saved = await this.prisma.forTenant(tenantId, async (tx) =>
      tx.peopleAnalyticsData.update({
        where: { tenantId },
        data: { analysis: analysis as unknown as object, analysisAt: new Date(), updatedBy: actor ?? null },
      }),
    );
    return { analysis, analysisAt: saved.analysisAt };
  }

  private async callOpenAi(key: string, periods: PeoplePeriod[], context?: string): Promise<PeopleAnalysis> {
    const trends = computePeopleTrends(periods);
    const indicatorsTxt = trends.trends
      .map((t) => {
        const val = t.latest == null ? '—' : `${t.latest}${t.unit === '%' ? '%' : ` ${t.unit}`}`;
        const delta = t.delta == null ? '' : ` (Δ ${t.delta > 0 ? '+' : ''}${t.delta}, ${t.direction}${t.good === false ? ', desfavorável' : t.good ? ', favorável' : ''})`;
        return `- ${t.label}: ${val}${delta}`;
      })
      .join('\n');

    const system =
      'Você é analista de People Analytics da CRIVO. Interprete os indicadores de RH e o contexto da empresa, gerando ALERTAS objetivos, HIPÓTESES (possíveis causas a investigar) e RECOMENDAÇÕES práticas, além de um RESUMO executivo curto (2-4 frases). ' +
      'Regras: NUNCA afirme causalidade automática nem economia garantida; trate tudo como apoio à decisão; seja objetivo, em português do Brasil. ' +
      'Responda APENAS em JSON válido: {"summary": string, "alerts": string[], "hypotheses": string[], "recommendations": string[]}.';
    const user =
      `Indicadores de RH (último período: ${trends.latestPeriod ?? '—'}, ${trends.periodsCount} período(s)):\n${indicatorsTxt}\n\n` +
      `Contexto CRIVO da empresa (diagnóstico/risco psicossocial/custos/plano):\n${context?.trim() || '(não informado)'}\n\nGere a análise.`;

    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw new BadRequestException('A IA demorou demais para responder. Tente novamente.');
    }
    if (!res.ok) throw new BadRequestException('A IA não conseguiu gerar a análise agora. Tente novamente.');
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content ?? '{}';
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
