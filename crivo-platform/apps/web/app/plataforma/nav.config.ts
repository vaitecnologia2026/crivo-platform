// Fonte ÚNICA da navegação da plataforma (F6). Antes a nav vivia triplicada:
// HTML estático no markup, `routeAccess` e `routeMeta` no Plataforma. Agora tudo
// deriva desta config. Primeiro passo da migração shell→config-driven: o markup
// ainda é injetado, mas a nav é GERADA daqui (renderNavHtml). A próxima fatia
// renderiza a sidebar em React a partir desta mesma estrutura.

export interface NavItem {
  /** Rota do roteador SPA (data-route). Ausente = item mudo (placeholder). */
  route?: string;
  label: string;
  icon: string;
  /** Código do módulo (F4) — esconde no menu se a empresa não tem no plano. */
  module?: string;
  /** Permissão de "ver" (F3) — esconde se o papel não pode. */
  perm?: string;
  /** Breadcrumb exibido ao navegar (topo da tela). */
  breadcrumb?: { path: string; current: string };
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Rota ativa por padrão ao abrir a plataforma. */
export const DEFAULT_ROUTE = 'dashboard';

/**
 * HOME inicial por papel (#51 — áreas por papel). Cada Role abre numa tela
 * que faz sentido para sua função na empresa. Se a rota não estiver visível
 * (módulo/perm), a Plataforma cai no DEFAULT_ROUTE.
 *
 * - Executivos / gestores → Dashboard (Visão Executiva)
 * - Liderança operacional → Área do Líder
 * - Jurídico → Parecer Consultivo CRIVO
 * - Colaborador / Academia → Biblioteca / Academia CRIVO
 * - Consultor / Mentor → Dashboard (acompanha o cliente)
 */
export const DEFAULT_ROUTE_BY_ROLE: Record<string, string> = {
  ADMIN: 'dashboard',
  CEO: 'dashboard',
  GESTOR: 'dashboard',
  RH: 'dashboard',
  CONSULTOR: 'dashboard',
  MENTOR: 'lider',
  LIDER: 'lider',
  JURIDICO: 'parecer',
  COLABORADOR: 'biblioteca',
  ACADEMIA: 'biblioteca',
};

export function homeForRole(role: string | null | undefined): string {
  if (!role) return DEFAULT_ROUTE;
  return DEFAULT_ROUTE_BY_ROLE[role] ?? DEFAULT_ROUTE;
}

// §16 do Briefing: o CRM é ferramenta INTERNA da CRIVO (funil/leads/propostas)
// e NÃO deve aparecer como produto/entrega no portal do cliente. Ele vive só no
// Super Admin (control plane, CrmSection). Por isso não há grupo "Comercial" aqui.
export const NAV: NavGroup[] = [
  {
    title: 'Geral',
    items: [
      {
        route: 'dashboard',
        label: 'Dashboard',
        icon: '▣',
        module: 'dashboard',
        breadcrumb: { path: 'Dashboard', current: 'Visão Executiva' },
      },
      {
        route: 'icd',
        label: 'Índice de Coerência (ICD)',
        icon: '◈',
        module: 'icd',
        perm: 'icd:view',
        breadcrumb: { path: 'Indicadores', current: 'Índice de Coerência (ICD)' },
      },
      {
        // F3 — Consolidado do Grupo Empresarial. O módulo virtual 'grupo' só é
        // devolvido por /me/modules quando o usuário está autorizado (grupo
        // consolidado + e-mail na lista de acesso), então o item só aparece p/ eles.
        route: 'grupo',
        label: 'Grupo Empresarial',
        icon: '◧',
        module: 'grupo',
        breadcrumb: { path: 'Grupo', current: 'Consolidado do Grupo' },
      },
    ],
  },
  {
    title: 'Diagnóstico',
    items: [
      {
        route: 'essencial',
        label: 'Diagnóstico',
        icon: '✦',
        module: 'campanhas',
        breadcrumb: { path: 'Diagnóstico', current: 'Diagnóstico' },
      },
      {
        route: 'campanhas',
        label: 'Campanhas de Diagnóstico',
        icon: '◭',
        module: 'campanhas',
        breadcrumb: { path: 'Diagnóstico', current: 'Campanhas de Diagnóstico' },
      },
      {
        route: 'parecer',
        label: 'Parecer CRIVO',
        icon: '❖',
        module: 'parecer',
        perm: 'parecer:view',
        breadcrumb: { path: 'Diagnóstico', current: 'Parecer Consultivo CRIVO' },
      },
      {
        route: 'questionario',
        label: 'Instrumentos Diagnósticos',
        icon: '✎',
        module: 'icd',
        perm: 'icd:submit',
        breadcrumb: { path: 'Aplicação', current: 'Instrumentos Diagnósticos' },
      },
    ],
  },
  {
    title: 'Desenvolvimento',
    items: [
      {
        route: 'lider',
        label: 'Área do Líder',
        icon: '★',
        module: 'lider',
        breadcrumb: { path: 'Desenvolvimento', current: 'Área do Líder' },
      },
      {
        route: 'decisoes',
        label: 'Registro de Decisões',
        icon: '◬',
        module: 'icd',
        breadcrumb: { path: 'Desenvolvimento', current: 'Registro de Decisões' },
      },
      {
        route: 'pocket',
        label: 'Pocket CRIVO',
        icon: '◐',
        module: 'pocket',
        breadcrumb: { path: 'Desenvolvimento', current: 'Pocket CRIVO' },
      },
      {
        route: 'mentorias',
        label: 'Mentorias',
        icon: '☉',
        module: 'mentorias',
        breadcrumb: { path: 'Desenvolvimento', current: 'Mentorias' },
      },
      {
        route: 'biblioteca',
        label: 'Academia CRIVO',
        icon: '▦',
        module: 'biblioteca',
        breadcrumb: { path: 'Desenvolvimento', current: 'Biblioteca & Formação' },
      },
      {
        route: 'relatorios',
        label: 'Plano de Ação & Evidências',
        icon: '▤',
        module: 'relatorios',
        breadcrumb: { path: 'Documentos', current: 'Plano de Ação & Evidências' },
      },
      {
        route: 'analytics',
        label: 'People Analytics',
        icon: '⌭',
        module: 'analytics',
        breadcrumb: { path: 'Indicadores', current: 'People Analytics' },
      },
      {
        route: 'custo',
        label: 'Custo Invisível',
        icon: '◇',
        module: 'custo',
        breadcrumb: { path: 'Indicadores', current: 'Custo Invisível' },
      },
      {
        route: 'historico',
        label: 'Histórico & Auditoria',
        icon: '⊞',
        module: 'historico',
        breadcrumb: { path: 'Plataforma', current: 'Histórico & Auditoria' },
      },
    ],
  },
  {
    title: 'Configurações',
    items: [
      {
        route: 'organizacao',
        label: 'Organização',
        icon: '⚙',
        perm: 'branding:edit',
        breadcrumb: { path: 'Configurações', current: 'Organização' },
      },
      {
        route: 'usuarios',
        label: 'Usuários',
        icon: '◌',
        perm: 'users:view',
        breadcrumb: { path: 'Configurações', current: 'Usuários & Equipe' },
      },
      {
        route: 'papeis',
        label: 'Papéis & Permissões',
        icon: '▥',
        perm: 'users:view',
        breadcrumb: { path: 'Configurações', current: 'Papéis & Permissões' },
      },
    ],
  },
];

/**
 * Catálogo de TELAS atribuíveis a um usuário (checklist de acesso por usuário).
 * São os itens de nav com rota — exceto Configurações (gestão), que fica restrita
 * a quem tem permissão de admin. Agrupado para a UI.
 */
export const SCREEN_OPTIONS: { route: string; label: string; group: string }[] = NAV.flatMap(
  (g) =>
    g.title === 'Configurações'
      ? []
      : g.items
          // 'grupo' (F3) é liberado por autorização de grupo, não pela checklist por usuário.
          .filter((i) => i.route && i.route !== 'grupo')
          .map((i) => ({ route: i.route!, label: i.label, group: g.title })),
);

/** Acesso por rota (módulo + permissão de ver) — alimenta o filtro da nav. */
export const routeAccess: Record<string, { module: string; perm?: string }> = Object.fromEntries(
  NAV.flatMap((g) => g.items)
    .filter((i) => i.route && i.module)
    .map((i) => [i.route!, { module: i.module!, perm: i.perm }]),
);

/** Breadcrumb por rota (topo da tela ao navegar). */
export const routeMeta: Record<string, { path: string; current: string }> = Object.fromEntries(
  NAV.flatMap((g) => g.items)
    .filter((i) => i.route && i.breadcrumb)
    .map((i) => [i.route!, i.breadcrumb!]),
);

/** HTML da sidebar gerado da config (injetado no shell legado por enquanto). */
export function renderNavHtml(): string {
  const groups = NAV.map((group) => {
    const items = group.items
      .map((item) => {
        const ic = `<span class="ni__ic">${item.icon}</span>`;
        if (!item.route) {
          return `        <a href="#" class="nav-item nav-item--muted">\n          ${ic}${item.label}\n        </a>`;
        }
        const active = item.route === DEFAULT_ROUTE ? ' is-active' : '';
        return `        <a href="#" class="nav-item${active}" data-route="${item.route}">\n          ${ic}${item.label}\n        </a>`;
      })
      .join('\n');
    return `        <span class="sidebar__group">${group.title}</span>\n${items}`;
  }).join('\n\n');
  return `<nav class="sidebar__nav">\n${groups}\n      </nav>`;
}
