import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ROLES, type Role, type SessionUser } from '@crivo/types';
import { AuthGuard } from './guards/auth.guard';
import { OrganizacaoGuard } from './guards/organizacao.guard';
import { RolesGuard } from './guards/roles.guard';
import { ROLES_KEY } from './roles.decorator';
import { SCREEN_KEY } from './require-screen.decorator';
import { PERMS_KEY } from './require-permission.decorator';
import { TenantRolesController } from './tenant-roles.controller';
import { ActionPlansController } from '../action-plans/action-plans.controller';
import { AiGovernanceController } from '../ai-governance/ai-governance.controller';
import { AlertsController } from '../alerts/alerts.controller';
import { CollaboratorsController } from '../collaborators/collaborators.controller';
import { PublicCollaboratorsController } from '../collaborators/public-collaborators.controller';
import { ClientErrorsController } from '../common/client-errors.controller';
import { ContextController } from '../context/context.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { PublicDiagnosticsController } from '../diagnostics/public-diagnostics.controller';
import { EssencialController } from '../essencial/essencial.controller';
import { HealthController } from '../health/health.controller';
import { IcdController } from '../icd/icd.controller';
import { PublicCampaignsController } from '../icd/public-campaigns.controller';
import { InvisibleCostsController } from '../invisible-costs/invisible-costs.controller';
import { LeadsController } from '../leads/leads.controller';
import { LibraryController } from '../library/library.controller';
import { PushTokensController } from '../notifications/push-tokens.controller';
import { ParecerController } from '../parecer/parecer.controller';
import { PeopleAnalyticsController } from '../people-analytics/people-analytics.controller';
import { PsychosocialController } from '../psychosocial/psychosocial.controller';
import { PublicPsychosocialController } from '../psychosocial/public-psychosocial.controller';
import { UsersController } from '../users/users.controller';
import { WorkforceController } from '../workforce/workforce.controller';

/**
 * Spec V1 v1.2 §3 — "Somente Líder" não vê a Área da Organização, nem por URL
 * ou API. A cerca é o OrganizacaoGuard (nega só o papel LIDER). O que estes
 * testes prendem:
 *   - os controllers inteiramente corporativos têm o guard na CLASSE, logo
 *     depois do AuthGuard (a mensagem clara vem antes de módulo/permissão);
 *   - nos controllers mistos, o guard está nas rotas corporativas e FORA das
 *     que a Jornada usa (Academia em leitura) ou que servem a quem responde;
 *   - varredura: toda rota autenticada destes controllers ou barra o Líder
 *     (guard ou @Roles efetivo sem LIDER) ou está na lista explícita de
 *     abertas. Rota nova sem cerca quebra aqui, e não em produção.
 */

type Ctor = { name: string; prototype: object };

const guardsOf = (target: object) => (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];
const handler = (c: Ctor, m: string) => (c.prototype as Record<string, object>)[m];
const rotasDe = (c: Ctor) =>
  Object.getOwnPropertyNames(c.prototype).filter(
    (m) => m !== 'constructor' && Reflect.getMetadata(PATH_METADATA, handler(c, m)) !== undefined,
  );
const temGuardOrganizacao = (c: Ctor, m: string) =>
  guardsOf(c).includes(OrganizacaoGuard) || guardsOf(handler(c, m)).includes(OrganizacaoGuard);

/** @Roles efetivo (rota sobrepõe a classe, como no RolesGuard) — só vale com o RolesGuard ativo. */
function rolesBarramLider(c: Ctor, m: string): boolean {
  const comRolesGuard = guardsOf(c).includes(RolesGuard) || guardsOf(handler(c, m)).includes(RolesGuard);
  const roles = (Reflect.getMetadata(ROLES_KEY, handler(c, m)) ?? Reflect.getMetadata(ROLES_KEY, c)) as
    | Role[]
    | undefined;
  return comRolesGuard && !!roles && roles.length > 0 && !roles.includes('LIDER');
}

const barraLider = (c: Ctor, m: string) => temGuardOrganizacao(c, m) || rolesBarramLider(c, m);

/** Controllers 100% da Área da Organização: guard na classe. */
const CORPORATIVOS: Ctor[] = [
  AiGovernanceController,
  AlertsController,
  CollaboratorsController,
  ContextController,
  DashboardController,
  EssencialController,
  IcdController,
  InvisibleCostsController,
  LeadsController,
  ParecerController,
  PeopleAnalyticsController,
  TenantRolesController,
  // Administração › Usuários: um papel customizado com users:* dado a um
  // LIDER não pode abrir a lista, o cadastro nem a troca de papel pela API.
  UsersController,
  WorkforceController,
];

/** Controllers mistos: guard só nas rotas corporativas. */
const POR_ROTA: Array<[Ctor, string[]]> = [
  [LibraryController, ['create', 'update', 'remove', 'importFromGlobal']],
  [PsychosocialController, ['results', 'recortes', 'getLink', 'ensureLink']],
];

/** Rotas autenticadas que continuam abertas ao Líder, cada uma com o motivo. */
const ABERTAS: Record<string, string> = {
  'LibraryController.list': 'Academia de Minha Jornada (GET /library, só leitura)',
  'PsychosocialController.questions': 'questionário de quem responde (como o link /q)',
  'PsychosocialController.submit': 'resposta anônima de quem responde (como o link /q)',
  'ActionPlansController.addEvidence': 'H-008: responsável vinculado à ação; o serviço confere',
  'ActionPlansController.uploadEvidence': 'H-008: responsável vinculado à ação; o serviço confere',
  'ActionPlansController.downloadEvidence': 'H-008: responsável vinculado à ação; o serviço confere',
  'PushTokensController.register': 'token do próprio dispositivo (neutro)',
  'PushTokensController.remove': 'token do próprio dispositivo (neutro)',
};

/** Todos os controllers de portal (com AuthGuard) desta frente — a varredura corre em todos. */
const PORTAL: Ctor[] = [
  ...CORPORATIVOS,
  ...POR_ROTA.map(([c]) => c),
  ActionPlansController,
  PushTokensController,
];

/** Rotas públicas (sem sessão): o guard as derrubaria para todo mundo. */
const PUBLICOS: Ctor[] = [
  PublicCollaboratorsController,
  PublicDiagnosticsController,
  PublicCampaignsController,
  PublicPsychosocialController,
  HealthController,
  ClientErrorsController,
];

function ctxCom(user: Partial<SessionUser> | undefined): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;
}

describe('OrganizacaoGuard — só o perfil Líder fica fora', () => {
  const guard = new OrganizacaoGuard();

  it('nega o papel LIDER com 403 e mensagem clara', () => {
    expect(() => guard.canActivate(ctxCom({ id: 'u1', role: 'LIDER' }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctxCom({ id: 'u1', role: 'LIDER', isLeader: true }))).toThrow(
      'Área da Organização indisponível para o perfil Líder.',
    );
  });

  it('libera todos os demais papéis, inclusive o corporativo marcado como líder', () => {
    for (const role of ROLES.filter((r) => r !== 'LIDER')) {
      expect(guard.canActivate(ctxCom({ id: 'u1', role })), role).toBe(true);
      expect(guard.canActivate(ctxCom({ id: 'u1', role, isLeader: true })), `${role}+líder`).toBe(true);
    }
  });
});

describe('Área da Organização na API — controllers corporativos', () => {
  it.each(CORPORATIVOS.map((c) => [c.name, c] as const))('%s tem o guard na classe, logo depois do AuthGuard', (_n, c) => {
    const guards = guardsOf(c);
    expect(guards[0]).toBe(AuthGuard);
    expect(guards[1]).toBe(OrganizacaoGuard);
    expect(rotasDe(c).length).toBeGreaterThan(0);
  });

  it.each(POR_ROTA.map(([c, rotas]) => [c.name, c, rotas] as const))(
    '%s: guard só nas rotas corporativas (a classe não o tem)',
    (_n, c, rotas) => {
      expect(guardsOf(c)).not.toContain(OrganizacaoGuard);
      expect(guardsOf(c)[0]).toBe(AuthGuard);
      for (const m of rotas) expect(guardsOf(handler(c, m)), m).toContain(OrganizacaoGuard);
      for (const m of rotasDe(c).filter((r) => !rotas.includes(r))) {
        expect(guardsOf(handler(c, m)), m).not.toContain(OrganizacaoGuard);
      }
    },
  );

  it('Plano de Evolução: toda rota fora da evidência barra o Líder por @Roles (com RolesGuard na classe)', () => {
    expect(guardsOf(ActionPlansController)).toContain(RolesGuard);
    const evidencia = ['addEvidence', 'uploadEvidence', 'downloadEvidence'];
    for (const m of rotasDe(ActionPlansController).filter((r) => !evidencia.includes(r))) {
      expect(rolesBarramLider(ActionPlansController, m), m).toBe(true);
    }
  });
});

describe('Rotas que continuam abertas ao Líder', () => {
  it('Academia (GET /library) segue aberta: sem OrganizacaoGuard e só com library:view', () => {
    expect(temGuardOrganizacao(LibraryController, 'list')).toBe(false);
    expect(Reflect.getMetadata(PATH_METADATA, handler(LibraryController, 'list'))).toBe('/');
    expect(Reflect.getMetadata(PERMS_KEY, handler(LibraryController, 'list'))).toEqual(['library:view']);
  });

  it('Academia (GET /library) não passa pela checklist de telas — ela é só da Área da Organização', () => {
    // Tela efetiva como no ScreenAccessGuard (rota sobrepõe a classe): nenhuma.
    // Um líder com checklist antiga sem 'biblioteca' levaria 403 na Jornada.
    const efetiva =
      Reflect.getMetadata(SCREEN_KEY, handler(LibraryController, 'list')) ??
      Reflect.getMetadata(SCREEN_KEY, LibraryController);
    expect(efetiva).toBeUndefined();
    // A gestão do acervo segue na checklist corporativa.
    for (const m of ['create', 'update', 'remove', 'importFromGlobal']) {
      expect(Reflect.getMetadata(SCREEN_KEY, handler(LibraryController, m)), m).toEqual(['biblioteca']);
    }
  });

  it('cada rota da lista de abertas existe e não barra o Líder', () => {
    for (const chave of Object.keys(ABERTAS)) {
      const [nome, m] = chave.split('.');
      const c = PORTAL.find((x) => x.name === nome);
      expect(c, chave).toBeDefined();
      expect(rotasDe(c!), chave).toContain(m);
      expect(barraLider(c!, m), chave).toBe(false);
    }
  });

  it('evidência (H-008) não ganha @Roles: a barreira do responsável é o serviço', () => {
    for (const m of ['addEvidence', 'uploadEvidence', 'downloadEvidence']) {
      expect(Reflect.getMetadata(ROLES_KEY, handler(ActionPlansController, m)), m).toBeUndefined();
    }
    expect(Reflect.getMetadata(ROLES_KEY, ActionPlansController)).toBeUndefined();
  });

  it.each(PUBLICOS.map((c) => [c.name, c] as const))('%s (público) não tem o guard — sem sessão ele negaria todos', (_n, c) => {
    expect(guardsOf(c)).not.toContain(OrganizacaoGuard);
    for (const m of rotasDe(c)) expect(guardsOf(handler(c, m)), m).not.toContain(OrganizacaoGuard);
  });
});

describe('Varredura — nenhuma rota autenticada nova fica aberta ao Líder sem decisão', () => {
  it.each(PORTAL.map((c) => [c.name, c] as const))('%s: toda rota barra o Líder ou está em ABERTAS', (_n, c) => {
    expect(guardsOf(c)).toContain(AuthGuard);
    const soltas = rotasDe(c).filter((m) => !barraLider(c, m) && !(`${c.name}.${m}` in ABERTAS));
    expect(soltas).toEqual([]);
  });
});
