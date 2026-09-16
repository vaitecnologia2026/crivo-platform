import 'reflect-metadata'; // decorators do class-validator fora do contexto do Nest
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { computeInvisibleCosts, type InvisibleCostItem } from '@crivo/types';
import { InvisibleCostsService } from './invisible-costs.service';
import { CreateCostSnapshotDto, SaveInvisibleCostsDto } from './dto';

/**
 * Fatia 6 — Radar de Custos Invisíveis. O que estes testes prendem:
 *  (1) os metadados de governança por item (natureza, fonte, fórmula, período,
 *      responsável, versão, última validação, confiança) são OPCIONAIS e
 *      validados — um payload antigo (sem eles) continua aceito;
 *  (2) o snapshot ("Congelar como ciclo") copia a estimativa SALVA e grava os
 *      totais de computeInvisibleCosts daquele instante — nunca dados do corpo,
 *      nunca o modelo padrão não salvo;
 *  (3) computeInvisibleCosts ignora os campos novos (cálculo intacto).
 */

const TENANT = 'org-1';
const ATOR = { id: 'user-1', name: 'Renata Dias', email: 'renata@empresa.com' };

const itemBase = { key: 'turnover', label: 'Reposição (turnover)', variation: 18, volume: 1, unitCost: 9000 };

function payload(extraItem: Record<string, unknown> = {}) {
  return {
    items: [{ ...itemBase, ...extraItem }],
    scenarios: { conservador: 1.3, moderado: 1, otimista: 0.7 },
    confidence: 'MEDIA',
  };
}

describe('SaveInvisibleCostsDto — governança por item', () => {
  it('payload antigo (sem metadados) continua válido', () => {
    expect(validateSync(plainToInstance(SaveInvisibleCostsDto, payload()))).toHaveLength(0);
  });

  it('aceita a ficha completa do componente', () => {
    const dto = plainToInstance(SaveInvisibleCostsDto, payload({
      nature: 'ESTIMADO', source: 'Folha · RH', formula: 'saídas × custo de reposição', period: '12m móveis',
      owner: 'RH · Ana', version: 'v1.2', validatedAt: '2026-08-31', confidence: 'ALTA',
    }));
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('recusa natureza fora de Observado/Estimado/Hipótese', () => {
    const erros = validateSync(plainToInstance(SaveInvisibleCostsDto, payload({ nature: 'CHUTE' })));
    expect(JSON.stringify(erros)).toContain('nature');
  });

  it('recusa confiança por item fora de ALTA/MEDIA/BAIXA', () => {
    const erros = validateSync(plainToInstance(SaveInvisibleCostsDto, payload({ confidence: 'Alta' })));
    expect(JSON.stringify(erros)).toContain('confidence');
  });

  it('última validação precisa ser AAAA-MM-DD (o que o input date manda)', () => {
    expect(validateSync(plainToInstance(SaveInvisibleCostsDto, payload({ validatedAt: '31/08/2026' }))).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(SaveInvisibleCostsDto, payload({ validatedAt: '2026-08-31' })))).toHaveLength(0);
  });

  it('rótulo do snapshot é obrigatório e limitado a 60 caracteres', () => {
    expect(validateSync(plainToInstance(CreateCostSnapshotDto, { label: '' })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(CreateCostSnapshotDto, { label: 'x'.repeat(61) })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(CreateCostSnapshotDto, { label: '2026.1' }))).toHaveLength(0);
  });
});

describe('computeInvisibleCosts ignora os metadados novos', () => {
  it('mesmo total com e sem natureza/fonte/confiança no item', () => {
    const sem: InvisibleCostItem[] = [itemBase];
    const com: InvisibleCostItem[] = [{ ...itemBase, nature: 'HIPOTESE', confidence: 'BAIXA', source: 'x', formula: 'y' }];
    expect(computeInvisibleCosts(com).total).toEqual(computeInvisibleCosts(sem).total);
  });
});

describe('InvisibleCostsService.createSnapshot', () => {
  function montar(estimativa: Record<string, unknown> | null) {
    const criados: Record<string, unknown>[] = [];
    const tx = {
      invisibleCostEstimate: { findUnique: vi.fn(async () => estimativa) },
      invisibleCostSnapshot: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          criados.push(args.data);
          return { id: 'snap-1', createdByName: args.data.createdByName, createdAt: new Date('2026-09-16T12:00:00Z'), ...args.data };
        }),
        findMany: vi.fn(async () => []),
      },
    };
    const prisma = { forTenant: vi.fn(async (_t: string, fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    return { svc: new InvisibleCostsService(prisma as never), tx, criados };
  }

  const salva = {
    items: [itemBase, { key: 'absenteismo', label: 'Absenteísmo', variation: 600, volume: 1, unitCost: 205, nature: 'OBSERVADO' }],
    scenarios: { conservador: 1.3, moderado: 1, otimista: 0.7 },
    confidence: 'ALTA',
  };

  it('sem estimativa salva (modelo padrão) recusa — histórico nunca nasce de número não validado', async () => {
    const { svc, criados } = montar(null);
    await expect(svc.createSnapshot(TENANT, { label: '2026.1' }, ATOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(criados).toHaveLength(0);
  });

  it('estimativa sem itens também recusa', async () => {
    const { svc, criados } = montar({ ...salva, items: [] });
    await expect(svc.createSnapshot(TENANT, { label: '2026.1' }, ATOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(criados).toHaveLength(0);
  });

  it('rótulo só com espaços é recusado antes de tocar no banco', async () => {
    const { svc, tx } = montar(salva);
    await expect(svc.createSnapshot(TENANT, { label: '   ' }, ATOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.invisibleCostEstimate.findUnique).not.toHaveBeenCalled();
  });

  it('congela itens, cenários e confiança SALVOS com os totais de computeInvisibleCosts', async () => {
    const { svc, criados } = montar(salva);
    const out = await svc.createSnapshot(TENANT, { label: ' 2026.1 ' }, ATOR);
    const esperado = computeInvisibleCosts(salva.items as InvisibleCostItem[], salva.scenarios).total;
    expect(criados[0]).toMatchObject({
      tenantId: TENANT, label: '2026.1', confidence: 'ALTA',
      createdByUserId: 'user-1', createdByName: 'Renata Dias',
    });
    expect(criados[0].totals).toEqual(esperado);
    expect(criados[0].items).toEqual(salva.items);
    expect(criados[0].scenarios).toEqual(salva.scenarios);
    // O que volta para a tela: totais + contagem + quem congelou.
    expect(out).toMatchObject({ id: 'snap-1', label: '2026.1', itemsCount: 2, createdByName: 'Renata Dias', totals: esperado });
    expect(esperado.moderado).toBe(18 * 9000 + 600 * 205);
  });
});
