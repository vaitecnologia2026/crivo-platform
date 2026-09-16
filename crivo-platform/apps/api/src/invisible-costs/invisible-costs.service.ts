import { BadRequestException, Injectable } from '@nestjs/common';
import {
  computeInvisibleCosts,
  DEFAULT_COST_SCENARIOS,
  INVISIBLE_COST_PRESETS,
  type CostConfidence,
  type InvisibleCostItem,
  type InvisibleCostScenarios,
  type InvisibleCostSnapshotData,
} from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCostSnapshotDto, SaveInvisibleCostsDto } from './dto';

/** Linha do snapshot como sai do Prisma (só o que o mapeamento usa). */
type SnapshotRow = {
  id: string;
  label: string;
  items: unknown;
  scenarios: unknown;
  confidence: string;
  totals: unknown;
  createdByName: string | null;
  createdAt: Date;
};

/**
 * Custos Invisíveis (Fase 2 — §10/§14). Estimativa gerencial do custo oculto por
 * empresa: itens (variação × volume × custo unitário) + cenários (faixa) + nível
 * de confiança. Um registro por tenant (upsert). Tudo sob RLS (forTenant).
 *
 * Fatia 6: os itens ganharam metadados de governança (natureza, fonte, fórmula,
 * período, responsável, versão, última validação, confiança) — só rótulos — e
 * o histórico passou a existir como snapshots ("Congelar como ciclo").
 */
@Injectable()
export class InvisibleCostsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Estimativa atual da empresa — ou um padrão editável (presets) se ainda não houver. */
  async get(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.invisibleCostEstimate.findUnique({ where: { tenantId } });
      if (row) {
        return {
          items: row.items,
          scenarios: row.scenarios,
          confidence: row.confidence,
          notes: row.notes,
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
          isDefault: false,
        };
      }
      return {
        items: INVISIBLE_COST_PRESETS,
        scenarios: DEFAULT_COST_SCENARIOS,
        confidence: 'MEDIA',
        notes: null,
        updatedAt: null,
        updatedBy: null,
        isDefault: true,
      };
    });
  }

  /** Salva (cria/atualiza) a estimativa da empresa. */
  async save(tenantId: string, dto: SaveInvisibleCostsDto, actor?: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const data = {
        items: dto.items as unknown as object,
        scenarios: dto.scenarios as unknown as object,
        confidence: dto.confidence ?? 'MEDIA',
        notes: dto.notes ?? null,
        updatedBy: actor ?? null,
      };
      const row = await tx.invisibleCostEstimate.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
      return {
        items: row.items,
        scenarios: row.scenarios,
        confidence: row.confidence,
        notes: row.notes,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        isDefault: false,
      };
    });
  }

  /** Histórico congelado, do mais antigo ao mais novo (série "Evolução do total"). */
  async listSnapshots(tenantId: string): Promise<InvisibleCostSnapshotData[]> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.invisibleCostSnapshot.findMany({ orderBy: { createdAt: 'asc' } });
      return rows.map(toSnapshotData);
    });
  }

  /**
   * "Congelar como ciclo": copia a estimativa SALVA (itens + cenários +
   * confiança) e grava os totais calculados por computeInvisibleCosts naquele
   * instante. Exige estimativa salva — o modelo padrão (presets) não vira
   * histórico, senão o gráfico mostraria um número que a empresa nunca validou.
   */
  async createSnapshot(
    tenantId: string,
    dto: CreateCostSnapshotDto,
    actor?: { id?: string; name?: string | null; email?: string },
  ): Promise<InvisibleCostSnapshotData> {
    const label = dto.label.trim();
    if (!label) throw new BadRequestException('Informe o rótulo do ciclo (ex.: 2026.1).');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const current = await tx.invisibleCostEstimate.findUnique({ where: { tenantId } });
      if (!current) {
        throw new BadRequestException('Salve a estimativa antes de congelar um ciclo.');
      }
      const items = (current.items as unknown as InvisibleCostItem[]) ?? [];
      if (items.length === 0) {
        throw new BadRequestException('A estimativa não tem itens — nada para congelar.');
      }
      const scenarios = (current.scenarios as unknown as InvisibleCostScenarios) ?? DEFAULT_COST_SCENARIOS;
      const totals = computeInvisibleCosts(items, scenarios).total;
      const row = await tx.invisibleCostSnapshot.create({
        data: {
          tenantId,
          label,
          items: items as unknown as object,
          scenarios: scenarios as unknown as object,
          confidence: current.confidence,
          totals: totals as unknown as object,
          createdByUserId: actor?.id ?? null,
          createdByName: actor?.name ?? actor?.email ?? null,
        },
      });
      return toSnapshotData(row);
    });
  }
}

function toSnapshotData(row: SnapshotRow): InvisibleCostSnapshotData {
  const items = (row.items as InvisibleCostItem[]) ?? [];
  return {
    id: row.id,
    label: row.label,
    items,
    scenarios: row.scenarios as InvisibleCostScenarios,
    confidence: row.confidence as CostConfidence,
    totals: row.totals as InvisibleCostSnapshotData['totals'],
    itemsCount: items.length,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}
