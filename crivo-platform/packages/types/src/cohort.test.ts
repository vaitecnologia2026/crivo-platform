import { describe, expect, it } from 'vitest';
import {
  ageBandFromBirthYear,
  buildCohort,
  cohortIsEmpty,
  generationFromAgeBand,
  generationFromBirthYear,
  normalizeAgeBand,
  normalizeShift,
  normalizeWorkModel,
} from './cohort';

// Ajustes Finais de Homologação — Colaboradores/CSV: recortes novos, geração
// derivada pelo sistema, GHE informado pela empresa (nunca inferido).

describe('faixa etária e geração', () => {
  it('faixas de 10 anos pela idade no ano de referência', () => {
    expect(ageBandFromBirthYear(2004, 2026)).toBe('até 24'); // 22
    expect(ageBandFromBirthYear(2001, 2026)).toBe('25–34'); // 25
    expect(ageBandFromBirthYear(1990, 2026)).toBe('35–44'); // 36
    expect(ageBandFromBirthYear(1975, 2026)).toBe('45–54'); // 51
    expect(ageBandFromBirthYear(1960, 2026)).toBe('55+'); // 66
    expect(ageBandFromBirthYear(2030, 2026)).toBeNull(); // nascido no futuro
  });

  it('gerações pelos cortes do Pew (Boomer ≤1964, X ≤1980, Y ≤1996, Z ≤2012, Alpha)', () => {
    expect(generationFromBirthYear(1964)).toBe('Baby Boomer');
    expect(generationFromBirthYear(1965)).toBe('Geração X');
    expect(generationFromBirthYear(1980)).toBe('Geração X');
    expect(generationFromBirthYear(1981)).toBe('Geração Y');
    expect(generationFromBirthYear(1996)).toBe('Geração Y');
    expect(generationFromBirthYear(1997)).toBe('Geração Z');
    expect(generationFromBirthYear(2013)).toBe('Geração Alpha');
  });

  it('sem o ano, estima a geração pela faixa etária (ponto médio)', () => {
    expect(generationFromAgeBand('25–34', 2026)).toBe('Geração Y'); // 2026 − 30 = 1996
    expect(generationFromAgeBand('55+', 2026)).toBe('Geração X'); // 2026 − 60 = 1966
    expect(generationFromAgeBand(null, 2026)).toBeNull();
  });

  it('aceita variações de faixa do CSV', () => {
    expect(normalizeAgeBand('25-34')).toBe('25–34');
    expect(normalizeAgeBand('35 a 44')).toBe('35–44');
    expect(normalizeAgeBand('55 ou mais')).toBe('55+');
    expect(normalizeAgeBand('Até 24 anos')).toBe('até 24');
    expect(normalizeAgeBand('')).toBeNull();
  });
});

describe('listas fixas com tolerância', () => {
  it('turno', () => {
    expect(normalizeShift('noite')).toBe('Noite');
    expect(normalizeShift('NOTURNO')).toBe('Noite');
    expect(normalizeShift('Manhã ')).toBe('Manhã');
    expect(normalizeShift('revezamento')).toBe('Rotativo');
    expect(normalizeShift('12x36')).toBe('12x36'); // fora da lista: fica como veio
    expect(normalizeShift(undefined)).toBeNull();
  });
  it('modelo de trabalho', () => {
    expect(normalizeWorkModel('home office')).toBe('Remoto');
    expect(normalizeWorkModel('hibrido')).toBe('Híbrido');
    expect(normalizeWorkModel('Presencial')).toBe('Presencial');
    expect(normalizeWorkModel('Externo')).toBe('Externo');
  });
});

describe('buildCohort — o retrato que vai para a resposta', () => {
  const colaborador = {
    name: 'Maria da Silva',
    cpf: '52998224725',
    email: 'maria@empresa.com.br',
    phone: '11999990000',
    unit: 'Matriz',
    area: 'Operações',
    sector: 'Recursos Humanos',
    role: 'Analista',
    shift: 'noturno',
    ghe: null,
    manager: 'João',
    workModel: 'home office',
    gender: 'Feminino',
    birthYear: 1990,
    ageBand: null,
  };

  it('copia só os recortes — nunca nome, CPF, e-mail ou telefone', () => {
    const c = buildCohort(colaborador, 2026) as unknown as Record<string, unknown>;
    expect(c).not.toHaveProperty('name');
    expect(c).not.toHaveProperty('cpf');
    expect(c).not.toHaveProperty('email');
    expect(c).not.toHaveProperty('phone');
    expect(c.sector).toBe('Recursos Humanos');
    expect(c.shift).toBe('Noite');
    expect(c.workModel).toBe('Remoto');
    expect(c.ageBand).toBe('35–44');
    expect(c.generation).toBe('Geração Y');
  });

  it('GHE nunca é inferido de setor/área: sem cadastro, fica nulo', () => {
    expect(buildCohort(colaborador, 2026).ghe).toBeNull();
    expect(buildCohort({ ...colaborador, ghe: ' GHE-Operação ' }, 2026).ghe).toBe('GHE-Operação');
  });

  it('faixa informada vale quando não há ano de nascimento', () => {
    const c = buildCohort({ ...colaborador, birthYear: null, ageBand: '45-54' }, 2026);
    expect(c.ageBand).toBe('45–54');
    expect(c.generation).toBe('Geração X');
  });

  it('cadastro sem recorte nenhum gera retrato vazio', () => {
    expect(cohortIsEmpty(buildCohort({}))).toBe(true);
    expect(cohortIsEmpty(buildCohort({ sector: 'RH' }))).toBe(false);
  });
});
