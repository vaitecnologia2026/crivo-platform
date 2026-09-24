import {
  ACTION_STATUS_LABEL,
  LIBRARY_KIND_LABEL,
  ROLE_LABELS,
  type ActionPlanData,
  type CampaignSummary,
  type LibraryItemData,
  type UserSummary,
} from '@crivo/types';
import type { ReportEmissionMeta } from './api';
import type { PortalNotification } from './portal-notifications';

/**
 * Busca global do portal ("Buscar no portal… ⌘K" do protótipo Lovable) sobre
 * DADO REAL. Não há endpoint de busca: o índice é montado no navegador com as
 * listas que o usuário JÁ pode ler — telas visíveis para o papel/contrato,
 * ações e evidências do plano, relatórios emitidos, campanhas, usuários,
 * conteúdos da Academia e os avisos da central. Fonte que o papel não lê (403)
 * chega como null e simplesmente não entra. Escolher um resultado abre a TELA
 * dele — o portal ainda não tem link para um item específico.
 */

export type SearchCategory =
  | 'Tela'
  | 'Aviso'
  | 'Ação'
  | 'Evidência'
  | 'Relatório'
  | 'Campanha'
  | 'Usuário'
  | 'Academia';

export const SEARCH_CATEGORY_ORDER: SearchCategory[] = [
  'Tela',
  'Aviso',
  'Ação',
  'Evidência',
  'Relatório',
  'Campanha',
  'Usuário',
  'Academia',
];

export interface SearchEntry {
  id: string;
  category: SearchCategory;
  label: string;
  context: string | null;
  /** Tela do portal aberta ao escolher o resultado. */
  route: string;
  /** Texto normalizado (sem acento, minúsculo) onde a consulta procura. */
  haystack: string;
}

export interface SearchRoute {
  route: string;
  label: string;
  /** Grupo do menu (Portal, Programas…). */
  group: string;
}

export interface SearchSources {
  routes: SearchRoute[];
  plans: ActionPlanData[] | null;
  emissions: ReportEmissionMeta[] | null;
  campaigns: CampaignSummary[] | null;
  users: UserSummary[] | null;
  library: LibraryItemData[] | null;
  notifications: PortalNotification[] | null;
}

export interface SearchGroup {
  category: SearchCategory;
  entries: SearchEntry[];
  /** Total que casou na categoria (entries pode vir cortado). */
  total: number;
}

const EVIDENCE_STATUS_LABEL: Record<string, string> = {
  ENVIADA: 'Enviada',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  SUBSTITUIDA: 'Substituída',
};

/** Minúsculo, sem acento e com espaço simples — "Ação" casa com "acao". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** dd/mm/aaaa na hora local — o mesmo formato do prazo no Plano de Evolução
 *  (a API grava o prazo ao meio-dia de Brasília, então não troca de dia). */
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR');
}

function entry(
  id: string,
  category: SearchCategory,
  label: string,
  context: string | null,
  route: string,
  extra: Array<string | null | undefined> = [],
): SearchEntry {
  return {
    id,
    category,
    label,
    context,
    route,
    haystack: normalize([label, context, ...extra].filter(Boolean).join(' ')),
  };
}

export function buildSearchIndex(src: SearchSources): SearchEntry[] {
  const out: SearchEntry[] = [];

  for (const r of src.routes) {
    out.push(entry(`tela:${r.route}`, 'Tela', r.label, r.group, r.route));
  }

  for (const n of src.notifications ?? []) {
    out.push(entry(`aviso:${n.id}`, 'Aviso', n.title, n.kind, 'notificacoes', [n.detail]));
  }

  for (const plan of src.plans ?? []) {
    for (const item of plan.items) {
      const prazo = fmtDate(item.dueDate);
      out.push(
        entry(
          `acao:${item.id}`,
          'Ação',
          item.action,
          [
            ACTION_STATUS_LABEL[item.status] ?? item.status,
            item.responsible ?? 'sem responsável',
            prazo ? `prazo ${prazo}` : null,
            item.scopeGhe ?? null,
          ]
            .filter(Boolean)
            .join(' · '),
          'relatorios',
          [item.point, item.origin, item.objective, plan.title],
        ),
      );
      for (const ev of item.evidences) {
        out.push(
          entry(
            `evidencia:${ev.id}`,
            'Evidência',
            ev.title,
            `${EVIDENCE_STATUS_LABEL[ev.status] ?? ev.status} · ação: ${item.action}`,
            'evidencias',
            [ev.fileName, ev.note],
          ),
        );
      }
    }
  }

  for (const e of src.emissions ?? []) {
    const em = fmtDate(e.createdAt);
    out.push(
      entry(
        `relatorio:${e.id}`,
        'Relatório',
        `${e.title} · nº ${e.emissionNumber}`,
        [em ? `emitido em ${em}` : null, e.status === 'REVISADA' ? 'revisado' : null].filter(Boolean).join(' · ') || null,
        'documentos',
        [e.generatedBy, e.type],
      ),
    );
  }

  for (const c of src.campaigns ?? []) {
    out.push(
      entry(
        `campanha:${c.id}`,
        'Campanha',
        c.name,
        `${c.status === 'OPEN' ? 'Aberta' : 'Encerrada'} · ${c.respondentes} resposta${c.respondentes === 1 ? '' : 's'}`,
        'campanhas',
        [c.sector, c.description],
      ),
    );
  }

  for (const u of src.users ?? []) {
    out.push(
      entry(
        `usuario:${u.id}`,
        'Usuário',
        u.name,
        [u.email, ROLE_LABELS[u.role] ?? u.role, u.active ? null : 'inativo'].filter(Boolean).join(' · '),
        'usuarios',
      ),
    );
  }

  for (const l of src.library ?? []) {
    out.push(
      entry(
        `academia:${l.id}`,
        'Academia',
        l.title,
        LIBRARY_KIND_LABEL[l.kind] ?? l.kind,
        'biblioteca',
        [l.description],
      ),
    );
  }

  return out;
}

/**
 * Todas as palavras da consulta precisam aparecer (em qualquer ordem). Ordena:
 * rótulo que começa com a consulta, depois rótulo que contém todas as
 * palavras, depois o resto; empate pelo rótulo mais curto. Consulta vazia
 * lista só as telas — é o "para onde ir" do protótipo.
 */
export function searchPortal(index: SearchEntry[], query: string, perCategory = 6): SearchGroup[] {
  const q = normalize(query);
  const tokens = q ? q.split(' ') : [];
  const matched = tokens.length
    ? index.filter((e) => tokens.every((t) => e.haystack.includes(t)))
    : index.filter((e) => e.category === 'Tela');

  const rank = (e: SearchEntry): number => {
    if (!tokens.length) return 0;
    const label = normalize(e.label);
    if (label.startsWith(q)) return 0;
    if (tokens.every((t) => label.includes(t))) return 1;
    return 2;
  };

  const groups: SearchGroup[] = [];
  for (const category of SEARCH_CATEGORY_ORDER) {
    const inCategory = matched.filter((e) => e.category === category);
    // Sem consulta, as telas ficam na ordem do menu.
    const all = tokens.length
      ? inCategory
          .map((e) => ({ e, r: rank(e) }))
          .sort((a, b) => a.r - b.r || a.e.label.length - b.e.label.length)
          .map((x) => x.e)
      : inCategory;
    if (!all.length) continue;
    const limit = !tokens.length && category === 'Tela' ? all.length : perCategory;
    groups.push({ category, entries: all.slice(0, limit), total: all.length });
  }
  return groups;
}
