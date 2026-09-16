import 'reflect-metadata'; // decorators do class-validator fora do contexto do Nest
import { describe, expect, it } from 'vitest';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { formatDurationMin } from '@crivo/types';
import { CreateLibraryItemDto, UpdateLibraryItemDto, LIBRARY_MAX_DURATION_MIN } from './dto';

/**
 * Fatia 6 — Academia e Recursos: carga (minutos) e nível são opcionais (o
 * acervo antigo continua válido), `null` limpa, e a formatação do card sai
 * dos minutos ("45 min", "1h", "1h30", "8h") — o protótipo tinha texto livre.
 */
describe('CreateLibraryItemDto / UpdateLibraryItemDto — carga e nível', () => {
  const base = { title: 'Fundamentos de Liderança', kind: 'curso' };

  it('sem carga/nível continua válido', () => {
    expect(validateSync(plainToInstance(CreateLibraryItemDto, base))).toHaveLength(0);
  });

  it('aceita minutos inteiros positivos e nível da lista; null limpa', () => {
    expect(validateSync(plainToInstance(CreateLibraryItemDto, { ...base, durationMin: 480, level: 'AVANCADO' }))).toHaveLength(0);
    expect(validateSync(plainToInstance(UpdateLibraryItemDto, { durationMin: null, level: null }))).toHaveLength(0);
  });

  it('recusa carga zero, fracionária ou acima do teto de sanidade', () => {
    expect(validateSync(plainToInstance(CreateLibraryItemDto, { ...base, durationMin: 0 })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(CreateLibraryItemDto, { ...base, durationMin: 45.5 })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(CreateLibraryItemDto, { ...base, durationMin: LIBRARY_MAX_DURATION_MIN + 1 })).length).toBeGreaterThan(0);
  });

  it('recusa nível fora de BASICO/INTERMEDIARIO/AVANCADO (rótulo em vez de código)', () => {
    expect(validateSync(plainToInstance(CreateLibraryItemDto, { ...base, level: 'Básico' })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(UpdateLibraryItemDto, { level: 'expert' })).length).toBeGreaterThan(0);
  });
});

describe('formatDurationMin', () => {
  it('formata minutos como o card do protótipo', () => {
    expect(formatDurationMin(45)).toBe('45 min');
    expect(formatDurationMin(60)).toBe('1h');
    expect(formatDurationMin(90)).toBe('1h30');
    expect(formatDurationMin(480)).toBe('8h');
  });

  it('sem carga não inventa texto', () => {
    expect(formatDurationMin(null)).toBeNull();
    expect(formatDurationMin(0)).toBeNull();
    expect(formatDurationMin(undefined)).toBeNull();
  });
});
