import type {
  ActionPlanData,
  CampaignSummary,
  OperationalAlertsResult,
} from '@crivo/types';
import type { ReportEmissionMeta } from './api';

/**
 * Central de Notificações do portal (protótipo Lovable › /notificacoes) com DADO
 * REAL. Não existe tabela de notificações: cada aviso é DERIVADO do estado atual
 * — alertas e travas do plano (/alerts), evidências rejeitadas pela CRIVO,
 * relatórios emitidos e campanhas perto do fim. O id é estável enquanto a
 * situação é a mesma, e é ele que o "lida" guarda (no aparelho). Mudou a
 * situação (outra contagem, outro prazo), muda o id e o aviso volta como novo.
 */

export type NotificationSeverity = 'high' | 'warn' | 'info';

export interface PortalNotification {
  id: string;
  severity: NotificationSeverity;
  /** Rótulo curto do tipo (coluna "tipo" da lista). */
  kind: string;
  title: string;
  detail: string | null;
  /** Tela do portal que resolve o aviso. */
  route: string;
  /** ISO — quando o fato aconteceu; null quando é um estado (ex.: trava). */
  at: string | null;
}

export interface NotificationSources {
  alerts: OperationalAlertsResult | null;
  plans: ActionPlanData[] | null;
  emissions: ReportEmissionMeta[] | null;
  campaigns: CampaignSummary[] | null;
}

/** Relatório emitido entra como aviso por este tempo. */
export const EMISSION_WINDOW_DAYS = 30;
/** Campanha aberta avisa quando faltam até estes dias para o encerramento. */
export const CAMPAIGN_ENDING_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;
const SEVERITY_ORDER: Record<NotificationSeverity, number> = { high: 0, warn: 1, info: 2 };

/** Hash curto e estável (FNV-1a) — o alerta de /alerts não tem id próprio. */
export function stableHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Ação nestes status não gera mais aviso de evidência. */
const ITEM_CLOSED = new Set(['CONCLUIDA', 'REAVALIADA', 'NAO_ADOTADA']);

const ALERT_ROUTE: Record<string, string> = { 'baixa-adesao': 'campanhas' };
const ALERT_KIND: Record<string, string> = {
  'baixa-adesao': 'Campanha',
  'sugestoes-pendentes': 'Plano de Evolução',
  'acao-atrasada': 'Ação atrasada',
  'evidencia-pendente': 'Evidência pendente',
};

export function buildNotifications(src: NotificationSources, nowMs: number): PortalNotification[] {
  const out: PortalNotification[] = [];

  for (const a of src.alerts?.alerts ?? []) {
    out.push({
      id: `alerta:${a.kind}:${stableHash(a.message)}`,
      severity: a.severity,
      kind: ALERT_KIND[a.kind] ?? 'Alerta',
      title: a.message,
      detail: null,
      route: ALERT_ROUTE[a.kind] ?? 'relatorios',
      at: null,
    });
  }
  // Trava = o plano não avança sem resolver (prazo, responsável, evidência
  // esperada, validação). É crítica por definição (§12).
  for (const l of src.alerts?.locks ?? []) {
    out.push({
      id: `trava:${l.kind}:${stableHash(l.message)}`,
      severity: 'high',
      kind: 'Trava',
      title: l.message,
      detail: null,
      route: 'relatorios',
      at: null,
    });
  }

  for (const plan of src.plans ?? []) {
    for (const item of plan.items) {
      // Ação encerrada não pede nova evidência.
      if (ITEM_CLOSED.has(item.status)) continue;
      for (const ev of item.evidences) {
        if (ev.status !== 'REJEITADA') continue;
        // O cliente não apaga a rejeitada: o reenvio é uma evidência NOVA na
        // mesma ação. Houve envio depois dela que não foi rejeitado → resolvido.
        const t = Date.parse(ev.createdAt);
        const reenviada = item.evidences.some(
          (o) => o.id !== ev.id && o.status !== 'REJEITADA' && Date.parse(o.createdAt) > t,
        );
        if (reenviada) continue;
        out.push({
          id: `evidencia-rejeitada:${ev.id}`,
          severity: 'warn',
          kind: 'Evidência rejeitada',
          title: `Evidência "${ev.title}" rejeitada na revisão da CRIVO.`,
          detail: `Ação: ${item.action}. Envie uma nova evidência.`,
          route: 'evidencias',
          // O portal não recebe a data da REVISÃO (só a do envio): sem data,
          // em vez de uma que pareça ser a da rejeição.
          at: null,
        });
      }
    }
  }

  for (const e of src.emissions ?? []) {
    const t = Date.parse(e.createdAt);
    if (!Number.isFinite(t) || nowMs - t > EMISSION_WINDOW_DAYS * DAY || t > nowMs + DAY) continue;
    out.push({
      id: `emissao:${e.id}`,
      severity: 'info',
      kind: 'Relatório emitido',
      title: `${e.title} emitido (nº ${e.emissionNumber}).`,
      detail: e.generatedBy ? `Emitido por ${e.generatedBy}.` : null,
      route: 'documentos',
      at: e.createdAt,
    });
  }

  for (const c of src.campaigns ?? []) {
    if (c.status !== 'OPEN' || !c.endsAt) continue;
    const fim = Date.parse(c.endsAt);
    if (!Number.isFinite(fim)) continue;
    const falta = fim - nowMs;
    if (falta > CAMPAIGN_ENDING_DAYS * DAY) continue;
    const dias = Math.ceil(falta / DAY);
    out.push({
      // O prazo entra no id: prorrogou, o aviso volta como novo.
      id: `campanha-prazo:${c.id}:${c.endsAt}`,
      severity: 'warn',
      kind: 'Campanha',
      title:
        falta < 0
          ? `Campanha "${c.name}" passou do prazo e continua aberta.`
          : falta < DAY
            ? `Campanha "${c.name}" encerra em menos de 24 horas.`
            : `Campanha "${c.name}" encerra em ${dias} dia${dias === 1 ? '' : 's'}.`,
      detail: `${c.respondidos} de ${c.convidados} convidados responderam.`,
      route: 'campanhas',
      at: null,
    });
  }

  // Mais grave primeiro; no mesmo nível, o fato mais recente primeiro.
  return uniqueIds(
    out.sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (b.at ? Date.parse(b.at) : 0) - (a.at ? Date.parse(a.at) : 0),
    ),
  );
}

/**
 * Alerta e trava não têm id próprio (o id sai do texto), e duas ações com o
 * mesmo texto — a mesma medida na Organização e num GHE, comum no plano
 * automático — dariam o mesmo id. A 2ª ocorrência vira `id#2`, e assim por
 * diante: cada linha tem chave única e seu próprio "lida".
 */
function uniqueIds(list: PortalNotification[]): PortalNotification[] {
  const seen = new Map<string, number>();
  return list.map((n) => {
    const k = (seen.get(n.id) ?? 0) + 1;
    seen.set(n.id, k);
    return k === 1 ? n : { ...n, id: `${n.id}#${k}` };
  });
}

/** Quantas ainda não foram lidas. */
export function unreadCount(list: PortalNotification[], readIds: ReadonlySet<string>): number {
  return list.reduce((n, x) => (readIds.has(x.id) ? n : n + 1), 0);
}

/** Texto do contador do sino: nada, o número ou "9+". */
export function badgeText(unread: number): string {
  if (unread <= 0) return '';
  return unread > 9 ? '9+' : String(unread);
}
