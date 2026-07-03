"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { type PlatformAdmin } from "@crivo/types";
import { getAuditLog, type AuditEntry } from "@/lib/admin-api";
import { DashboardSection } from "./DashboardSection";
import { TenantsManager } from "./TenantsManager";
import { CrmSection } from "./CrmSection";
import { ProductsSection } from "./ProductsSection";
import { AiSettingsSection } from "./AiSettingsSection";
import { ExtrasSection } from "./ExtrasSection";
import { RbacSection } from "./RbacSection";
import { CnaeSection } from "./CnaeSection";
import { CnpjLookupCard } from "./CnpjLookupCard";
import { ContractsSection } from "./ContractsSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { MethodologySection } from "./MethodologySection";
import { BaseCrivoSection } from "./BaseCrivoSection";
import "./admin.css";

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

type Section = "overview" | "crm" | "produtos" | "cnae" | "metodologia" | "contratos" | "empresas" | "integracoes" | "basecrivo" | "ia" | "extras" | "rbac" | "auditoria";

// Ordem = grupos CONTÍGUOS (Geral · Comercial · Plataforma) para a sidebar não
// repetir cabeçalho de grupo. Não reordenar sem manter a contiguidade.
const NAV: { key: Section; label: string; icon: string; current: string; group: string }[] = [
  { key: "overview", label: "Dashboard de Gestão", icon: "▣", current: "Dashboard de Gestão CRIVO", group: "Geral" },
  { key: "crm", label: "CRM — Funil", icon: "◔", current: "CRM — Funil", group: "Comercial" },
  { key: "produtos", label: "Soluções CRIVO", icon: "◈", current: "Soluções CRIVO", group: "Comercial" },
  { key: "cnae", label: "Motor de Enquadramento", icon: "◎", current: "Motor de Enquadramento CRIVO", group: "Comercial" },
  { key: "contratos", label: "Contratos", icon: "▦", current: "Contratos", group: "Comercial" },
  { key: "empresas", label: "Grupos e Empresas-cliente", icon: "◧", current: "Grupos e Empresas-cliente", group: "Plataforma" },
  { key: "integracoes", label: "Integrações", icon: "◬", current: "Integrações", group: "Plataforma" },
  { key: "metodologia", label: "Metodologia", icon: "❖", current: "Metodologia configurável", group: "Plataforma" },
  { key: "basecrivo", label: "Base CRIVO", icon: "◍", current: "Base CRIVO · Benchmarks", group: "Plataforma" },
  { key: "ia", label: "Configurações de IA", icon: "✦", current: "Configurações de IA", group: "Plataforma" },
  { key: "extras", label: "Recursos da Entrega", icon: "◑", current: "Recursos da Entrega", group: "Plataforma" },
  { key: "rbac", label: "Papéis & Permissões", icon: "▥", current: "Papéis & Permissões", group: "Plataforma" },
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
    <div className="screen screen--app is-active adm">
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
            <button
              type="button"
              className="btn btn--outline-dark btn--sm"
              onClick={onLogout}
              title="Encerrar sessão"
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 17l-5-5 5-5M5 12h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sair
            </button>
          </div>
        </header>

        <section className="route is-active">
          {section === "overview" && <OverviewSection onNavigate={(s) => setSection(s as Section)} />}
          {section === "crm" && <CrmSection />}
          {section === "produtos" && <ProductsSection />}
          {section === "cnae" && <CnaeSection />}
          {section === "contratos" && <ContractsSection />}
          {section === "empresas" && <TenantsManager admin={admin} onLogout={onLogout} embedded />}
          {section === "integracoes" && <IntegrationsSection />}
          {section === "metodologia" && <MethodologySection />}
          {section === "basecrivo" && <BaseCrivoSection />}
          {section === "ia" && <AiSettingsSection />}
          {section === "extras" && <ExtrasSection />}
          {section === "rbac" && <RbacSection />}
          {section === "auditoria" && <AuditSection />}
        </section>
      </main>
    </div>
  );
}


function OverviewSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Dashboard de Gestão CRIVO</h1>
          <p className="page-sub">Central operacional — comercial, contratos, entregas e pendências.</p>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <CnpjLookupCard />
      </div>

      <DashboardSection onNavigate={onNavigate} />
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
