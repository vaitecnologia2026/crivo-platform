import { describe, it, expect } from 'vitest';
import { normalizeCpf, isValidCpf, formatCpf } from './index';

describe('CPF (colaboradores)', () => {
  it('normaliza para 11 dígitos', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizeCpf(' 529 982 247 25 ')).toBe('52998224725');
    expect(normalizeCpf(null)).toBe('');
    expect(normalizeCpf('5299822472599999')).toBe('52998224725'); // trunca em 11
  });

  it('valida CPFs corretos (com e sem máscara)', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('rejeita dígito verificador errado, tamanho errado e sequências repetidas', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false); // DV errado
    expect(isValidCpf('123')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf(null)).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });

  it('formata para exibição', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('529')).toBe('529'); // incompleto: devolve como está
  });
});
