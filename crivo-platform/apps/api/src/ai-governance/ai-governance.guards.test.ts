import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { AiGovernanceController, normalizeDue } from './ai-governance.controller';
import { AiGovernanceAdminController } from '../admin/ai-governance.controller';
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
 * A cerca em volta da Governança de IA. Portal: sessão + módulo 'govia' ativo
 * no contrato + papel de gestão + tela liberada; toda ESCRITA exige a
 * permissão govia:manage (o Consultor CRIVO lê, não decide). Super Admin: só
 * GET, atrás do SuperAdminGuard — a CRIVO acompanha, não decide.
 */

const guardsOf = (target: object) => (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];
const meta = <T>(key: string, target: object): T | undefined => Reflect.getMetadata(key, target) as T | undefined;
const proto = AiGovernanceController.prototype as unknown as Record<string, object>;
const metodos = Object.getOwnPropertyNames(AiGovernanceController.prototype).filter(
  (m) => m !== 'constructor' && Reflect.getMetadata(PATH_METADATA, proto[m]) !== undefined,
);

describe('Portal — /ai-governance (Programas › Governança de IA)', () => {
  it('controller exige sessão + módulo govia + papel + permissão + tela (padrão parecer.controller)', () => {
    expect(guardsOf(AiGovernanceController)).toEqual(
      expect.arrayContaining([AuthGuard, ModuleGuard, RolesGuard, PermissionGuard, ScreenAccessGuard]),
    );
    expect(meta<string>(MODULE_KEY, AiGovernanceController)).toBe('govia');
    expect(meta<string[]>(SCREEN_KEY, AiGovernanceController)).toEqual(['govia']);
  });

  it('só papéis de gestão (+ Consultor CRIVO) — nunca LIDER nem COLABORADOR', () => {
    const roles = meta<string[]>(ROLES_KEY, AiGovernanceController) ?? [];
    expect(roles).toEqual(expect.arrayContaining(['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR']));
    expect(roles).not.toContain('LIDER');
    expect(roles).not.toContain('COLABORADOR');
  });

  it('toda rota de ESCRITA exige govia:manage; nenhuma leitura exige permissão', () => {
    const escrita: string[] = [];
    const leitura: string[] = [];
    for (const m of metodos) {
      const verb = Reflect.getMetadata(METHOD_METADATA, proto[m]) as RequestMethod;
      (verb === RequestMethod.GET ? leitura : escrita).push(m);
    }
    expect(escrita.length).toBeGreaterThan(0);
    expect(leitura.length).toBeGreaterThan(0);
    for (const m of escrita) expect(meta<string[]>(PERMS_KEY, proto[m]), m).toEqual(['govia:manage']);
    for (const m of leitura) expect(meta<string[]>(PERMS_KEY, proto[m]), m).toBeUndefined();
  });

  it('a decisão humana é um POST próprio (use-cases/:id/decision) — não passa pelo PUT de edição', () => {
    expect(Reflect.getMetadata(PATH_METADATA, proto.decide)).toBe('use-cases/:id/decision');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.decide)).toBe(RequestMethod.POST);
    expect(meta<string[]>(PERMS_KEY, proto.decide)).toEqual(['govia:manage']);
  });

  it('due fora do vocabulário vira "all" (leitura de agenda nunca dá 400)', () => {
    expect(normalizeDue('overdue')).toBe('overdue');
    expect(normalizeDue('30d')).toBe('30d');
    expect(normalizeDue(undefined)).toBe('all');
    expect(normalizeDue('qualquer')).toBe('all');
  });
});

describe('Super Admin — /admin/tenants/:id/ai-governance (Módulos › Governança de IA)', () => {
  const aproto = AiGovernanceAdminController.prototype as unknown as Record<string, object>;
  const rotas = Object.getOwnPropertyNames(AiGovernanceAdminController.prototype).filter(
    (m) => m !== 'constructor' && Reflect.getMetadata(PATH_METADATA, aproto[m]) !== undefined,
  );

  it('o controller inteiro está atrás do SuperAdminGuard e sob /admin/tenants/:id/ai-governance', () => {
    expect(guardsOf(AiGovernanceAdminController)).toContain(SuperAdminGuard);
    expect(Reflect.getMetadata(PATH_METADATA, AiGovernanceAdminController)).toBe('admin/tenants/:id/ai-governance');
  });

  it('SOMENTE leitura: a CRIVO acompanha, não cadastra nem decide', () => {
    expect(rotas.length).toBeGreaterThan(0);
    for (const m of rotas) expect(Reflect.getMetadata(METHOD_METADATA, aproto[m]), m).toBe(RequestMethod.GET);
    const paths = rotas.map((m) => Reflect.getMetadata(PATH_METADATA, aproto[m]));
    expect(paths).toEqual(expect.arrayContaining(['summary', 'use-cases', 'use-cases/:useCaseId', 'decisions', 'incidents', 'policies', 'reviews']));
    expect(paths.some((p) => String(p).includes('decision') && String(p).includes(':useCaseId'))).toBe(false);
  });
});
