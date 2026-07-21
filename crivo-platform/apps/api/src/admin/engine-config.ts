import type { ScoreAggregationMode } from '@crivo/types';
import type { PrismaService } from '../prisma/prisma.service';

const GLOBAL = 'global';

/** Piso de anonimato: nunca revelar um agregado de menos de 3 respondentes (LGPD). */
export const MIN_RESPONDENTS_FLOOR = 3;
export const MIN_RESPONDENTS_CEIL = 100;

export type EngineConfigValues = {
  minRespondents: number;
  defaultAggregation: ScoreAggregationMode;
  defaultBandKind: 'MATURITY' | 'RISK';
  defaultScaleLabels: string[];
  defaultRounding: number;
  defaultMinValidCompletionPercent: number;
  updatedAt: Date | null;
};

/**
 * Configuração do Motor (singleton scope='global'). É AQUI que o Super Admin
 * DEFINE como o motor funciona — e estes valores TOMAM EFEITO no cálculo:
 * `minRespondents` governa a supressão de anonimato das agregações; os
 * `default*` viram o ponto de partida de todo diagnóstico novo. Não é um
 * portal de atalhos para os motores; é o painel de regras do motor.
 *
 * Lê o singleton criando-o de forma preguiçosa (a migração já semeia a linha;
 * o create é só uma rede de segurança para ambientes sem o seed).
 */
export async function getEngineConfig(prisma: PrismaService): Promise<EngineConfigValues> {
  // rls-allow: singleton GLOBAL do control plane — não é tenant-scoped.
  let row = await prisma.admin.engineConfig.findUnique({ where: { scope: GLOBAL } });
  if (!row) {
    try {
      row = await prisma.admin.engineConfig.create({ data: { scope: GLOBAL } });
    } catch {
      // corrida na criação preguiçosa (unique em scope) — relê o vencedor
      row = await prisma.admin.engineConfig.findUnique({ where: { scope: GLOBAL } });
    }
  }
  return {
    minRespondents: row?.minRespondents ?? 5,
    defaultAggregation: (row?.defaultAggregation ?? 'MEDIA_PONDERADA') as ScoreAggregationMode,
    defaultBandKind: (row?.defaultBandKind ?? 'MATURITY') as 'MATURITY' | 'RISK',
    defaultScaleLabels: row?.defaultScaleLabels ?? [],
    defaultRounding: row?.defaultRounding ?? 1,
    defaultMinValidCompletionPercent: row?.defaultMinValidCompletionPercent ?? 70,
    updatedAt: row?.updatedAt ?? null,
  };
}
