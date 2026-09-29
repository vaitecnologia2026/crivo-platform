import { describe, expect, it } from 'vitest';
import { contextsFor, initialContext, isLeaderUser } from './contextos';

// Spec V1 v1.2 §3: Somente Líder → Minha Jornada; Somente Administrador → Área
// da Organização; Líder + Administrador → os dois, com seletor.
describe('contextos do cliente', () => {
  it('somente Líder abre só Minha Jornada', () => {
    expect(contextsFor({ role: 'LIDER' })).toEqual(['JORNADA']);
    // A marcação não dá Área da Organização a quem não tem papel corporativo.
    expect(contextsFor({ role: 'LIDER', isLeader: false })).toEqual(['JORNADA']);
  });

  it('somente Administrador abre só a Área da Organização', () => {
    expect(contextsFor({ role: 'ADMIN' })).toEqual(['ORGANIZACAO']);
    expect(contextsFor({ role: 'RH', isLeader: false })).toEqual(['ORGANIZACAO']);
    expect(isLeaderUser({ role: 'CEO', isLeader: null })).toBe(false);
  });

  it('papel corporativo marcado como líder tem os dois contextos, Jornada primeiro', () => {
    expect(contextsFor({ role: 'ADMIN', isLeader: true })).toEqual(['JORNADA', 'ORGANIZACAO']);
    expect(contextsFor({ role: 'GESTOR', isLeader: true })).toEqual(['JORNADA', 'ORGANIZACAO']);
  });

  it('entra no último contexto escolhido só se ainda tiver direito a ele', () => {
    expect(initialContext(['JORNADA', 'ORGANIZACAO'], 'ORGANIZACAO')).toBe('ORGANIZACAO');
    expect(initialContext(['JORNADA', 'ORGANIZACAO'], null)).toBe('JORNADA');
    // Deixou de ser líder: o contexto lembrado não vale mais.
    expect(initialContext(['ORGANIZACAO'], 'JORNADA')).toBe('ORGANIZACAO');
    expect(initialContext(['JORNADA'], 'qualquer')).toBe('JORNADA');
  });
});
