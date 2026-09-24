"use client";

import { badgeText, unreadCount } from "@/lib/portal-notifications";
import { portalNavigate, usePortal } from "@/lib/portal-shell";
import { IconBell } from "./Icons";

/**
 * Sino da barra superior (protótipo Lovable: Bell → /notificacoes). O número é
 * o de avisos REAIS ainda não lidos neste aparelho (lib/portal-notifications);
 * antes a bolinha vermelha ficava acesa sempre, sem contar nada.
 */
export function NotificationBell() {
  const { notifications, readIds } = usePortal();
  const unread = notifications ? unreadCount(notifications, readIds) : 0;
  const badge = badgeText(unread);
  const label = unread ? `Notificações: ${unread} não lida${unread === 1 ? "" : "s"}` : "Notificações";
  return (
    <button
      type="button"
      className="icon-btn"
      title={label}
      aria-label={label}
      onClick={() => portalNavigate("notificacoes")}
    >
      <IconBell size={18} />
      {badge && (
        <span className="badge-count" aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
}
