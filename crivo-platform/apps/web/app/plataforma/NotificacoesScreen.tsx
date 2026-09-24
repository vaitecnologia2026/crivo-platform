"use client";

import { useRef, useState } from "react";
import { unreadCount, type NotificationSeverity, type PortalNotification } from "@/lib/portal-notifications";
import {
  SOURCE_LABEL,
  canSeeRoute,
  markAllNotificationsRead,
  markNotificationRead,
  portalNavigate,
  refreshPortalData,
  usePortal,
} from "@/lib/portal-shell";
import { IconBell, IconCheck, IconRefresh } from "./Icons";

const SEV_LABEL: Record<NotificationSeverity, string> = { high: "Crítico", warn: "Atenção", info: "Aviso" };

function fmtAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function listaPtBr(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * Notificações — protótipo Lovable (/notificacoes) com dado real: a lista vem de
 * lib/portal-notifications (alertas e travas do plano, evidências rejeitadas,
 * relatórios emitidos, campanhas perto do prazo). Não há caixa de entrada no
 * servidor: "lida" fica guardado neste aparelho, e a tela diz isso.
 *
 * A ilha é montada uma vez só; quem recarrega ao ENTRAR na tela é o shell
 * (setRoute → refreshPortalData), não um efeito de montagem.
 */
export function NotificacoesScreen() {
  const portal = usePortal();
  const { notifications, readIds, loading, failed } = portal;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [announce, setAnnounce] = useState("");

  const unread = notifications ? unreadCount(notifications, readIds) : 0;
  const falhou = listaPtBr(failed.map((s) => SOURCE_LABEL[s]));

  const marcarTodas = () => {
    markAllNotificationsRead();
    setAnnounce("Todas as notificações foram marcadas como lidas.");
    // O botão fica desabilitado com o foco em cima: leva o foco ao título.
    titleRef.current?.focus();
  };

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title" ref={titleRef} tabIndex={-1}>
            Notificações
          </h1>
          <p className="page-sub">
            Central de atualizações do portal
            {notifications ? ` · ${unread} não lida${unread === 1 ? "" : "s"}` : ""}.
          </p>
        </div>
        <div className="route__actions">
          <button
            type="button"
            className="btn btn--ghost-dark btn--sm"
            onClick={() => void refreshPortalData()}
            disabled={loading}
          >
            <IconRefresh size={14} /> {loading ? "Atualizando…" : "Atualizar"}
          </button>
          <button type="button" className="btn btn--ghost-dark btn--sm" onClick={marcarTodas} disabled={unread === 0}>
            <IconCheck size={14} /> Marcar todas como lidas
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {failed.length > 0 && notifications && notifications.length > 0 && (
        <p className="dash-state dash-state--error" style={{ marginBottom: 16 }}>
          Não foi possível carregar {falhou} agora — a lista pode estar incompleta. Tente Atualizar.
        </p>
      )}

      {notifications === null ? (
        <p className="dash-state">Carregando notificações…</p>
      ) : notifications.length === 0 ? (
        failed.length > 0 ? (
          // Sem ter conseguido olhar, não dá para dizer que não há nada.
          <p className="dash-state dash-state--error">
            Não foi possível carregar {falhou} agora. Tente Atualizar.
          </p>
        ) : (
          <div className="card notif-empty">
            <strong>Nada pendente agora.</strong>
            <span>
              Aparecem aqui ações atrasadas, travas do plano de ação, evidências rejeitadas pela CRIVO, relatórios
              emitidos nos últimos 30 dias e campanhas perto do prazo.
            </span>
          </div>
        )
      ) : (
        <div className="card notif-card">
          <ul className="notif-list">
            {notifications.map((n, i) => (
              <NotifRow
                key={n.id}
                n={n}
                index={i}
                unread={!readIds.has(n.id)}
                canOpen={canSeeRoute(n.route, portal)}
                onRead={() => setAnnounce(`Marcada como lida: ${n.title}`)}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="prod-note">
        Os avisos são calculados na hora a partir do plano de ação, das evidências, dos relatórios emitidos e das
        campanhas. Resolvida a pendência, o aviso sai da lista. O status de lida fica guardado neste aparelho.
      </p>
    </>
  );
}

function NotifRow({
  n,
  index,
  unread,
  canOpen,
  onRead,
}: {
  n: PortalNotification;
  index: number;
  unread: boolean;
  /** A tela do aviso está liberada para este usuário (senão não há "Abrir"). */
  canOpen: boolean;
  onRead: () => void;
}) {
  const meta = [n.kind, SEV_LABEL[n.severity], fmtAt(n.at)].filter(Boolean).join(" · ");
  const rowId = `notif-row-${index}`;
  return (
    <li id={rowId} tabIndex={-1} className={`notif-row${unread ? " is-unread" : ""}`}>
      <span className={`notif-row__ic notif-row__ic--${n.severity}`} aria-hidden="true">
        <IconBell size={15} />
      </span>
      <div className="notif-row__body">
        <div className="notif-row__title">{n.title}</div>
        {n.detail && <div className="notif-row__detail">{n.detail}</div>}
        <div className="notif-row__meta">{meta}</div>
      </div>
      <div className="notif-row__actions">
        {unread && <span className="pill pill--sm pill--gold">Nova</span>}
        {canOpen && (
          <button
            type="button"
            className="btn btn--ghost-dark btn--sm"
            aria-label={`Abrir: ${n.title}`}
            onClick={() => {
              markNotificationRead(n.id);
              portalNavigate(n.route);
            }}
          >
            Abrir
          </button>
        )}
        {unread && (
          <button
            type="button"
            className="icon-btn notif-row__read"
            title="Marcar como lida"
            aria-label={`Marcar como lida: ${n.title}`}
            onClick={() => {
              markNotificationRead(n.id);
              onRead();
              // O botão some ao marcar: o foco fica na própria linha, não no body.
              document.getElementById(rowId)?.focus();
            }}
          >
            <IconCheck size={15} />
          </button>
        )}
      </div>
    </li>
  );
}
