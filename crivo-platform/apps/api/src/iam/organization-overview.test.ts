import { describe, expect, it } from 'vitest';
import { percentuais, resumoDaOrganizacao, SEM_AREA, type ColaboradorDoPainel } from './organization-overview';

const c = (unit: string | null, area: string | null, manager: string | null = null, sector: string | null = null): ColaboradorDoPainel => ({
  unit,
  area,
  manager,
  sector,
});

describe('painel "Minha Organização" (cadastro de colaboradores)', () => {
  it('percentuais inteiros somam 100', () => {
    expect(percentuais([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentuais([7, 6, 6]).reduce((s, p) => s + p, 0)).toBe(100);
    expect(percentuais([0, 0])).toEqual([0, 0]);
  });

  it('agrupa área sem diferenciar maiúsculas; sector cobre cadastro sem área', () => {
    const r = resumoDaOrganizacao(
      [c('Matriz', 'Operações'), c('Matriz', 'operações '), c('Matriz', null, null, 'Financeiro'), c(null, null)],
      null,
    );
    expect(r.collaborators).toBe(4);
    expect(r.areas).toBe(2);
    expect(r.distribution).toEqual([
      { area: 'Operações', people: 2, percent: 50 },
      { area: 'Financeiro', people: 1, percent: 25 },
      { area: SEM_AREA, people: 1, percent: 25 },
    ]);
  });

  it('unidade: pessoas, áreas distintas e gestor só quando é um só', () => {
    const r = resumoDaOrganizacao(
      [
        c('Matriz — São Paulo', 'Operações', 'João Costa'),
        c('Matriz — São Paulo', 'Comercial', 'joão costa'),
        c('Filial — Rio', 'Operações', 'Ana Rocha'),
        c('Filial — Rio', 'Operações', 'Paulo Neves'),
        c('Filial — Rio', 'Operações'),
        c(null, 'Operações'),
      ],
      '  Ciclo 2026.2 ',
    );
    expect(r.units).toEqual([
      { name: 'Filial — Rio', people: 3, areas: 1, manager: null, managers: 2 },
      { name: 'Matriz — São Paulo', people: 2, areas: 2, manager: 'João Costa', managers: 1 },
    ]);
    expect(r.withoutUnit).toBe(1);
    expect(r.activeCycle).toBe('Ciclo 2026.2');
  });

  it('mais de 8 áreas: as 7 maiores + "Outras áreas (N)"', () => {
    const lista = Array.from({ length: 10 }, (_, i) => Array.from({ length: 10 - i }, () => c(null, `Área ${i}`))).flat();
    const r = resumoDaOrganizacao(lista, null);
    expect(r.areas).toBe(10);
    expect(r.distribution).toHaveLength(8);
    expect(r.distribution[7]).toMatchObject({ area: 'Outras áreas (3)', people: 3 + 2 + 1 });
    expect(r.distribution.reduce((s, d) => s + d.percent, 0)).toBe(100);
  });

  it('cadastro vazio não inventa número', () => {
    expect(resumoDaOrganizacao([], null)).toEqual({
      collaborators: 0,
      areas: 0,
      distribution: [],
      units: [],
      withoutUnit: 0,
      activeCycle: null,
    });
  });
});
