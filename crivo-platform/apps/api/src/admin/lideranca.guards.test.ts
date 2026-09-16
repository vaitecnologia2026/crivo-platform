import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { LiderancaAdminController } from './lideranca.controller';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { IcdCyclesController } from '../icd-cycles/icd-cycles.controller';
import { PocketController } from '../pocket/pocket.controller';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { MODULE_KEY } from '../iam/require-module.decorator';
import { SCREEN_KEY } from '../iam/require-screen.decorator';
import { ROLES_KEY } from '../iam/roles.decorator';

/**
 * As rotas de Liderança expõem agregados de ICD e Pocket. O que estes testes
 * prendem é a CERCA em volta delas: as rotas /admin/tenants/:id/… só passam
 * com o SuperAdminGuard (token de plataforma), e as do portal exigem sessão
 * de tenant + módulo "icd" (ou "pocket") ativo + tela liberada + papel de
 * gestão. Se alguém remover um decorator, o agregado vaza para quem não deve.
 */

const guardsOf = (target: object) => (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];
const meta = <T>(key: string, target: object, method?: string): T | undefined =>
  method
    ? (Reflect.getMetadata(key, (target as Record<string, unknown>)[method] as object) as T | undefined)
    : (Reflect.getMetadata(key, target) as T | undefined);

describe('Super Admin — /admin/tenants/:id/lideranca, icd-cycles, pocket/aggregate', () => {
  it('o controller inteiro está atrás do SuperAdminGuard e sob o prefixo admin/tenants/:id', () => {
    expect(guardsOf(LiderancaAdminController)).toContain(SuperAdminGuard);
    expect(meta<string>(PATH_METADATA, LiderancaAdminController)).toBe('admin/tenants/:id');
  });

  it('expõe exatamente as rotas da fatia (summary, ciclos, history, official, close, pocket/aggregate)', () => {
    const proto = LiderancaAdminController.prototype as unknown as Record<string, object>;
    const paths = ['summary', 'listCycles', 'createCycle', 'history', 'official', 'closeCycle', 'pocketAggregate']
      .map((m) => Reflect.getMetadata(PATH_METADATA, proto[m]));
    expect(paths).toEqual([
      'lideranca/summary',
      'icd-cycles',
      'icd-cycles',
      'icd-cycles/history',
      'icd-cycles/:cycleId',
      'icd-cycles/:cycleId/close',
      'pocket/aggregate',
    ]);
  });
});

describe('Portal — GET /icd-cycles/history e /icd-cycles/current/summary', () => {
  const proto = IcdCyclesController.prototype as unknown as Record<string, object>;

  it('controller exige sessão + módulo "icd" + papel + tela (padrão parecer.controller)', () => {
    const guards = guardsOf(IcdCyclesController);
    expect(guards).toEqual(expect.arrayContaining([AuthGuard, ModuleGuard, RolesGuard, ScreenAccessGuard]));
    expect(meta<string>(MODULE_KEY, IcdCyclesController)).toBe('icd');
  });

  it('as duas rotas novas declaram a tela "icd" e papéis de gestão — nunca o LIDER', () => {
    for (const m of ['history', 'summary']) {
      expect(meta<string[]>(SCREEN_KEY, proto, m)).toEqual(['icd']);
      const roles = meta<string[]>(ROLES_KEY, proto, m) ?? [];
      expect(roles).toEqual(expect.arrayContaining(['RH', 'CEO', 'ADMIN']));
      expect(roles).not.toContain('LIDER');
    }
  });

  it('current/me (ICD do próprio líder) continua sem tela declarada — a Área do Líder não pode quebrar', () => {
    expect(meta<string[]>(SCREEN_KEY, proto, 'myPartial')).toBeUndefined();
    expect(meta<string[]>(ROLES_KEY, proto, 'myPartial')).toBeUndefined();
  });
});

describe('Portal — GET /pocket/aggregate', () => {
  const proto = PocketController.prototype as unknown as Record<string, object>;

  it('o agregado é da GESTÃO (tela icd + papéis), sobrepondo o gate de líder da classe (tela pocket)', () => {
    expect(meta<string[]>(SCREEN_KEY, PocketController)).toEqual(['pocket']);
    expect(meta<string[]>(SCREEN_KEY, proto, 'aggregate')).toEqual(['icd']);
    expect(guardsOf(proto.aggregate)).toContain(RolesGuard);
    const roles = meta<string[]>(ROLES_KEY, proto, 'aggregate') ?? [];
    expect(roles).toEqual(expect.arrayContaining(['RH', 'GESTOR', 'CEO', 'ADMIN']));
    expect(roles).not.toContain('LIDER');
  });

  it('as rotas individuais do líder (sessões) seguem sem papel — cada um vê só o próprio', () => {
    expect(meta<string[]>(ROLES_KEY, proto, 'listMine')).toBeUndefined();
    expect(guardsOf(PocketController)).toEqual(expect.arrayContaining([AuthGuard, ModuleGuard, ScreenAccessGuard]));
    expect(meta<string>(MODULE_KEY, PocketController)).toBe('pocket');
  });
});
