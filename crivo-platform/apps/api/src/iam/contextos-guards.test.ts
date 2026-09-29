import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { SessionUser } from '@crivo/types';
import { LeaderGuard } from './guards/leader.guard';
import { OrganizacaoGuard } from './guards/organizacao.guard';
import { AuthGuard } from './guards/auth.guard';
import { MeController } from './me.controller';
import { DecisionsController } from '../decisions/decisions.controller';
import { CopilotoController } from '../copiloto/copiloto.controller';
import { ROLES_KEY } from './roles.decorator';

/**
 * Spec V1 v1.2 §3 — dois contextos no mesmo login. O que estes testes prendem:
 * (1) Minha Jornada (decisão, ICD próprio, Pocket, Mentor) só atende quem é
 * líder — papel LIDER ou marcado como líder; "Somente Administrador" leva 403;
 * (2) a Área da Organização barra o perfil Líder e não muda nada para os demais
 * papéis; (3) as rotas que o shell lê na entrada, para qualquer papel, seguem
 * abertas — senão o login do líder quebraria.
 */

const user = (role: string, isLeader?: boolean): SessionUser =>
  ({ id: 'u1', tenantId: 't1', email: 'x@empresa.com', name: 'X', role, isLeader }) as SessionUser;

const ctxDe = (u?: SessionUser) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user: u }) }) }) as unknown as ExecutionContext;

const guardsOf = (target: object) => (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];

describe('LeaderGuard — Minha Jornada', () => {
  const guard = new LeaderGuard();

  it('LIDER passa (mesmo sem a marcação gravada)', () => {
    expect(guard.canActivate(ctxDe(user('LIDER')))).toBe(true);
    expect(guard.canActivate(ctxDe(user('LIDER', false)))).toBe(true);
  });

  it('ADMIN marcado como líder passa (Líder + Administrador)', () => {
    expect(guard.canActivate(ctxDe(user('ADMIN', true)))).toBe(true);
    expect(guard.canActivate(ctxDe(user('GESTOR', true)))).toBe(true);
  });

  it('ADMIN sem a marcação leva 403 com mensagem clara (Somente Administrador)', () => {
    expect(() => guard.canActivate(ctxDe(user('ADMIN', false)))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctxDe(user('ADMIN')))).toThrow(
      'Área exclusiva de Minha Jornada: disponível para líderes.',
    );
  });

  it('COLABORADOR (e sessão ausente) leva 403', () => {
    expect(() => guard.canActivate(ctxDe(user('COLABORADOR')))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctxDe(undefined))).toThrow(ForbiddenException);
  });
});

describe('OrganizacaoGuard — Área da Organização', () => {
  const guard = new OrganizacaoGuard();

  it('LIDER leva 403 (Somente Líder não vê a Área da Organização)', () => {
    expect(() => guard.canActivate(ctxDe(user('LIDER', true)))).toThrow(
      'Área da Organização indisponível para o perfil Líder.',
    );
  });

  it('ADMIN passa — com ou sem a marcação de líder', () => {
    expect(guard.canActivate(ctxDe(user('ADMIN')))).toBe(true);
    expect(guard.canActivate(ctxDe(user('ADMIN', true)))).toBe(true);
  });

  it('JURIDICO passa (os demais papéis não mudam)', () => {
    expect(guard.canActivate(ctxDe(user('JURIDICO')))).toBe(true);
  });
});

describe('Rotas privadas do líder — cerca do LeaderGuard', () => {
  const proto = DecisionsController.prototype as unknown as Record<string, object>;

  it('decisões e o ICD da decisão exigem ser líder, depois do AuthGuard da classe', () => {
    expect(guardsOf(DecisionsController)[0]).toBe(AuthGuard);
    for (const m of ['list', 'get', 'create', 'update', 'remove', 'submitIcd', 'getIcd']) {
      expect(guardsOf(proto[m])).toContain(LeaderGuard);
    }
  });

  it('os catálogos (categorias, públicos, P1–P8) seguem como estavam', () => {
    for (const m of ['listCategories', 'createCategory', 'listAudiences', 'createAudience', 'icdQuestions']) {
      expect(guardsOf(proto[m])).not.toContain(LeaderGuard);
    }
    expect(Reflect.getMetadata(ROLES_KEY, proto.createCategory)).toEqual(['RH', 'GESTOR', 'CEO', 'ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, proto.createAudience)).toEqual(['RH', 'GESTOR', 'CEO', 'ADMIN']);
  });

  it('o Mentor CRIVO (copiloto) é da Jornada: AuthGuard e depois LeaderGuard', () => {
    expect(guardsOf(CopilotoController)).toEqual([AuthGuard, LeaderGuard]);
  });
});

describe('/me — o que é da Área da Organização e o que o shell lê na entrada', () => {
  const proto = MeController.prototype as unknown as Record<string, object>;

  it('dado corporativo leva o OrganizacaoGuard', () => {
    for (const m of ['myGroupOverview', 'myOnboardingStatus', 'organizationOverview', 'updateOrganization', 'updateBranding']) {
      expect(guardsOf(proto[m])).toContain(OrganizacaoGuard);
    }
  });

  it('rotas de entrada do shell (qualquer papel) ficam abertas', () => {
    for (const m of [
      'myRole', 'myModules', 'myPermissions', 'myScreens', 'myBranding', 'myOrganization',
      'diagnosticContext', 'myMentorias', 'myGlobalAcademy', 'myTerms', 'acceptTerms',
    ]) {
      expect(guardsOf(proto[m])).not.toContain(OrganizacaoGuard);
    }
  });
});
