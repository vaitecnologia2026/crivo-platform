import { describe, expect, it } from 'vitest';
import { acessoBody, alsoLeaderHint, contextLabelsFor, leaderFlagFor } from './usuario-acesso';

const checklist = ['dashboard', 'icd', 'usuarios'];

describe('contextos mostrados na lista de usuários', () => {
  it('somente Líder → só Minha Jornada', () => {
    expect(contextLabelsFor({ role: 'LIDER', isLeader: true })).toEqual(['Minha Jornada']);
    // Mesmo sem a marcação gravada, o papel LIDER já é líder.
    expect(contextLabelsFor({ role: 'LIDER', isLeader: false })).toEqual(['Minha Jornada']);
  });

  it('somente Administrador → só Área da Organização', () => {
    expect(contextLabelsFor({ role: 'ADMIN', isLeader: false })).toEqual(['Área da Organização']);
  });

  it('Líder + Administrador → os dois, na ordem do seletor', () => {
    expect(contextLabelsFor({ role: 'ADMIN', isLeader: true })).toEqual([
      'Minha Jornada',
      'Área da Organização',
    ]);
  });
});

describe('isLeader enviado no cadastro', () => {
  it('papel LIDER nunca manda isLeader (muito menos false)', () => {
    expect(leaderFlagFor('LIDER', false)).toBeUndefined();
    expect(leaderFlagFor('LIDER', true)).toBeUndefined();
  });

  it('outro papel manda a caixa explícita', () => {
    expect(leaderFlagFor('GESTOR', true)).toBe(true);
    expect(leaderFlagFor('GESTOR', false)).toBe(false);
  });

  it('a ajuda nomeia o papel acumulado', () => {
    expect(alsoLeaderHint('Administrador')).toBe(
      'Líder + Administrador: um login, dois contextos — Minha Jornada e Área da Organização.',
    );
  });
});

describe('corpo de createUser/updateUser', () => {
  it('LIDER: sem isLeader e sem screenAccess (checklist não se aplica)', () => {
    const r = acessoBody({ role: 'LIDER', alsoLeader: false, allScreens: false, screens: [], checklist });
    expect(r).toEqual({ body: {} });
  });

  it('corporativo marcado como líder, sem restrição de telas', () => {
    const r = acessoBody({ role: 'ADMIN', alsoLeader: true, allScreens: true, screens: ['icd'], checklist });
    expect(r).toEqual({ body: { isLeader: true, screenAccess: null } });
  });

  it('corporativo desmarcado manda isLeader=false e as telas marcadas', () => {
    const r = acessoBody({ role: 'RH', alsoLeader: false, allScreens: false, screens: ['icd'], checklist });
    expect(r).toEqual({ body: { isLeader: false, screenAccess: ['icd'] } });
  });

  it('rotas antigas fora da checklist seguem gravadas, mas não contam como tela escolhida', () => {
    expect(
      acessoBody({ role: 'GESTOR', alsoLeader: true, allScreens: false, screens: ['pocket'], checklist }),
    ).toEqual({ error: 'Selecione ao menos uma tela da Área da Organização ou marque “Acesso a todas”.' });

    expect(
      acessoBody({ role: 'GESTOR', alsoLeader: true, allScreens: false, screens: ['pocket', 'dashboard'], checklist }),
    ).toEqual({ body: { isLeader: true, screenAccess: ['pocket', 'dashboard'] } });
  });
});
