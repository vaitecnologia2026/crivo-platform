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

/**
 * Mínimo de respondentes EFETIVO de uma empresa: o valor próprio dela quando
 * definido, senão o padrão global. Existe para a microempresa — com o padrão 5,
 * uma empresa de 3 funcionários nunca veria resultado nenhum.
 *
 * O piso de anonimato (MIN_RESPONDENTS_FLOOR) é aplicado mesmo aqui: por mais
 * baixo que o admin configure, um agregado nunca é revelado abaixo dele. Quem
 * responde no painel (autoavaliação do gestor) também conta para esse total.
 */
export async function resolveMinRespondents(
  prisma: PrismaService,
  tenantId: string,
): Promise<number> {
  const globalMin = (await getEngineConfig(prisma)).minRespondents;
  // rls-allow: leitura pontual do parâmetro da PRÓPRIA empresa do contexto.
  const org = await prisma.admin.organization.findUnique({
    where: { id: tenantId },
    select: { minRespondents: true },
  });
  const own = org?.minRespondents;
  if (own == null) return globalMin;
  return Math.max(MIN_RESPONDENTS_FLOOR, Math.min(MIN_RESPONDENTS_CEIL, own));
}
