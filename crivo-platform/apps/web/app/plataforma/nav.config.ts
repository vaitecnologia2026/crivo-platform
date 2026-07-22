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
  // Reorganização do mockup do cliente (Portal do Cliente, 22/07): três grupos —
  // Portal (operação da jornada) · Programas (frentes contratáveis) ·
  // Administração (gestão do próprio portal). Rotas existentes preservam o id
  // histórico (ex.: 'relatorios' = Plano de Evolução) para não invalidar as
  // listas de acesso por usuário (screenAccess) já gravadas.
  {
    title: 'Portal',
    items: [
      {
        route: 'dashboard',
        label: 'Visão Geral',
        icon: '▣',
        module: 'dashboard',
        breadcrumb: { path: 'Portal', current: 'Visão Geral Executiva' },
      },
      {
        route: 'organizacao',
        label: 'Minha Organização',
        icon: '⚙',
        perm: 'branding:edit',
        breadcrumb: { path: 'Portal', current: 'Minha Organização' },
      },
      {
        route: 'essencial',
        label: 'Diagnósticos',
        icon: '✦',
        module: 'campanhas',
        breadcrumb: { path: 'Portal', current: 'Diagnósticos' },
      },
      {
        // Mockup 22/07 (/diagnosticos/nr1): a tela psicossocial existia mas
        // estava FORA do menu — só alcançável por link interno.
        route: 'psicossocial',
        label: 'NR-1 · Riscos Psicossociais',
        icon: '◮',
        module: 'campanhas',
        breadcrumb: { path: 'Portal', current: 'NR-1 · Riscos Psicossociais' },
      },
      {
        route: 'campanhas',
        label: 'Campanhas de Diagnóstico',
        icon: '◭',
        module: 'campanhas',
        breadcrumb: { path: 'Portal', current: 'Campanhas de Diagnóstico' },
      },
      {
        route: 'parecer',
        label: 'Parecer CRIVO',
        icon: '❖',
        module: 'parecer',
        perm: 'parecer:view',
        breadcrumb: { path: 'Portal', current: 'Parecer Consultivo CRIVO' },
      },
      {
        route: 'relatorios',
        label: 'Plano de Evolução',
        icon: '▤',
        module: 'relatorios',
        breadcrumb: { path: 'Portal', current: 'Plano de Evolução' },
      },
      {
        route: 'evidencias',
        label: 'Evidências',
        icon: '▧',
        module: 'relatorios',
        breadcrumb: { path: 'Portal', current: 'Evidências' },
      },
      {
        route: 'documentos',
        label: 'Relatórios e Dossiês',
        icon: '▦',
        module: 'relatorios',
        breadcrumb: { path: 'Portal', current: 'Relatórios e Dossiês' },
      },
      {
        route: 'grupo',
        label: 'Grupo Empresarial',
        icon: '◧',
        module: 'grupo',
        breadcrumb: { path: 'Portal', current: 'Consolidado do Grupo' },
      },
    ],
  },
  {
    title: 'Programas',
    items: [
      {
        route: 'lider',
        label: 'Liderança — Área do Líder',
        icon: '★',
        module: 'lider',
        breadcrumb: { path: 'Programas', current: 'Liderança — Área do Líder' },
      },
      {
        route: 'icd',
        label: 'Liderança — ICD (agregado)',
        icon: '◈',
        module: 'icd',
        perm: 'icd:view',
        breadcrumb: { path: 'Programas', current: 'ICD — Visão Agregada' },
      },
      {
        route: 'questionario',
        label: 'Aplicação do ICD (líderes)',
        icon: '✎',
        module: 'icd',
        perm: 'icd:submit',
        breadcrumb: { path: 'Programas', current: 'Aplicação do ICD (líderes)' },
      },
      {
        route: 'decisoes',
        label: 'Registro de Decisões',
        icon: '◬',
        module: 'icd',
        breadcrumb: { path: 'Programas', current: 'Registro de Decisões' },
      },
      {
        route: 'pocket',
        label: 'Pocket CRIVO',
        icon: '◐',
        module: 'pocket',
        breadcrumb: { path: 'Programas', current: 'Pocket CRIVO' },
      },
      {
        route: 'govia',
        label: 'Governança de IA',
        icon: '◎',
        breadcrumb: { path: 'Programas', current: 'Governança de IA' },
      },
      {
        route: 'workforce',
        label: 'Workforce Intelligence',
        icon: '⌬',
        breadcrumb: { path: 'Programas', current: 'Workforce Intelligence' },
      },
      {
        route: 'analytics',
        label: 'People Analytics',
        icon: '⌭',
        module: 'analytics',
        breadcrumb: { path: 'Programas', current: 'People Analytics' },
      },
      {
        route: 'custo',
        label: 'Radar de Custos Invisíveis',
        icon: '◇',
        module: 'custo',
        breadcrumb: { path: 'Programas', current: 'Radar de Custos Invisíveis' },
      },
      {
        route: 'contexto',
        label: 'Contexto e Diretrizes',
        icon: '❈',
        breadcrumb: { path: 'Programas', current: 'Contexto e Diretrizes (IA)' },
      },
      {
        route: 'biblioteca',
        label: 'Academia e Recursos',
        icon: '▥',
        module: 'biblioteca',
        breadcrumb: { path: 'Programas', current: 'Academia e Recursos' },
      },
      {
        route: 'mentorias',
        label: 'Mentorias e Agenda',
        icon: '☉',
        module: 'mentorias',
        breadcrumb: { path: 'Programas', current: 'Mentorias e Agenda' },
      },
    ],
  },
  {
    title: 'Administração',
    items: [
      {
        route: 'usuarios',
        label: 'Usuários e Acessos',
        icon: '◌',
        perm: 'users:view',
        breadcrumb: { path: 'Administração', current: 'Usuários e Acessos' },
      },
      {
        route: 'papeis',
        label: 'Papéis & Permissões',
        icon: '▥',
        perm: 'users:view',
        breadcrumb: { path: 'Administração', current: 'Papéis & Permissões' },
      },
      {
        route: 'contratacao',
        label: 'Minha Contratação',
        icon: '▦',
        breadcrumb: { path: 'Administração', current: 'Minha Contratação' },
      },
      {
        route: 'historico',
        label: 'Histórico & Auditoria',
        icon: '⊞',
        module: 'historico',
        breadcrumb: { path: 'Administração', current: 'Histórico & Auditoria' },
      },
      {
        route: 'suporte',
        label: 'Suporte',
        icon: '✆',
        breadcrumb: { path: 'Administração', current: 'Suporte' },
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
    g.title === 'Administração'
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
