import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROUTE_BY_ROLE,
  JORNADA_HOME,
  NAV,
  SCREEN_OPTIONS,
  homeFor,
  renderNavHtml,
  routeAccess,
  routeContext,
  routeMeta,
} from '../app/plataforma/nav.config';
import { PLATFORM_MARKUP } from '../app/plataforma/markup';

// Spec V1 v1.2 §3 — um login, dois contextos que nunca dividem o menu:
// Minha Jornada (privada, do líder) e Área da Organização (corporativa).

const rotas = NAV.flatMap((g) => g.items.filter((i) => i.route).map((i) => i.route!));
const doContexto = (c: 'JORNADA' | 'ORGANIZACAO') =>
  NAV.filter((g) => g.context === c).flatMap((g) => g.items.filter((i) => i.route).map((i) => i.route!));

describe('contextos do menu do portal', () => {
  it('cada rota pertence a exatamente um contexto', () => {
    expect(new Set(rotas).size).toBe(rotas.length); // nenhuma rota em dois grupos
    for (const r of rotas) expect(['JORNADA', 'ORGANIZACAO'], r).toContain(routeContext[r]);
    expect(Object.keys(routeContext).sort()).toEqual([...rotas].sort());
  });

  it('Minha Jornada tem exatamente Hoje · Decidir · Evoluir, com os itens do contrato', () => {
    expect([...doContexto('JORNADA')].sort()).toEqual(
      ['hoje', 'pocket', 'decisoes', 'mentor', 'lider', 'jornada-mentorias', 'jornada-academia'].sort(),
    );
    const jornada = NAV.filter((g) => g.context === 'JORNADA').map((g) => [g.title, g.items.map((i) => i.route)]);
    expect(jornada).toEqual([
      ['Hoje', ['hoje']],
      ['Decidir', ['pocket', 'decisoes', 'mentor']],
      ['Evoluir', ['lider', 'jornada-mentorias', 'jornada-academia']],
    ]);
    for (const r of doContexto('JORNADA')) expect(routeMeta[r]?.path, r).toBe('Minha Jornada');
  });

  it('cada item da Jornada é liberado pelo módulo do contrato (Hoje não tem gate)', () => {
    expect(routeAccess.hoje).toBeUndefined();
    expect(routeAccess.pocket?.module).toBe('pocket');
    expect(routeAccess.decisoes?.module).toBe('icd');
    expect(routeAccess.mentor?.module).toBe('lider');
    expect(routeAccess.lider?.module).toBe('icd');
    expect(routeAccess['jornada-mentorias']?.module).toBe('mentorias');
    expect(routeAccess['jornada-academia']?.module).toBe('biblioteca');
    // Nenhum gate de papel/permissão: a Jornada é de quem é líder, qualquer papel.
    for (const r of doContexto('JORNADA')) {
      expect(routeAccess[r]?.perm, r).toBeUndefined();
      expect(routeAccess[r]?.roles, r).toBeUndefined();
    }
  });

  it('a Área da Organização é Portal · Programas · Administração, sem a antiga Área do Líder', () => {
    expect(NAV.filter((g) => g.context === 'ORGANIZACAO').map((g) => g.title)).toEqual([
      'Portal',
      'Programas',
      'Administração',
    ]);
    expect(NAV.some((g) => g.title === 'Área do Líder')).toBe(false);
    for (const r of ['lider', 'decisoes', 'pocket']) expect(doContexto('ORGANIZACAO')).not.toContain(r);
  });

  it('a checklist de telas por usuário não governa a Jornada', () => {
    const jornada = new Set(doContexto('JORNADA'));
    expect(SCREEN_OPTIONS.filter((o) => jornada.has(o.route))).toEqual([]);
    for (const o of SCREEN_OPTIONS) expect(routeContext[o.route], o.route).toBe('ORGANIZACAO');
    // Administração continua fora da checklist.
    expect(SCREEN_OPTIONS.some((o) => o.group === 'Administração')).toBe(false);
  });

  it('home por contexto: a Jornada abre em Hoje para qualquer papel; a Organização, pelo papel', () => {
    expect(homeFor('JORNADA', 'ADMIN')).toBe('hoje');
    expect(homeFor('JORNADA', 'LIDER')).toBe(JORNADA_HOME);
    expect(homeFor('ORGANIZACAO', 'JURIDICO')).toBe('parecer');
    expect(homeFor('ORGANIZACAO', 'MENTOR')).toBe('mentorias');
    expect(homeFor('ORGANIZACAO', 'ADMIN')).toBe('dashboard');
    expect(homeFor('ORGANIZACAO', null)).toBe('dashboard');
    expect(DEFAULT_ROUTE_BY_ROLE.LIDER).toBeUndefined();
    // Nenhuma home da Organização aponta para uma tela da Jornada (e vice-versa).
    expect(routeContext[JORNADA_HOME]).toBe('JORNADA');
    for (const [papel, home] of Object.entries(DEFAULT_ROUTE_BY_ROLE)) {
      expect(routeContext[home], `${papel} → ${home}`).toBe('ORGANIZACAO');
    }
  });

  it('a sidebar sai com um <nav> por contexto, cada um só com as suas rotas', () => {
    const html = renderNavHtml();
    const navs = [...html.matchAll(/<nav class="sidebar__nav" data-context="([A-Z]+)"[^>]*>([\s\S]*?)<\/nav>/g)];
    expect(navs.map((m) => m[1])).toEqual(['JORNADA', 'ORGANIZACAO']);
    for (const [, ctx, corpo] of navs) {
      const rotasNoNav = [...corpo.matchAll(/data-route="([^"]+)"/g)].map((m) => m[1]);
      expect(rotasNoNav).toEqual(doContexto(ctx as 'JORNADA' | 'ORGANIZACAO'));
    }
    expect(html).toContain('<span class="sidebar__ctx">Minha Jornada</span>');
    expect(html).toContain('<span class="sidebar__ctx">Área da Organização</span>');
    // Nenhum item nasce ativo: a home é decidida pelo shell na entrada.
    expect(html).not.toContain('is-active');
  });

  it('toda rota do menu tem sua seção no markup, e nenhuma seção nasce ativa', () => {
    for (const r of rotas) expect(PLATFORM_MARKUP, r).toContain(`<section class="route" data-route="${r}">`);
    for (const id of ['hoje-root', 'mentor-root', 'jornada-mentorias-root', 'jornada-academia-root', 'dash-root']) {
      expect(PLATFORM_MARKUP, id).toContain(`<div id="${id}"></div>`);
    }
    expect(PLATFORM_MARKUP).not.toMatch(/class="route is-active"/);
  });
});
