"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { PLAN_LABELS, type PlatformAdmin, type TenantStatus } from "@crivo/types";
import {
  getAuditLog,
  getOverview,
  type AdminOverview,
  type AuditEntry,
} from "@/lib/admin-api";
import { TenantsManager } from "./TenantsManager";
import { CrmSection } from "./CrmSection";
import { ProductsSection } from "./ProductsSection";
import { AiSettingsSection } from "./AiSettingsSection";

/** Símbolo Vértice — a marca CRIVO (mesmo traço da plataforma). */
function VerticeMark() {
  return (
    <svg className="vertice" viewBox="0 0 48 44" fill="none" aria-hidden="true">
      <line x1="5" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="43" y1="37" x2="24" y2="6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="5" y1="37" x2="17" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="31" y1="37" x2="43" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="6" r="3.6" fill="#C4894A" />
      <circle cx="24" cy="6" r="1.6" fill="#F2F0EC" />
    </svg>
  );
}

type Section = "overview" | "crm" | "produtos" | "empresas" | "ia" | "auditoria";

const NAV: { key: Section; label: string; icon: string; current: string; group: string }[] = [
  { key: "overview", label: "Visão geral", icon: "▣", current: "Visão Geral", group: "Plataforma" },
  { key: "crm", label: "CRM — Funil", icon: "◔", current: "CRM — Funil", group: "Comercial" },
  { key: "produtos", label: "Produtos", icon: "◈", current: "Produtos", group: "Comercial" },
  { key: "empresas", label: "Empresas-cliente", icon: "◧", current: "Empresas-cliente", group: "Plataforma" },
  { key: "ia", label: "Configurações de IA", icon: "✦", current: "Configurações de IA", group: "Plataforma" },
  { key: "auditoria", label: "Auditoria", icon: "▤", current: "Auditoria", group: "Plataforma" },
];

// Reset para usar a classe .nav-item (estilizada para <a>) em <button>.
const navBtn: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: 0,
  textAlign: "left",
  font: "inherit",
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** Painel do Super Admin — mesmo shell visual da plataforma (app.css). */
export function AdminShell({ admin, onLogout }: { admin: PlatformAdmin; onLogout: () => void }) {
  const [section, setSection] = useState<Section>("overview");
  const current = NAV.find((n) => n.key === section)!;

  return (
    <div className="screen screen--app is-active">
      <aside className="sidebar">
        <div className="sidebar__brand brand__lockup">
          <VerticeMark />
          <span className="brand__text">
            <span className="brand__name">CRIVO</span>
            <span className="brand__sub">Decision Intelligence</span>
          </span>
        </div>

        <nav className="sidebar__nav">
          {NAV.map((n, i) => (
            <div key={n.key}>
              {(i === 0 || NAV[i - 1].group !== n.group) && (
                <span className="sidebar__group">{n.group}</span>
              )}
              <button
                type="button"
                style={navBtn}
                className={`nav-item${section === n.key ? " is-active" : ""}`}
                onClick={() => setSection(n.key)}
              >
                <span className="ni__ic">{n.icon}</span>
                {n.label}
              </button>
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="org-card">
            <div className="org-card__avatar">{initials(admin.name)}</div>
            <div>
              <strong>{admin.name}</strong>
              <span>Super Admin</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            style={{ ...navBtn, marginTop: 10, color: "var(--crivo-terra-dourado)", fontSize: 12 }}
          >
            Sair da plataforma
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar__breadcrumb">
            <span className="bc__path">Control Plane</span>
            <span className="bc__sep">/</span>
            <span className="bc__current">{current.current}</span>
          </div>
          <div className="topbar__actions">
            <div className="user-chip">
              <div className="user-chip__avatar">{initials(admin.name)}</div>
              <div>
                <strong>{admin.name}</strong>
                <span>Super Admin · CRIVO</span>
              </div>
            </div>
            <button className="icon-btn" onClick={onLogout} title="Sair">↶</button>
          </div>
        </header>

        <section className="route is-active">
          {section === "overview" && <OverviewSection onGoToEmpresas={() => setSection("empresas")} />}
          {section === "crm" && <CrmSection />}
          {section === "produtos" && <ProductsSection />}
          {section === "empresas" && <TenantsManager admin={admin} onLogout={onLogout} embedded />}
          {section === "ia" && <AiSettingsSection />}
          {section === "auditoria" && <AuditSection />}
        </section>
      </main>
    </div>
  );
}

const STATUS_LABEL: Record<TenantStatus, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Bloqueada",
  DELETED: "Excluída",
};

function OverviewSection({ onGoToEmpresas }: { onGoToEmpresas: () => void }) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getOverview();
        if (alive) { setData(d); setStatus("ok"); }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Visão geral</h1>
          <p className="page-sub">Indicadores da plataforma CRIVO — todas as empresas-cliente.</p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando indicadores…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar os indicadores.</div>}

      {status === "ok" && data && (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">Empresas</span>
              <strong className="kpi__value">{data.totalTenants}</strong>
              <span className="kpi__delta">{data.byStatus.ACTIVE ?? 0} ativas</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Bloqueadas</span>
              <strong className="kpi__value">{data.byStatus.SUSPENDED ?? 0}</strong>
              <span className="kpi__delta">acesso suspenso</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Usuários ativos</span>
              <strong className="kpi__value">{data.activeUsers}</strong>
              <span className="kpi__delta">de {data.totalUsers} no total</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Leads no pipeline</span>
              <strong className="kpi__value">{data.totalLeads}</strong>
              <span className="kpi__delta">todas as empresas</span>
            </div>
          </div>

          <div className="grid grid--2" style={{ marginTop: 20 }}>
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Empresas por plano</h3>
                  <span className="card__sub">Distribuição da base de clientes</span>
                </div>
              </div>
              <div className="dash-dist">
                {Object.entries(data.byPlan).map(([plan, n]) => (
                  <span key={plan} className="dash-dist__item">
                    {PLAN_LABELS[plan as keyof typeof PLAN_LABELS] ?? plan}: <strong>{n}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Empresas recentes</h3>
                  <span className="card__sub">Últimas provisionadas</span>
                </div>
                <button className="btn btn--outline-dark btn--sm" onClick={onGoToEmpresas}>
                  Ver todas
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Empresa</th><th>Plano</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.recentTenants.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.name}</strong></td>
                      <td>{PLAN_LABELS[t.plan]}</td>
                      <td><span className="pattern-tag">{STATUS_LABEL[t.status]}</span></td>
                    </tr>
                  ))}
                  {data.recentTenants.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: "center", padding: 24 }}>Nenhuma empresa ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "admin.login": "Login do super admin",
  "tenant.provision": "Empresa provisionada",
  "tenant.suspend": "Empresa bloqueada",
  "tenant.activate": "Empresa reativada",
  "tenant.delete": "Empresa excluída",
  "tenant.plan.change": "Plano alterado",
  "tenant.module.enable": "Módulo ativado",
  "tenant.module.disable": "Módulo desativado",
  "tenant.branding.update": "Marca atualizada",
  "tenant.domain.add": "Domínio adicionado",
  "tenant.domain.remove": "Domínio removido",
  "tenant.domain.primary": "Domínio canônico",
  "admin.password.change": "Senha do super admin",
  "admin.mfa.enable": "MFA ativado",
  "admin.mfa.disable": "MFA desativado",
  "product.create": "Produto criado",
  "product.update": "Produto atualizado",
  "product.delete": "Produto excluído",
  "lead.intake": "Lead capturado (LP)",
  "lead.stage": "Lead movido no funil",
  "lead.notes": "Nota do lead",
  "lead.convert": "Lead convertido em cliente",
  "contract.create": "Contrato criado",
  "contract.update": "Contrato atualizado",
  "ai.config.update": "Config de IA atualizada",
  "ai.test": "Conexão de IA testada",
};

function AuditSection() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getAuditLog();
        if (alive) { setRows(d); setStatus("ok"); }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Auditoria</h1>
          <p className="page-sub">Trilha das ações de plataforma (control plane).</p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando auditoria…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar a auditoria.</div>}

      {status === "ok" && rows && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr><th>Quando</th><th>Ação</th><th>Ator</th><th>Alvo</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.at).toLocaleString("pt-BR")}</td>
                  <td><strong>{ACTION_LABEL[r.action] ?? r.action}</strong></td>
                  <td>{r.actorEmail ?? "—"}</td>
                  <td>{r.target ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 24 }}>Nenhum registro ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
