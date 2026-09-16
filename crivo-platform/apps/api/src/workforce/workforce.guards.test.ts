import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { WorkforceController } from './workforce.controller';
import { WorkforceAdminController } from '../admin/workforce.controller';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { AuthGuard } from '../iam/guards/auth.guard';
import { ModuleGuard } from '../iam/guards/module.guard';
import { PermissionGuard } from '../iam/guards/permission.guard';
import { RolesGuard } from '../iam/guards/roles.guard';
import { ScreenAccessGuard } from '../iam/guards/screen-access.guard';
import { MODULE_KEY } from '../iam/require-module.decorator';
import { PERMS_KEY } from '../iam/require-permission.decorator';
import { SCREEN_KEY } from '../iam/require-screen.decorator';
import { ROLES_KEY } from '../iam/roles.decorator';

/**
 * A cerca em volta do Workforce Intelligence. Portal: sessão + módulo
 * 'workforce' ativo no contrato + papel de gestão + tela liberada; toda
 * ESCRITA (inclusive a decisão humana) exige workforce:manage. A validação
 * CRIVO NÃO existe no portal. Super Admin: tudo atrás do SuperAdminGuard, com
 * validação (validar/devolver) e SEM rota de decisão — quem decide é o cliente.
 */

const guardsOf = (target: object) => (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];
const meta = <T>(key: string, target: object): T | undefined => Reflect.getMetadata(key, target) as T | undefined;
const rotasDe = (ctor: { prototype: object }) => {
  const proto = ctor.prototype as Record<string, object>;
  const nomes = Object.getOwnPropertyNames(ctor.prototype).filter(
    (m) => m !== 'constructor' && Reflect.getMetadata(PATH_METADATA, proto[m]) !== undefined,
  );
  return { proto, nomes };
};

describe('Portal — /workforce (Programas › Workforce Intelligence)', () => {
  const { proto, nomes } = rotasDe(WorkforceController);

  it('controller exige sessão + módulo workforce + papel + permissão + tela (padrão parecer.controller)', () => {
    expect(guardsOf(WorkforceController)).toEqual(
      expect.arrayContaining([AuthGuard, ModuleGuard, RolesGuard, PermissionGuard, ScreenAccessGuard]),
    );
    expect(Reflect.getMetadata(PATH_METADATA, WorkforceController)).toBe('workforce');
    expect(meta<string>(MODULE_KEY, WorkforceController)).toBe('workforce');
    expect(meta<string[]>(SCREEN_KEY, WorkforceController)).toEqual(['workforce']);
  });

  it('só papéis de gestão (+ Consultor CRIVO) — nunca LIDER nem COLABORADOR', () => {
    const roles = meta<string[]>(ROLES_KEY, WorkforceController) ?? [];
    expect(roles).toEqual(expect.arrayContaining(['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR']));
    expect(roles).not.toContain('LIDER');
    expect(roles).not.toContain('COLABORADOR');
  });

  it('toda rota de ESCRITA exige workforce:manage; nenhuma leitura exige permissão', () => {
    const escrita: string[] = [];
    const leitura: string[] = [];
    for (const m of nomes) {
      const verb = Reflect.getMetadata(METHOD_METADATA, proto[m]) as RequestMethod;
      (verb === RequestMethod.GET ? leitura : escrita).push(m);
    }
    expect(escrita.length).toBeGreaterThan(0);
    expect(leitura.length).toBeGreaterThan(0);
    for (const m of escrita) expect(meta<string[]>(PERMS_KEY, proto[m]), m).toEqual(['workforce:manage']);
    for (const m of leitura) expect(meta<string[]>(PERMS_KEY, proto[m]), m).toBeUndefined();
  });

  it('a decisão humana é um POST próprio (tasks/:id/decision); a validação CRIVO NÃO existe no portal', () => {
    expect(Reflect.getMetadata(PATH_METADATA, proto.decide)).toBe('tasks/:id/decision');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.decide)).toBe(RequestMethod.POST);
    const paths = nomes.map((m) => String(Reflect.getMetadata(PATH_METADATA, proto[m])));
    expect(paths.some((p) => p.includes('validate'))).toBe(false);
    expect(paths).toEqual(expect.arrayContaining(['summary', 'processes', 'tasks', 'skills', 'pilots']));
  });
});

describe('Super Admin — /admin/tenants/:id/workforce (Módulos › Workforce Intelligence)', () => {
  const { proto, nomes } = rotasDe(WorkforceAdminController);

  it('o controller inteiro está atrás do SuperAdminGuard e sob /admin/tenants/:id/workforce', () => {
    expect(guardsOf(WorkforceAdminController)).toContain(SuperAdminGuard);
    expect(Reflect.getMetadata(PATH_METADATA, WorkforceAdminController)).toBe('admin/tenants/:id/workforce');
  });

  it('a CRIVO alimenta e VALIDA (tasks/:taskId/validate), mas não tem rota de decisão — quem decide é o cliente', () => {
    const paths = nomes.map((m) => String(Reflect.getMetadata(PATH_METADATA, proto[m])));
    expect(paths).toEqual(expect.arrayContaining(['summary', 'processes', 'processes/:processId/detail', 'tasks', 'tasks/:taskId/validate', 'skills', 'pilots']));
    expect(Reflect.getMetadata(METHOD_METADATA, proto.validateTask)).toBe(RequestMethod.POST);
    expect(paths.some((p) => p.includes('decision'))).toBe(false);
  });
});
