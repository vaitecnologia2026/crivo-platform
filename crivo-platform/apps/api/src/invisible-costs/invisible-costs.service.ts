import { Injectable } from '@nestjs/common';
import { DEFAULT_COST_SCENARIOS, INVISIBLE_COST_PRESETS } from '@crivo/types';
import { PrismaService } from '../prisma/prisma.service';
import { SaveInvisibleCostsDto } from './dto';

/**
 * Custos Invisíveis (Fase 2 — §10/§14). Estimativa gerencial do custo oculto por
 * empresa: itens (variação × volume × custo unitário) + cenários (faixa) + nível
 * de confiança. Um registro por tenant (upsert). Tudo sob RLS (forTenant).
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
          isDefault: false,
        };
      }
      return {
        items: INVISIBLE_COST_PRESETS,
        scenarios: DEFAULT_COST_SCENARIOS,
        confidence: 'MEDIA',
        notes: null,
        updatedAt: null,
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
        isDefault: false,
      };
    });
  }
}
