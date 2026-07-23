"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { type PlatformAdmin } from "@crivo/types";
import { getAuditLog, type AuditEntry } from "@/lib/admin-api";
import { DashboardSection } from "./DashboardSection";
import { TenantsManager } from "./TenantsManager";
import { CrmSection } from "./CrmSection";
import { ProductsSection } from "./ProductsSection";
import { AddonsSection } from "./AddonsSection";
import { AiSettingsSection } from "./AiSettingsSection";
import { NotificationsSection } from "./NotificationsSection";
import { ExtrasSection } from "./ExtrasSection";
import { RbacSection } from "./RbacSection";
import { CnaeSection } from "./CnaeSection";
import { CnpjLookupCard } from "./CnpjLookupCard";
import { ContractsSection } from "./ContractsSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { MethodologySection } from "./MethodologySection";
import { EngineConfigSection } from "./EngineConfigSection";
import { EvolutionSection } from "./EvolutionSection";
import { EvidencesSection } from "./EvidencesSection";
import { ReportsSection } from "./ReportsSection";
import { BaseCrivoSection } from "./BaseCrivoSection";
import { IntelligenceSection } from "./IntelligenceSection";
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

type Section = "overview" | "crm" | "produtos" | "adicionais" | "cnae" | "metodologia" | "evolucao" | "evidencias" | "relatorios" | "engineconfig" | "contratos" | "empresas" | "integracoes" | "inteligencia" | "basecrivo" | "ia" | "notificacoes" | "extras" | "rbac" | "auditoria";

// Ordem = grupos CONTÍGUOS (Geral · Comercial · Plataforma) para a sidebar não
// repetir cabeçalho de grupo. Não reordenar sem manter a contiguidade.
/* Ícones de traço da sidebar (redesign aprovado — substituem os glifos de texto). */
const NI = {
  dashboard: <svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/></svg>,
  funil: <svg viewBox="0 0 24 24" fill="none"><path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>,
  empresas: <svg viewBox="0 0 24 24" fill="none"><path d="M4 20V6l6-3v17M10 20h10V9l-6-2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M7 8v.01M7 11v.01M7 14v.01M15 12v.01M15 15v.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
  contratos: <svg viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v14H6V3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M15 3v4h4M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
  solucoes: <svg viewBox="0 0 24 24" fill="none"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 12v9M12 12 4 7.5M12 12l8-4.5" stroke="currentColor" strokeWidth="1.5"/></svg>,
  enquadramento: <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.7"/><path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  diagnosticos: <svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7"/><path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M8 12.5v-2M10.5 12.5V9M13 12.5v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  entrega: <svg viewBox="0 0 24 24" fill="none"><path d="M12 6c-1.8-1.3-4-1.9-6.5-1.9v13.4c2.5 0 4.7.6 6.5 1.9 1.8-1.3 4-1.9 6.5-1.9V4.1C16 4.1 13.8 4.7 12 6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 6v13.4" stroke="currentColor" strokeWidth="1.5"/></svg>,
  inteligencia: <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V9M9.5 19V5M15 19v-8M20 19v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
  base: <svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="6" rx="7" ry="2.8" stroke="currentColor" strokeWidth="1.7"/><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" stroke="currentColor" strokeWidth="1.7"/></svg>,
  ia: <svg viewBox="0 0 24 24" fill="none"><rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  integracoes: <svg viewBox="0 0 24 24" fill="none"><path d="M9 7H6a3 3 0 0 0 0 6h3M15 7h3a3 3 0 0 1 0 6h-3M8.5 10h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M12 16v4m-3-2h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  rbac: <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.7"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M16.5 9.5 18 11l3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  auditoria: <svg viewBox="0 0 24 24" fill="none"><path d="M12 3 5 5.8v5C5 15.6 7.9 19.4 12 21c4.1-1.6 7-5.4 7-10.2v-5L12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9.5 12h5M12 9.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  adicionais: <svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="12.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="12.5" y="12.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="8" y="3.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><path d="M18 5.5h4M20 3.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  evolucao: <svg viewBox="0 0 24 24" fill="none"><path d="M5 15c-1.5 3-1 5-1 5s2 .5 5-1M8.5 18.5C7 17 7 15 8.5 11.5 11 6 15.5 4 19.5 4.5c.5 4-1.5 8.5-7 11-3.5 1.5-5.5 1.5-4-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="14.5" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.6"/></svg>,
  evidencias: <svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M13.5 3.5V7.5h4M9 13l2 2 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  relatorios: <svg viewBox="0 0 24 24" fill="none"><path d="M8 3h8l3 3v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M15.5 3.5V6.5h3.5M10 11h7M10 14.5h7M10 18h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M4 7v13.5a1 1 0 0 0 1 1h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  engineconfig: <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h6M14 12h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.7"/><circle cx="10" cy="17" r="2" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.7"/></svg>,
  notificacoes: <svg viewBox="0 0 24 24" fill="none"><path d="M6 9.5a6 6 0 1 1 12 0c0 3.8 1.3 5.3 1.9 5.9H4.1c.6-.6 1.9-2.1 1.9-5.9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M10.2 18.4a2 2 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
};

// Agrupamento do redesign aprovado (mockup Lovable): 5 grupos. Sem seções novas —
// só reorganiza/renomeia as EXISTENTES (recursos novos ficam p/ fases posteriores).
const NAV: { key: Section; label: string; icon: React.ReactNode; current: string; group: string }[] = [
  { key: "overview", label: "Dashboard de Gestão", icon: NI.dashboard, current: "Dashboard de Gestão CRIVO", group: "Operação" },
  { key: "crm", label: "CRM — Funil", icon: NI.funil, current: "CRM — Funil", group: "Operação" },
  { key: "empresas", label: "Grupos e Empresas-cliente", icon: NI.empresas, current: "Grupos e Empresas-cliente", group: "Operação" },
  { key: "contratos", label: "Contratos e Liberações", icon: NI.contratos, current: "Contratos e Liberações", group: "Operação" },
  { key: "produtos", label: "Soluções CRIVO", icon: NI.solucoes, current: "Soluções CRIVO", group: "Catálogo Comercial" },
  { key: "adicionais", label: "Adicionais", icon: NI.adicionais, current: "Adicionais", group: "Catálogo Comercial" },
  { key: "cnae", label: "Motor de Enquadramento", icon: NI.enquadramento, current: "Motor de Enquadramento CRIVO", group: "Motores e Entrega" },
  { key: "metodologia", label: "Motor de Diagnósticos", icon: NI.diagnosticos, current: "Motor de Diagnósticos · Metodologia", group: "Motores e Entrega" },
  { key: "evolucao", label: "Motor de Evolução", icon: NI.evolucao, current: "Motor de Evolução", group: "Motores e Entrega" },
  { key: "evidencias", label: "Evidências", icon: NI.evidencias, current: "Evidências", group: "Motores e Entrega" },
  { key: "relatorios", label: "Relatórios e Dossiês", icon: NI.relatorios, current: "Motor de Relatórios e Dossiês", group: "Motores e Entrega" },
  { key: "ia", label: "IA da Plataforma", icon: NI.ia, current: "IA da Plataforma", group: "Motores e Entrega" },
  { key: "engineconfig", label: "Configuração do Motor", icon: NI.engineconfig, current: "Configuração do Motor", group: "Motores e Entrega" },
  { key: "extras", label: "Recursos da Entrega", icon: NI.entrega, current: "Recursos da Entrega", group: "Motores e Entrega" },
  { key: "inteligencia", label: "Inteligência CRIVO", icon: NI.inteligencia, current: "Inteligência CRIVO", group: "Inteligência" },
  { key: "basecrivo", label: "Base CRIVO", icon: NI.base, current: "Base CRIVO · Benchmarks", group: "Inteligência" },
  { key: "notificacoes", label: "Notificações", icon: NI.notificacoes, current: "Configuração de Notificações", group: "Governança" },
  { key: "integracoes", label: "Integrações", icon: NI.integracoes, current: "Integrações", group: "Governança" },
  { key: "rbac", label: "Papéis e Permissões", icon: NI.rbac, current: "Papéis & Permissões", group: "Governança" },
  { key: "auditoria", label: "Auditoria", icon: NI.auditoria, current: "Auditoria", group: "Governança" },
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
          {section === "adicionais" && <AddonsSection />}
          {section === "cnae" && <CnaeSection />}
          {section === "contratos" && <ContractsSection />}
          {section === "empresas" && <TenantsManager admin={admin} onLogout={onLogout} embedded />}
          {section === "integracoes" && <IntegrationsSection />}
          {section === "metodologia" && <MethodologySection />}
          {section === "evolucao" && <EvolutionSection />}
          {section === "evidencias" && <EvidencesSection />}
          {section === "relatorios" && <ReportsSection />}
          {section === "engineconfig" && <EngineConfigSection onNavigate={(sec) => setSection(sec as Section)} />}
          {section === "inteligencia" && <IntelligenceSection />}
          {section === "basecrivo" && <BaseCrivoSection />}
          {section === "ia" && <AiSettingsSection />}
          {section === "notificacoes" && <NotificationsSection />}
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

      <div className="adm-callout" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span>
          Este é o painel <strong>operacional</strong> (situação e pendências). Para <strong>análise profunda</strong>
          por cliente/CNPJ — cruzando diagnóstico, plano, evidências, ICD, custos e evolução — abra a Inteligência CRIVO.
        </span>
        <button className="btn btn--outline-dark btn--sm" onClick={() => onNavigate("inteligencia")}>
          Abrir Inteligência CRIVO →
        </button>
      </div>

      <DashboardSection onNavigate={onNavigate} />
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "admin.login": "Login do super admin",
  "admin.logout": "Logout do super admin",
  "admin.user.create": "Usuário admin criado",
  "admin.user.update": "Usuário admin atualizado",
  "tenant.provision": "Empresa provisionada",
  "tenant.suspend": "Empresa bloqueada",
  "tenant.activate": "Empresa reativada",
  "tenant.delete": "Empresa excluída",
  "tenant.plan.change": "Plano alterado",
  "tenant.profile.update": "Dados da empresa (CNPJ) atualizados",
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
  "lead.first_contact": "1º contato registrado",
  "lead.origin": "Origem do lead registrada",
  "lead.interest": "Solução de interesse registrada",
  "lead.next_action": "Follow-up do lead definido",
  "lead.commercial": "Dados comerciais do lead atualizados",
  "lead.convert": "Lead convertido em cliente",
  "lead.dedup": "Lead deduplicado",
  "lead.send-access": "Acesso enviado ao lead",
  "contract.create": "Contrato criado",
  "contract.update": "Contrato atualizado",
  "platform.user.create": "Usuário CRIVO criado",
  "platform.user.update": "Usuário CRIVO atualizado",
  "addon.upsert": "Adicional salvo no catálogo",
  "addon.delete": "Adicional removido do catálogo",
  "ai.config.update": "Config de IA atualizada",
  "ai.test": "Conexão de IA testada",
  "ai.prompt.update": "Prompt de IA editado",
  "ai.prompt.reset": "Prompt de IA restaurado ao padrão",
  "integration.save": "Integração salva",
  "integration.enable": "Integração ativada (sandbox)",
  "integration.enable.production": "Integração ativada em PRODUÇÃO",
  "integration.test": "Conexão da integração testada",
  // Metodologia (versionamento)
  "methodology.draft": "Metodologia — rascunho criado",
  "methodology.update": "Metodologia — rascunho editado",
  "methodology.publish": "Metodologia publicada (versão ativa)",
  "methodology.delete-draft": "Metodologia — rascunho descartado",
  // Grupo empresarial / CNPJ
  "group.create": "Grupo empresarial criado",
  "group.update": "Grupo empresarial atualizado",
  "group.delete": "Grupo empresarial excluído",
  "group.access.add": "Acesso a grupo concedido",
  "group.access.remove": "Acesso a grupo removido",
  "group.consolidated.set": "Consolidação de grupo definida",
  "group.overview": "Visão consolidada do grupo",
  "group.portal.view": "Portal do grupo acessado",
  "tenant.group.set": "Empresa vinculada a grupo",
  // Papéis & permissões (RBAC por empresa)
  "tenant.role.create": "Papel customizado criado",
  "tenant.role.update": "Papel customizado atualizado",
  "tenant.role.delete": "Papel customizado excluído",
  "tenant.role.assign": "Papel atribuído a usuário",
  "tenant.role.unassign": "Papel removido de usuário",
  // Base CRIVO / operação sensível
  "benchmarks.view": "Base CRIVO consultada",
  "system.reset-test-data": "Base de teste zerada",
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
          <p className="page-sub">
            Trilha das ações de plataforma com nome legível, ator, alvo e data/hora. Cobre hoje o
            control plane: contratos, módulos, IA, metodologia, grupos/CNPJ, papéis &amp; permissões,
            integrações e Base CRIVO. Ações de negócio do tenant (submissão de ICD, registro de
            decisões/evidências, exportações e uso de IA por chamada) entram como próxima fatia.
          </p>
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
