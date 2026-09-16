import 'reflect-metadata'; // decorators do class-validator fora do contexto do Nest
import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { computePeopleTrends, mergePeopleCatalog, PEOPLE_INDICATORS, type PeoplePeriod } from '@crivo/types';
import { sanitizeHeadcountByArea, validateCatalogEntries } from './people-analytics.service';
import { SavePeopleAnalyticsDto, SavePeopleCatalogDto } from './dto';

/**
 * Fatia 6 — People Analytics. O que estes testes prendem:
 *  (1) headcountByArea é opcional por período, validado e limpo; NÃO entra em
 *      computePeopleTrends (cálculo intacto);
 *  (2) o catálogo é só metadado: 'Score metodológico' é read-only (recusado no
 *      PUT), chaves de score reservadas, chaves únicas; o GET mescla fixos +
 *      overrides do tenant + customizados sem perder os fixos.
 */

const periodo = (extra: Record<string, unknown> = {}) => ({
  period: '2026-Q1', headcount: 120, values: { turnover: 12.5, absenteismo: 4.1 }, ...extra,
});

describe('SavePeopleAnalyticsDto — headcount por área', () => {
  it('período sem headcountByArea continua válido (payload antigo)', () => {
    expect(validateSync(plainToInstance(SavePeopleAnalyticsDto, { periods: [periodo()] }))).toHaveLength(0);
  });

  it('aceita lista de {area, n}', () => {
    const dto = plainToInstance(SavePeopleAnalyticsDto, { periods: [periodo({ headcountByArea: [{ area: 'Operações', n: 80 }, { area: 'TI', n: 3 }] })] });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('recusa n negativo e área não textual', () => {
    const neg = plainToInstance(SavePeopleAnalyticsDto, { periods: [periodo({ headcountByArea: [{ area: 'TI', n: -1 }] })] });
    expect(validateSync(neg).length).toBeGreaterThan(0);
    const semNome = plainToInstance(SavePeopleAnalyticsDto, { periods: [periodo({ headcountByArea: [{ area: 12, n: 5 }] })] });
    expect(validateSync(semNome).length).toBeGreaterThan(0);
  });

  it('sanitizeHeadcountByArea: apara nomes, arredonda n, descarta vazios; lista vazia vira null', () => {
    expect(sanitizeHeadcountByArea([{ area: ' TI ', n: 4.6 }, { area: '', n: 9 }, { area: 'RH', n: Number.NaN }])).toEqual([{ area: 'TI', n: 5 }]);
    expect(sanitizeHeadcountByArea([])).toBeNull();
    expect(sanitizeHeadcountByArea(undefined)).toBeNull();
  });

  it('computePeopleTrends ignora headcountByArea (cálculo intacto)', () => {
    const sem: PeoplePeriod[] = [{ period: '2026-Q1', values: { turnover: 10 } }, { period: '2026-Q2', values: { turnover: 12 } }];
    const com: PeoplePeriod[] = sem.map((p) => ({ ...p, headcountByArea: [{ area: 'Operações', n: 50 }] }));
    expect(computePeopleTrends(com)).toEqual(computePeopleTrends(sem));
  });
});

const entrada = (extra: Record<string, unknown> = {}) => ({
  key: 'enps', name: 'eNPS', category: 'Engajamento', status: 'RASCUNHO', nature: 'IMPORTADO', ...extra,
});

describe('SavePeopleCatalogDto — forma', () => {
  it('entrada mínima válida (nome, categoria, status, natureza)', () => {
    expect(validateSync(plainToInstance(SavePeopleCatalogDto, { entries: [entrada()] }))).toHaveLength(0);
  });

  it('status e confiança fora das listas são recusados', () => {
    expect(validateSync(plainToInstance(SavePeopleCatalogDto, { entries: [entrada({ status: 'Validado' })] })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(SavePeopleCatalogDto, { entries: [entrada({ confidence: 'Alta' })] })).length).toBeGreaterThan(0);
  });

  it('chave só com letras, números, _ e - (vira coluna da tabela de períodos)', () => {
    expect(validateSync(plainToInstance(SavePeopleCatalogDto, { entries: [entrada({ key: 'e nps' })] })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(SavePeopleCatalogDto, { entries: [entrada({ key: 'tempo_casa-2' })] }))).toHaveLength(0);
  });
});

describe('validateCatalogEntries — regras de governança', () => {
  it("'Score metodológico' é read-only: qualquer entrada com essa natureza é recusada", () => {
    expect(() => validateCatalogEntries([entrada({ key: 'icd', nature: 'SCORE_METODOLOGICO' }) as never]))
      .toThrow(BadRequestException);
    expect(() => validateCatalogEntries([entrada({ key: 'meu', nature: 'SCORE_METODOLOGICO' }) as never]))
      .toThrow(/Score metodológico/);
  });

  it('chave de score metodológico (icd, psicossocial) não pode virar indicador importado', () => {
    expect(() => validateCatalogEntries([entrada({ key: 'icd' }) as never])).toThrow(/reservada/);
    expect(() => validateCatalogEntries([entrada({ key: 'psicossocial' }) as never])).toThrow(/reservada/);
  });

  it('chave duplicada é recusada', () => {
    expect(() => validateCatalogEntries([entrada() as never, entrada({ name: 'Outro' }) as never])).toThrow(/duplicado/);
  });

  it('apara textos, força nature IMPORTADO e não grava builtin', () => {
    const out = validateCatalogEntries([entrada({ key: ' enps ', source: '  Pesquisa  ', formula: '', builtin: true, confidence: 'ALTA' }) as never]);
    expect(out).toEqual([{
      key: 'enps', name: 'eNPS', category: 'Engajamento', formula: null, unit: null, source: 'Pesquisa', period: null,
      frequency: null, owner: null, version: null, confidence: 'ALTA', slices: null, status: 'RASCUNHO', nature: 'IMPORTADO',
    }]);
    expect(out[0]).not.toHaveProperty('builtin');
  });
});

describe('mergePeopleCatalog', () => {
  it('sem nada gravado: scores metodológicos + todos os PEOPLE_INDICATORS como Rascunho/Importado', () => {
    const cat = mergePeopleCatalog(null);
    expect(cat.filter((e) => e.nature === 'SCORE_METODOLOGICO').map((e) => e.key)).toEqual(['icd', 'psicossocial']);
    for (const d of PEOPLE_INDICATORS) {
      expect(cat.find((e) => e.key === d.key)).toMatchObject({ name: d.label, unit: d.unit, status: 'RASCUNHO', nature: 'IMPORTADO', builtin: true });
    }
  });

  it('override do tenant num fixo só troca metadados; customizado entra como builtin=false; nunca sobrescreve score', () => {
    const cat = mergePeopleCatalog([
      { key: 'turnover', name: 'Turnover anualizado', category: 'População', status: 'VALIDADO', nature: 'IMPORTADO', source: 'Sistema RH', version: 'v1.3' },
      { key: 'enps', name: 'eNPS', category: 'Engajamento', status: 'RASCUNHO', nature: 'IMPORTADO' },
      { key: 'icd', name: 'ICD hackeado', category: 'x', status: 'RASCUNHO', nature: 'IMPORTADO' },
    ]);
    expect(cat.find((e) => e.key === 'turnover')).toMatchObject({ name: 'Turnover anualizado', status: 'VALIDADO', source: 'Sistema RH', version: 'v1.3', unit: '%', builtin: true });
    expect(cat.find((e) => e.key === 'enps')).toMatchObject({ builtin: false, nature: 'IMPORTADO' });
    expect(cat.find((e) => e.key === 'icd')).toMatchObject({ name: 'ICD oficial (ciclo trimestral)', nature: 'SCORE_METODOLOGICO' });
    expect(cat.filter((e) => e.key === 'icd')).toHaveLength(1);
    // Nenhum fixo some por causa do override.
    expect(cat.filter((e) => e.builtin && e.nature === 'IMPORTADO')).toHaveLength(PEOPLE_INDICATORS.length);
  });
});
