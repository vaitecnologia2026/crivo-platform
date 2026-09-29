// Fonte ÚNICA da navegação da plataforma (F6). Antes a nav vivia triplicada:
// HTML estático no markup, `routeAccess` e `routeMeta` no Plataforma. Agora tudo
// deriva desta config. Primeiro passo da migração shell→config-driven: o markup
// ainda é injetado, mas a nav é GERADA daqui (renderNavHtml). A próxima fatia
// renderiza a sidebar em React a partir desta mesma estrutura.

import { CLIENT_CONTEXTS, CLIENT_CONTEXT_LABEL, type ClientContext } from '@crivo/types';
// Relativo (não '@/lib'): a nav.config é importada pelo teste do vitest, que
// não resolve o alias do Next.
import { navIconSvg, type NavIconName } from '../../lib/nav-icons';

export interface NavItem {
  /** Rota do roteador SPA (data-route). Ausente = item mudo (placeholder). */
  route?: string;
  label: string;
  /** Ícone de traço do protótipo (lib/nav-icons) — nome do ícone no lucide. */
  icon: NavIconName;
  /** Código do módulo (F4) — esconde no menu se a empresa não tem no plano. */
  module?: string;
  /** Permissão de "ver" (F3) — esconde se o papel não pode. */
  perm?: string;
  /**
   * Papéis que enxergam o item — espelha o @Roles das rotas que a tela consome
   * (a API é quem bloqueia; aqui só não se oferece uma tela que daria 403).
   * Ausente = qualquer papel.
   */
  roles?: readonly string[];
  /**
   * Métodos de diagnóstico (do CONTRATO) para os quais este item faz sentido —
   * esconde no menu o diagnóstico que a empresa NÃO contratou. Ausente = o item
   * vale para qualquer método.
   *
   * Método NÃO resolvido (empresa sem contrato ativo e sem solução no tenant)
   * NÃO filtra nada: é o mesmo fail-open já adotado pelo BUILTIN_BY_METHOD em
   * `me.controller.ts` — sem contrato não há o que esconder, e esconder tiraria
   * do cliente uma tela que ele enxerga hoje.
   */
  methods?: string[];
  /**
   * Métodos dos quais este item é o DONO (1:1 com o built-in do método). Diferente
   * de `methods` (que é só VISIBILIDADE e pode ser mais amplo): o rename do item
   * com o nome da solução contratada usa ESTE conjunto, para o psicossocial não
   * herdar o nome do Essencial só porque também é visível para ele.
   */
  ownerMethods?: string[];
  /**
   * Item fora do menu e da checklist de telas (programa ainda não lançado — V2).
   * A rota continua existindo no router; só deixa de ser oferecida ao cliente.
   */
  hidden?: boolean;
  /** Breadcrumb exibido ao navegar (topo da tela). */
  breadcrumb?: { path: string; current: string };
}

export interface NavGroup {
  title: string;
  /**
   * Contexto do cliente a que o grupo pertence (Spec V1 v1.2 §3): Minha
   * Jornada (privada, do líder) ou Área da Organização (corporativa). Cada
   * rota vive em UM contexto só, e os dois menus nunca aparecem juntos.
   */
  context: ClientContext;
  items: NavItem[];
}

/** HOME da Área da Organização quando o papel não tem uma própria. */
export const DEFAULT_ROUTE = 'dashboard';

/** HOME de Minha Jornada — a mesma para todo líder, qualquer que seja o papel. */
export const JORNADA_HOME = 'hoje';

// Mesmos grupos de apps/api/src/iam/role-groups.ts (a API é a fonte da regra).
const GESTAO_EMPRESA = ['RH', 'GESTOR', 'CEO', 'ADMIN'] as const;
const GESTAO_E_CONSULTORIA = [...GESTAO_EMPRESA, 'CONSULTOR'] as const;
const LEITURA_GESTAO = [...GESTAO_E_CONSULTORIA, 'JURIDICO'] as const;

/**
 * HOME da Área da Organização por papel (#51 — áreas por papel). Cada Role
 * abre numa tela que faz sentido para sua função na empresa. Se a rota não
 * estiver visível (módulo/perm), a Plataforma cai na primeira tela visível do
 * contexto.
 *
 * - Executivos / gestores → Dashboard (Visão Executiva)
 * - Jurídico → Parecer Consultivo CRIVO
 * - Colaborador / Academia → Biblioteca / Academia CRIVO
 * - Consultor → Dashboard (acompanha o cliente)
 * - Mentor → Mentorias e Agenda
 *
 * O LIDER não está aqui: ele só tem Minha Jornada, cuja home é JORNADA_HOME.
 */
export const DEFAULT_ROUTE_BY_ROLE: Record<string, string> = {
  ADMIN: 'dashboard',
  CEO: 'dashboard',
  GESTOR: 'dashboard',
  RH: 'dashboard',
  CONSULTOR: 'dashboard',
  MENTOR: 'mentorias',
  JURIDICO: 'parecer',
  COLABORADOR: 'biblioteca',
  ACADEMIA: 'biblioteca',
};

/** HOME de um contexto: Minha Jornada abre sempre em Hoje; a Organização, pelo papel. */
export function homeFor(context: ClientContext, role: string | null | undefined): string {
  if (context === 'JORNADA') return JORNADA_HOME;
  return (role && DEFAULT_ROUTE_BY_ROLE[role]) || DEFAULT_ROUTE;
}

// §16 do Briefing: o CRM é ferramenta INTERNA da CRIVO (funil/leads/propostas)
// e NÃO deve aparecer como produto/entrega no portal do cliente. Ele vive só no
// Super Admin (control plane, CrmSection). Por isso não há grupo "Comercial" aqui.
export const NAV: NavGroup[] = [
  // ── Minha Jornada (Spec V1 v1.2 §3/§5) ──────────────────────────────────────
  // A experiência individual e PRIVADA do líder: Hoje · Decidir · Evoluir. Não
  // passa pela checklist de telas por usuário (SCREEN_OPTIONS só lista a
  // Organização) — o que libera cada item é o módulo do contrato. As rotas
  // 'lider', 'decisoes' e 'pocket' mantêm o id histórico (antes no grupo "Área
  // do Líder"); Mentorias e Academia ganham rotas próprias da Jornada, com o
  // recorte pessoal, porque as de Programas são as da gestão.
  {
    title: 'Hoje',
    context: 'JORNADA',
    items: [
      {
        route: 'hoje',
        label: 'Hoje',
        icon: 'sun',
        breadcrumb: { path: 'Minha Jornada', current: 'Hoje' },
      },
    ],
  },
  {
    title: 'Decidir',
    context: 'JORNADA',
    items: [
      {
        route: 'pocket',
        label: 'Pocket CRIVO',
        icon: 'smartphone',
        module: 'pocket',
        breadcrumb: { path: 'Minha Jornada', current: 'Pocket CRIVO' },
      },
      {
        // "Aplicação do ICD (líderes)" saiu em 25/09/2026 (tela removida):
        // aplicava as 8 perguntas do modelo LEGADO (4 Rs). O ICD oficial é
        // medido por decisão aqui (4 eixos). Os dados antigos seguem no banco.
        route: 'decisoes',
        label: 'Registro de Decisão',
        icon: 'notebook-pen',
        module: 'icd',
        breadcrumb: { path: 'Minha Jornada', current: 'Registro de Decisão' },
      },
      {
        route: 'mentor',
        label: 'Mentor CRIVO',
        icon: 'sparkles',
        module: 'lider',
        breadcrumb: { path: 'Minha Jornada', current: 'Mentor CRIVO' },
      },
    ],
  },
  {
    title: 'Evoluir',
    context: 'JORNADA',
    items: [
      {
        // Módulo 'icd' (e não mais 'lider'): é o que a API de /icd-cycles/me exige.
        route: 'lider',
        label: 'Meu ICD',
        icon: 'user-star',
        module: 'icd',
        breadcrumb: { path: 'Minha Jornada', current: 'Meu ICD' },
      },
      {
        route: 'jornada-mentorias',
        label: 'Minhas mentorias',
        icon: 'calendar-clock',
        module: 'mentorias',
        breadcrumb: { path: 'Minha Jornada', current: 'Minhas mentorias' },
      },
      {
        route: 'jornada-academia',
        label: 'Academia',
        icon: 'graduation-cap',
        module: 'biblioteca',
        breadcrumb: { path: 'Minha Jornada', current: 'Academia' },
      },
    ],
  },

  // ── Área da Organização ─────────────────────────────────────────────────────
  // Reorganização do mockup do cliente (Portal do Cliente, 22/07): três grupos —
  // Portal (operação da jornada) · Programas (frentes contratáveis) ·
  // Administração (gestão do próprio portal). Rotas existentes preservam o id
  // histórico (ex.: 'relatorios' = Plano de Evolução) para não invalidar as
  // listas de acesso por usuário (screenAccess) já gravadas.
  {
    title: 'Portal',
    context: 'ORGANIZACAO',
    items: [
      {
        route: 'dashboard',
        label: 'Visão Geral',
        icon: 'layout-dashboard',
        module: 'dashboard',
        breadcrumb: { path: 'Portal', current: 'Visão Geral Executiva' },
      },
      {
        route: 'organizacao',
        label: 'Minha Organização',
        icon: 'building-2',
        perm: 'branding:edit',
        breadcrumb: { path: 'Portal', current: 'Minha Organização' },
      },
      {
        // A jornada guiada é o diagnóstico de quem contratou INICIAL/ESSENCIAL.
        // Espelha BUILTIN_BY_METHOD (me.controller.ts): INICIAL e ESSENCIAL →
        // PRE_DIAGNOSTIC, que é esta tela.
        route: 'essencial',
        label: 'Diagnósticos',
        icon: 'clipboard-list',
        module: 'campanhas',
        roles: GESTAO_E_CONSULTORIA,
        methods: ['INICIAL', 'ESSENCIAL'],
        ownerMethods: ['INICIAL', 'ESSENCIAL'],
        breadcrumb: { path: 'Portal', current: 'Diagnósticos' },
      },
      {
        // Mockup 22/07 (/diagnosticos/nr1): a tela psicossocial existia mas
        // estava FORA do menu — só alcançável por link interno.
        // ORGANIZACIONAL → PSYCHOSOCIAL no BUILTIN_BY_METHOD: esta é a tela do
        // Diagnóstico Organizacional.
        route: 'psicossocial',
        label: 'NR-1 · Riscos Psicossociais',
        icon: 'heart-pulse',
        module: 'campanhas',
        roles: GESTAO_E_CONSULTORIA,
        // Só ORGANIZACIONAL. O item ficou visível para o ESSENCIAL enquanto ele
        // não tinha tela de resultado própria — mas esta lê a tabela do
        // psicossocial, que para o Essencial está SEMPRE vazia (as respostas dele
        // vão para outra). O resultado do Essencial agora vive na tela dele.
        methods: ['ORGANIZACIONAL'],
        // Mas o DONO é só ORGANIZACIONAL — o rename não deve usar o nome do
        // Essencial aqui (senão o item aparece "CRIVO Diagnóstico Essencial" 2×).
        ownerMethods: ['ORGANIZACIONAL'],
        breadcrumb: { path: 'Portal', current: 'NR-1 · Riscos Psicossociais' },
      },
      {
        // Cadastro de funcionários que vão responder o diagnóstico contratado
        // (link único por CPF, envio por e-mail/WhatsApp). Módulo 'campanhas'
        // (mesmo dos diagnósticos); SEM methods (serve qualquer diagnóstico).
        route: 'colaboradores',
        label: 'Colaboradores',
        icon: 'users',
        module: 'campanhas',
        roles: GESTAO_E_CONSULTORIA,
        breadcrumb: { path: 'Portal', current: 'Colaboradores' },
      },
      {
        route: 'campanhas',
        label: 'Campanhas de Diagnóstico',
        icon: 'megaphone',
        module: 'campanhas',
        roles: GESTAO_EMPRESA,
        breadcrumb: { path: 'Portal', current: 'Campanhas de Diagnóstico' },
      },
      {
        route: 'parecer',
        label: 'Parecer CRIVO',
        icon: 'scale',
        module: 'parecer',
        perm: 'parecer:view',
        breadcrumb: { path: 'Portal', current: 'Parecer Consultivo CRIVO' },
      },
      {
        route: 'relatorios',
        label: 'Plano de Evolução',
        icon: 'trending-up',
        module: 'relatorios',
        roles: LEITURA_GESTAO,
        breadcrumb: { path: 'Portal', current: 'Plano de Evolução' },
      },
      {
        route: 'evidencias',
        label: 'Evidências',
        icon: 'file-check-corner',
        module: 'relatorios',
        roles: LEITURA_GESTAO,
        breadcrumb: { path: 'Portal', current: 'Evidências' },
      },
      {
        route: 'documentos',
        label: 'Relatórios e Dossiês',
        icon: 'file-text',
        module: 'relatorios',
        roles: LEITURA_GESTAO,
        breadcrumb: { path: 'Portal', current: 'Relatórios e Dossiês' },
      },
      {
        route: 'grupo',
        label: 'Grupo Empresarial',
        icon: 'network',
        module: 'grupo',
        breadcrumb: { path: 'Portal', current: 'Consolidado do Grupo' },
      },
    ],
  },
  {
    // Grupo "Programas" EXATAMENTE como o protótipo Lovable do Portal do Cliente
    // (app-sidebar.tsx): 8 itens, nesta ordem e com estes rótulos. Cada item é
    // liberado pelo módulo do tenant (tenant_modules ← contrato/solução/adicional
    // no Super Admin). A parte individual do líder (ICD próprio, decisões,
    // Pocket) não é "programa": vive em Minha Jornada, no outro contexto.
    title: 'Programas',
    context: 'ORGANIZACAO',
    items: [
      {
        route: 'icd',
        label: 'Liderança',
        icon: 'compass',
        module: 'icd',
        perm: 'icd:view',
        breadcrumb: { path: 'Programas', current: 'Liderança' },
      },
      {
        route: 'govia',
        label: 'Governança de IA',
        icon: 'shield-check',
        module: 'govia',
        breadcrumb: { path: 'Programas', current: 'Governança de IA' },
      },
      {
        route: 'workforce',
        label: 'Workforce Intelligence',
        icon: 'cpu',
        module: 'workforce',
        breadcrumb: { path: 'Programas', current: 'Workforce Intelligence' },
      },
      {
        route: 'analytics',
        label: 'People Analytics',
        icon: 'chart-line',
        module: 'analytics',
        roles: LEITURA_GESTAO,
        breadcrumb: { path: 'Programas', current: 'People Analytics' },
      },
      {
        route: 'custo',
        label: 'Radar de Custos Invisíveis',
        icon: 'coins',
        module: 'custo',
        breadcrumb: { path: 'Programas', current: 'Radar de Custos Invisíveis' },
      },
      {
        route: 'contexto',
        label: 'Contexto e Diretrizes',
        icon: 'book-open',
        module: 'contexto',
        breadcrumb: { path: 'Programas', current: 'Contexto e Diretrizes' },
      },
      {
        route: 'biblioteca',
        label: 'Academia e Recursos',
        icon: 'graduation-cap',
        module: 'biblioteca',
        breadcrumb: { path: 'Programas', current: 'Academia e Recursos' },
      },
      {
        route: 'mentorias',
        label: 'Mentorias e Agenda',
        icon: 'calendar-clock',
        module: 'mentorias',
        breadcrumb: { path: 'Programas', current: 'Mentorias e Agenda' },
      },
    ],
  },
  {
    title: 'Administração',
    context: 'ORGANIZACAO',
    items: [
      {
        route: 'usuarios',
        label: 'Usuários e Acessos',
        icon: 'user-cog',
        perm: 'users:view',
        breadcrumb: { path: 'Administração', current: 'Usuários e Acessos' },
      },
      {
        route: 'papeis',
        label: 'Papéis & Permissões',
        icon: 'key-round',
        perm: 'users:view',
        breadcrumb: { path: 'Administração', current: 'Papéis & Permissões' },
      },
      {
        route: 'contratacao',
        label: 'Minha Contratação',
        icon: 'file-pen-line',
        breadcrumb: { path: 'Administração', current: 'Minha Contratação' },
      },
      {
        // Central de Notificações (protótipo Lovable › Administração). Sem
        // módulo nem permissão: cada aviso vem de uma fonte que já é gateada
        // pela API, e quem não lê nenhuma vê a central vazia.
        route: 'notificacoes',
        label: 'Notificações',
        icon: 'bell',
        breadcrumb: { path: 'Administração', current: 'Notificações' },
      },
      {
        route: 'historico',
        label: 'Histórico & Auditoria',
        icon: 'history',
        module: 'historico',
        roles: GESTAO_E_CONSULTORIA,
        breadcrumb: { path: 'Administração', current: 'Histórico & Auditoria' },
      },
      {
        route: 'suporte',
        label: 'Suporte',
        icon: 'life-buoy',
        breadcrumb: { path: 'Administração', current: 'Suporte' },
      },
    ],
  },
];

/**
 * Catálogo de TELAS atribuíveis a um usuário (checklist de acesso por usuário).
 * São os itens de nav com rota da Área da Organização — exceto Administração
 * (gestão), que fica restrita a quem tem permissão de admin. Minha Jornada não
 * entra: é a experiência privada do líder, liberada pelo contrato, e a
 * checklist corporativa não a governa. Agrupado para a UI.
 */
export const SCREEN_OPTIONS: { route: string; label: string; group: string }[] = NAV.flatMap(
  (g) =>
    g.context !== 'ORGANIZACAO' || g.title === 'Administração'
      ? []
      : g.items
          // 'grupo' (F3) é liberado por autorização de grupo, não pela checklist por usuário.
          .filter((i) => i.route && i.route !== 'grupo' && !i.hidden)
          .map((i) => ({ route: i.route!, label: i.label, group: g.title })),
);

/**
 * Acesso por rota (módulo e/ou permissão de ver) — alimenta o filtro da nav.
 * Entram TODOS os itens que declaram gate (module OU perm): antes o filtro
 * exigia module, e a perm declarada em itens sem módulo (organizacao, usuarios,
 * papeis) nunca era avaliada — o menu aparecia para qualquer papel.
 */
export const routeAccess: Record<string, { module?: string; perm?: string; roles?: readonly string[] }> = Object.fromEntries(
  NAV.flatMap((g) => g.items)
    .filter((i) => i.route && (i.module || i.perm || i.roles))
    .map((i) => [i.route!, { module: i.module, perm: i.perm, roles: i.roles }]),
);

/**
 * Métodos contratados por rota — esconde do menu o diagnóstico que a empresa
 * NÃO contratou. Só entram as rotas que declararam `methods`; as demais ficam
 * fora do mapa e continuam sem qualquer filtro por método.
 */
export const routeMethods: Record<string, string[]> = Object.fromEntries(
  NAV.flatMap((g) => g.items)
    .filter((i) => i.route && i.methods && i.methods.length > 0)
    .map((i) => [i.route!, i.methods!]),
);

/**
 * Métodos DONOS por rota — usado no rename do item com o nome da solução
 * contratada (só o item dono do método é renomeado). Ver NavItem.ownerMethods.
 */
export const routeOwnerMethods: Record<string, string[]> = Object.fromEntries(
  NAV.flatMap((g) => g.items)
    .filter((i) => i.route && i.ownerMethods && i.ownerMethods.length > 0)
    .map((i) => [i.route!, i.ownerMethods!]),
);

/** Breadcrumb por rota (topo da tela ao navegar). */
export const routeMeta: Record<string, { path: string; current: string }> = Object.fromEntries(
  NAV.flatMap((g) => g.items)
    .filter((i) => i.route && i.breadcrumb)
    .map((i) => [i.route!, i.breadcrumb!]),
);

/** Contexto de cada rota — cada uma pertence a UM contexto só. */
export const routeContext: Record<string, ClientContext> = Object.fromEntries(
  NAV.flatMap((g) => g.items.filter((i) => i.route).map((i) => [i.route!, g.context] as const)),
);

/**
 * HTML da sidebar gerado da config (injetado no shell legado por enquanto).
 * Sai UM <nav> por contexto, os dois no markup: os handlers do shell prendem
 * os itens uma vez só, e o CSS (pelo data-context do #app) mostra apenas o do
 * contexto ativo. Nenhum item nasce ativo — a home é decidida na entrada.
 */
export function renderNavHtml(): string {
  return CLIENT_CONTEXTS.map((context) => {
    const groups = NAV.filter((group) => group.context === context)
      .map((group) => {
        const items = group.items
          .filter((item) => !item.hidden)
          .map((item) => {
            const ic = `<span class="ni__ic ni__ic--svg">${navIconSvg(item.icon)}</span>`;
            if (!item.route) {
              return `        <a href="#" class="nav-item nav-item--muted">\n          ${ic}${item.label}\n        </a>`;
            }
            return `        <a href="#" class="nav-item" data-route="${item.route}">\n          ${ic}${item.label}\n        </a>`;
          })
          .join('\n');
        return `        <span class="sidebar__group">${group.title}</span>\n${items}`;
      })
      .join('\n\n');
    const label = CLIENT_CONTEXT_LABEL[context];
    return (
      `<nav class="sidebar__nav" data-context="${context}" aria-label="${label}">\n` +
      `        <span class="sidebar__ctx">${label}</span>\n${groups}\n      </nav>`
    );
  }).join('\n      ');
}
