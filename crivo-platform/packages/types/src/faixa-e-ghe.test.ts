import { describe, expect, it } from 'vitest';
import { findBandForScore, nomeDoGhe, rotuloDoGhe } from './index';

// Faixas inteiras do Diagnóstico Organizacional/Essencial ativos em produção
// (mesmas da Massa Ouro). O score tem 1 casa, então há VÃO entre as faixas:
// 49,1–49,9 · 64,1–64,9 · 79,1–79,9.
const FAIXAS = [
  { code: 'ATENCAO_CRITICA', label: 'Atenção crítica', min: 0, max: 49, color: '#c75b4e' },
  { code: 'VULNERAVEL', label: 'Vulnerável', min: 50, max: 64, color: '#d9903d' },
  { code: 'EM_ESTRUTURACAO', label: 'Em estruturação', min: 65, max: 79, color: '#d6b44c' },
  { code: 'ESTRUTURADO', label: 'Estruturado', min: 80, max: 100, color: '#5e8b68' },
];
const faixa = (v: number) => findBandForScore(FAIXAS, v)?.label;

describe('findBandForScore — regra de arredondamento homologada', () => {
  it('reproduz o modelo oficial de 23/09: 79,6 é Estruturado (e com a cor dele)', () => {
    expect(faixa(79.6)).toBe('Estruturado');
    expect(findBandForScore(FAIXAS, 79.6)?.color).toBe('#5e8b68');
    expect(faixa(77.3)).toBe('Em estruturação');
    expect(faixa(76)).toBe('Em estruturação');
    expect(faixa(62.2)).toBe('Vulnerável');
    expect(faixa(63.8)).toBe('Vulnerável');
    expect(faixa(55.3)).toBe('Vulnerável');
  });

  it('no vão, lê o score arredondado: abaixo de ,5 fica, a partir de ,5 sobe', () => {
    expect(faixa(79.4)).toBe('Em estruturação');
    expect(faixa(79.5)).toBe('Estruturado');
    expect(faixa(64.4)).toBe('Vulnerável');
    expect(faixa(64.5)).toBe('Em estruturação');
    expect(faixa(49.4)).toBe('Atenção crítica');
    expect(faixa(49.5)).toBe('Vulnerável');
  });

  it('o vão do MEIO não cai mais na última faixa (antes 64,6 saía "Estruturado")', () => {
    expect(faixa(64.6)).not.toBe('Estruturado');
    expect(faixa(49.6)).not.toBe('Estruturado');
  });

  it('limites exatos e pontas fora da régua', () => {
    expect(faixa(80)).toBe('Estruturado');
    expect(faixa(79)).toBe('Em estruturação');
    expect(faixa(0)).toBe('Atenção crítica');
    expect(faixa(100)).toBe('Estruturado');
    expect(faixa(100.4)).toBe('Estruturado');
    expect(faixa(-1)).toBe('Atenção crítica');
  });

  it('faixas com limite decimal (sem vão) seguem exatas', () => {
    const decimais = [
      { code: 'A', label: 'A', min: 0, max: 24.9 },
      { code: 'B', label: 'B', min: 25, max: 49.9 },
    ];
    expect(findBandForScore(decimais, 24.9)?.label).toBe('A');
    expect(findBandForScore(decimais, 25)?.label).toBe('B');
  });

  it('sem faixas, nada', () => {
    expect(findBandForScore([], 50)).toBeUndefined();
    expect(findBandForScore(undefined, 50)).toBeUndefined();
  });
});

describe('nome do GHE no Dossiê', () => {
  it('tira o prefixo que a empresa digitou junto (massa ouro: "GHE-Recursos Humanos")', () => {
    expect(nomeDoGhe('GHE-Recursos Humanos')).toBe('Recursos Humanos');
    expect(nomeDoGhe('GHE - Operações')).toBe('Operações');
    expect(nomeDoGhe('ghe: Financeiro')).toBe('Financeiro');
    expect(nomeDoGhe('GHE Operações')).toBe('Operações');
  });

  it('não mexe em nome sem prefixo, nem em palavra que só começa com "Ghe"', () => {
    expect(nomeDoGhe('Operações')).toBe('Operações');
    expect(nomeDoGhe('Ghelfi Logística')).toBe('Ghelfi Logística');
    expect(nomeDoGhe('  Financeiro ')).toBe('Financeiro');
  });

  it('nunca devolve vazio', () => {
    expect(nomeDoGhe('GHE')).toBe('GHE');
  });

  it('rótulo do modelo: "GHE - <nome>"', () => {
    expect(rotuloDoGhe('GHE-Recursos Humanos')).toBe('GHE - Recursos Humanos');
    expect(rotuloDoGhe('Operações')).toBe('GHE - Operações');
  });
});
