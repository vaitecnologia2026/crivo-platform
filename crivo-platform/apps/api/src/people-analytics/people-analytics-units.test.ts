import { describe, expect, it } from 'vitest';
import { summarizeUnits } from './people-analytics.service';

/**
 * Fatia 6 — auditoria Programas vs. protótipo (17/09/2026), achado ALTA #1:
 * o filtro "Unidade" da tela precisa de dados REAIS do cadastro de
 * colaboradores (campo `unit`), nunca uma lista fixa/inventada. `summarizeUnits`
 * é a parte pura (testável sem banco) de GET /people-analytics/units.
 */
describe('summarizeUnits', () => {
  it('conta colaboradores por unidade, ordenado por quantidade desc e depois nome', () => {
    const rows = [
      { unit: 'SP' }, { unit: 'SP' }, { unit: 'RJ' }, { unit: 'Betim' }, { unit: 'Betim' }, { unit: 'Betim' },
    ];
    expect(summarizeUnits(rows)).toEqual([
      { unit: 'Betim', count: 3 },
      { unit: 'SP', count: 2 },
      { unit: 'RJ', count: 1 },
    ]);
  });

  it('empate na quantidade desempata por nome (ordem alfabética)', () => {
    const rows = [{ unit: 'RJ' }, { unit: 'SP' }, { unit: 'Betim' }];
    expect(summarizeUnits(rows).map((r) => r.unit)).toEqual(['Betim', 'RJ', 'SP']);
  });

  it('ignora unidade nula, vazia ou só espaço; apara espaços nas válidas', () => {
    const rows = [{ unit: null }, { unit: '' }, { unit: '   ' }, { unit: '  SP  ' }, { unit: 'SP' }];
    expect(summarizeUnits(rows)).toEqual([{ unit: 'SP', count: 2 }]);
  });

  it('sem colaboradores com unidade: lista vazia', () => {
    expect(summarizeUnits([])).toEqual([]);
    expect(summarizeUnits([{ unit: null }, { unit: '' }])).toEqual([]);
  });
});
