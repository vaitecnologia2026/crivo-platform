import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { ContextController } from './context.controller';
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
 * A cerca em volta do Contexto e Diretrizes: sessão + módulo 'contexto' ativo
 * no contrato + papel de gestão + tela liberada; toda ESCRITA exige
 * context:manage (o Consultor CRIVO lê, não aprova o contexto da empresa).
 */

const guardsOf = (target: object) => (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[];
const meta = <T>(key: string, target: object): T | undefined => Reflect.getMetadata(key, target) as T | undefined;
const proto = ContextController.prototype as unknown as Record<string, object>;
const metodos = Object.getOwnPropertyNames(ContextController.prototype).filter(
  (m) => m !== 'constructor' && Reflect.getMetadata(PATH_METADATA, proto[m]) !== undefined,
);

describe('Portal — /context (Programas › Contexto e Diretrizes)', () => {
  it('controller exige sessão + módulo contexto + papel + permissão + tela (padrão parecer.controller)', () => {
    expect(guardsOf(ContextController)).toEqual(
      expect.arrayContaining([AuthGuard, ModuleGuard, RolesGuard, PermissionGuard, ScreenAccessGuard]),
    );
    expect(meta<string>(MODULE_KEY, ContextController)).toBe('contexto');
    expect(meta<string[]>(SCREEN_KEY, ContextController)).toEqual(['contexto']);
  });

  it('só papéis de gestão (+ Consultor CRIVO) — nunca LIDER nem COLABORADOR', () => {
    const roles = meta<string[]>(ROLES_KEY, ContextController) ?? [];
    expect(roles).toEqual(expect.arrayContaining(['RH', 'GESTOR', 'CEO', 'ADMIN', 'CONSULTOR']));
    expect(roles).not.toContain('LIDER');
    expect(roles).not.toContain('COLABORADOR');
  });

  it('toda rota de ESCRITA exige context:manage; nenhuma leitura exige permissão', () => {
    const escrita: string[] = [];
    const leitura: string[] = [];
    for (const m of metodos) {
      const verb = Reflect.getMetadata(METHOD_METADATA, proto[m]) as RequestMethod;
      (verb === RequestMethod.GET ? leitura : escrita).push(m);
    }
    expect(escrita.length).toBeGreaterThan(0);
    expect(leitura.length).toBeGreaterThan(0);
    for (const m of escrita) expect(meta<string[]>(PERMS_KEY, proto[m]), m).toEqual(['context:manage']);
    for (const m of leitura) expect(meta<string[]>(PERMS_KEY, proto[m]), m).toBeUndefined();
  });

  it('expõe as rotas do blueprint (diretrizes, documentos, termos, casos de uso, auditoria)', () => {
    const paths = metodos.map((m) => Reflect.getMetadata(PATH_METADATA, proto[m]) as string);
    for (const p of ['directives', 'directives/:id/status', 'documents', 'documents/:id/replace', 'documents/:id/revoke', 'terms', 'ai-use-cases/:useCase', 'audit']) {
      expect(paths, p).toContain(p);
    }
  });
});
