import { describe, expect, it } from 'vitest';

import {
  EMPTY_SHEET_MARKER,
  buildContextLine,
  buildFileName,
  buildIdentificationRows,
  buildTable,
  cellText,
  prepareSheets,
  sanitizeFileName,
} from './exports-core';

const CTX_COMPLETO = {
  company: 'Horizonte S.A.',
  unit: 'Matriz — São Paulo',
  cycle: 'Ciclo 2026.2',
  contract: 'Essencial + NR-1',
};

// Carimbo fixo para o teste não depender do relógio.
const GERADO_EM = new Date(2026, 8, 16, 14, 5); // 16/09/2026 14:05 (mês zero-based)

describe('aba Identificação', () => {
  it('lista empresa, unidade, ciclo, contratação e gerado em — sem aviso de protótipo', () => {
    const rows = buildIdentificationRows(CTX_COMPLETO, GERADO_EM);
    expect(rows[0]).toEqual(['CRIVO · Portal do Cliente']);
    expect(rows).toContainEqual(['Empresa', 'Horizonte S.A.']);
    expect(rows).toContainEqual(['Unidade', 'Matriz — São Paulo']);
    expect(rows).toContainEqual(['Ciclo', 'Ciclo 2026.2']);
    expect(rows).toContainEqual(['Contratação', 'Essencial + NR-1']);
    expect(rows.at(-1)?.[0]).toBe('Gerado em');
    const texto = JSON.stringify(rows).toLowerCase();
    expect(texto).not.toContain('protótipo');
    expect(texto).not.toContain('demonstrativ');
  });

  it('omite o que a empresa não tem, sem inventar valor', () => {
    const rows = buildIdentificationRows({ company: 'Só Empresa' }, GERADO_EM);
    const labels = rows.map((r) => r[0]);
    expect(labels).toEqual(['CRIVO · Portal do Cliente', 'Empresa', 'Gerado em']);
    expect(JSON.stringify(rows)).not.toContain('—');
  });

  it('usa `source` na 1ª linha quando informado (Super Admin) e cai no portal quando vazio', () => {
    expect(buildIdentificationRows({ company: 'X', source: 'CRIVO · Super Admin' }, GERADO_EM)[0]).toEqual(['CRIVO · Super Admin']);
    expect(buildIdentificationRows({ company: 'X', source: '   ' }, GERADO_EM)[0]).toEqual(['CRIVO · Portal do Cliente']);
  });
});

describe('linha de contexto do PDF', () => {
  it('junta só os campos presentes com " · "', () => {
    expect(buildContextLine(CTX_COMPLETO)).toBe('Horizonte S.A. · Matriz — São Paulo · Ciclo 2026.2 · Essencial + NR-1');
    expect(buildContextLine({ company: 'X', cycle: 'C1' })).toBe('X · C1');
    expect(buildContextLine({ company: 'X', unit: '   ', contract: null })).toBe('X');
  });
});

describe('montagem das abas do XLSX', () => {
  it('Identificação vem primeiro; aba vazia vira "(sem dados)"; com linhas vira json', () => {
    const abas = prepareSheets(
      { company: 'X' },
      [
        { name: 'Ações', rows: [{ Título: 'A', Status: 'Aberta' }] },
        { name: 'Evidências', rows: [] },
      ],
      GERADO_EM,
    );
    expect(abas.map((a) => a.name)).toEqual(['Identificação', 'Ações', 'Evidências']);
    expect(abas[0].kind).toBe('aoa');
    expect(abas[1]).toMatchObject({ kind: 'json', json: [{ Título: 'A', Status: 'Aberta' }] });
    expect(abas[2]).toMatchObject({ kind: 'aoa', aoa: [[EMPTY_SHEET_MARKER]] });
  });

  it('trunca o nome da aba a 31 caracteres (limite do Excel) e desambigua repetidos', () => {
    const longo = 'Indicadores de pessoas por unidade e período'; // > 31
    const abas = prepareSheets({ company: 'X' }, [
      { name: longo, rows: [] },
      { name: longo, rows: [] },
      { name: 'identificação', rows: [] }, // colide (case-insensitive) com a primeira aba
    ], GERADO_EM);
    for (const a of abas) expect(a.name.length).toBeLessThanOrEqual(31);
    expect(abas[1].name).toBe(longo.slice(0, 31));
    expect(abas[2].name).toBe(`${longo.slice(0, 27)} (2)`);
    expect(abas[3].name).toBe('identificação (2)');
    expect(new Set(abas.map((a) => a.name.toLowerCase())).size).toBe(abas.length);
  });
});

describe('tabela do PDF', () => {
  it('colunas pela primeira linha; célula ausente/nula vira vazio; bool vira Sim/Não', () => {
    const { columns, body } = buildTable([
      { Nome: 'A', Ativo: true, Nota: 7 },
      { Nome: 'B', Ativo: false, Nota: null },
      { Nome: 'C' },
    ]);
    expect(columns).toEqual(['Nome', 'Ativo', 'Nota']);
    expect(body).toEqual([['A', 'Sim', '7'], ['B', 'Não', ''], ['C', '', '']]);
    expect(buildTable([])).toEqual({ columns: [], body: [] });
    expect(cellText(undefined)).toBe('');
  });
});

describe('nome do arquivo', () => {
  it('sanitiza (sem acento/símbolo) e carimba data-hora', () => {
    expect(sanitizeFileName('Plano de Ação — Ciclo 2026/2')).toBe('plano-de-acao-ciclo-2026-2');
    expect(buildFileName('Plano de Ação', 'xlsx', GERADO_EM)).toBe('plano-de-acao-20260916-1405.xlsx');
    expect(buildFileName('!!!', 'pdf', GERADO_EM)).toBe('exportacao-20260916-1405.pdf');
  });
});
