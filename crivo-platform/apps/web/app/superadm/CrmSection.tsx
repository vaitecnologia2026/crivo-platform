"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PLATFORM_LEAD_STAGE_LABEL,
  type PlatformLeadStage,
  type PlatformLeadSummary,
  type ProductSummary,
  type ProvisionResult,
} from "@crivo/types";
import { convertLead, dedupLeads, listLeads, listProducts, resetTestData, sendLeadAccess, setLeadStage } from "@/lib/admin-api";
import { PreliminaryReportModal } from "./PreliminaryReportModal";
import { LeadDataModal } from "./LeadDataModal";

// Ciclo comercial completo (PDF §4.2 CRM Interno): captação → pós-venda.
// PERDIDO sai do board (continua no banco) — movido via o seletor do card.
// PRE_DIAGNOSTICO/REUNIAO (legado) são dobrados na coluna OPORTUNIDADE.
const BOARD: PlatformLeadStage[] = [
  "NOVO", "OPORTUNIDADE", "PROPOSTA", "FECHADO", "CONTRATO", "ONBOARDING",
  "IMPLANTACAO", "ENTREGA", "SUSTENTACAO", "RENOVACAO", "UPSELL",
];
const ALL_STAGES: PlatformLeadStage[] = [...BOARD, "PRE_DIAGNOSTICO", "REUNIAO", "PERDIDO"];

/** Próxima etapa do funil (BOARD em sequência); null se não houver. */
function nextStage(stage: PlatformLeadStage): PlatformLeadStage | null {
  const i = BOARD.indexOf(stage);
  return i >= 0 && i < BOARD.length - 1 ? BOARD[i + 1] : null;
}
// Estágios legados que aparecem dentro de "Oportunidade" no board.
const FOLD_INTO_OPORTUNIDADE: PlatformLeadStage[] = ["PRE_DIAGNOSTICO", "REUNIAO"];

// Legenda curta de cada passo do funil — ajuda o operador a entender o que cada
// coluna significa e quando mover o lead para a próxima.
const STAGE_HELP: Partial<Record<PlatformLeadStage, string>> = {
  NOVO: "Lead recém-chegado, ainda sem contato ou qualificação.",
  OPORTUNIDADE: "Em conversa/qualificação — pré-diagnóstico ou reunião.",
  PROPOSTA: "Proposta comercial enviada, aguardando decisão.",
  FECHADO: "Negócio ganho — pronto para virar contrato e cliente.",
  CONTRATO: "Contrato assinado e formalização concluída.",
  ONBOARDING: "Boas-vindas e coleta dos dados iniciais do cliente.",
  IMPLANTACAO: "Configuração e ativação do sistema/serviço.",
  ENTREGA: "Primeira entrega/diagnóstico concluído ao cliente.",
  SUSTENTACAO: "Acompanhamento contínuo e suporte ativo.",
  RENOVACAO: "Ciclo perto do fim — hora de renovar o contrato.",
  UPSELL: "Oportunidade de ampliar (novos módulos ou serviços).",
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** CRM do Super Admin — funil comercial da CRIVO (leads da LP + manuais). */
export function CrmSection() {
  const [leads, setLeads] = useState<PlatformLeadSummary[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [converting, setConverting] = useState<PlatformLeadSummary | null>(null);
  const [reportingLead, setReportingLead] = useState<PlatformLeadSummary | null>(null);
  const [dataLead, setDataLead] = useState<PlatformLeadSummary | null>(null);

  async function refresh() {
    try { setLeads(await listLeads()); setStatus("ok"); } catch { setStatus("error"); }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await listLeads();
        if (alive) { setLeads(d); setStatus("ok"); }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, []);

  async function move(id: string, stage: PlatformLeadStage) {
    setBusyId(id);
    // Atualização otimista.
    setLeads((prev) => prev?.map((l) => (l.id === id ? { ...l, stage } : l)) ?? prev);
    try {
      await setLeadStage(id, stage);
    } catch {
      // Reverte recarregando.
      try { setLeads(await listLeads()); } catch { /* mantém estado atual */ }
    } finally {
      setBusyId(null);
    }
  }

  const byStage = useMemo(() => {
    const map = new Map<PlatformLeadStage, PlatformLeadSummary[]>();
    for (const s of ALL_STAGES) map.set(s, []);
    for (const l of leads ?? []) {
      // Leads em estágios legados aparecem na coluna Oportunidade.
      const col = FOLD_INTO_OPORTUNIDADE.includes(l.stage) ? "OPORTUNIDADE" : l.stage;
      map.get(col)?.push(l);
    }
    return map;
  }, [leads]);

  const total = leads?.length ?? 0;
  const fechados = byStage.get("FECHADO")?.length ?? 0;
  const reunioes = byStage.get("OPORTUNIDADE")?.length ?? 0;
  const conv = total ? Math.round((fechados / total) * 100) : 0;

  const [resetting, setResetting] = useState(false);
  const [deduping, setDeduping] = useState(false);
  async function onDedup() {
    if (
      !window.confirm(
        "Remover leads duplicados pelo mesmo CNPJ?\n\nMantém os clientes já habilitados e o lead mais avançado de cada empresa; apaga as cópias abertas.",
      )
    )
      return;
    setDeduping(true);
    try {
      const r = await dedupLeads();
      window.alert(`${r.deleted} duplicado(s) removido(s). ${r.kept} lead(s) no funil.`);
      await refresh();
    } catch (e) {
      window.alert("Falha ao limpar: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setDeduping(false);
    }
  }
  async function onResetData() {
    const typed = window.prompt(
      "Isto APAGA todos os clientes, leads e diagnósticos (mantém login, soluções e RBAC). " +
        "É irreversível.\n\nDigite ZERAR para confirmar:",
    );
    if (typed !== "ZERAR") return;
    setResetting(true);
    try {
      const r = await resetTestData("ZERAR");
      const totalDel = Object.values(r.deleted).reduce((a, b) => a + b, 0);
      window.alert(`Base zerada — ${totalDel} registros removidos. Recarregando…`);
      window.location.reload();
    } catch (e) {
      window.alert("Falha ao zerar: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">CRM — Funil comercial</h1>
          <p className="page-sub">
            Gestão da jornada comercial CRIVO — da captação do lead ao contrato e onboarding.
          </p>
        </div>
        <div className="route__actions">
          <button className="btn btn--ghost btn--sm" onClick={onDedup} disabled={deduping}>
            {deduping ? "Limpando…" : "Limpar duplicados"}
          </button>
          <button className="btn btn--ghost btn--sm is-danger" onClick={onResetData} disabled={resetting}>
            {resetting ? "Zerando…" : "⚠ Zerar base de teste"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando funil…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar os leads.</div>
      )}

      {status === "ok" && leads && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <span className="kpi__label">Leads no funil</span>
              <strong className="kpi__value">{total}</strong>
              <span className="kpi__delta">todas as origens</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Reuniões agendadas</span>
              <strong className="kpi__value">{reunioes}</strong>
              <span className="kpi__delta">em negociação</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Taxa de conversão</span>
              <strong className="kpi__value">{conv}%</strong>
              <span className="kpi__delta">fechados / total</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Pré-diagnósticos</span>
              <strong className="kpi__value">{leads.filter((l) => l.diagnosticScore != null).length}</strong>
              <span className="kpi__delta">leads qualificados</span>
            </div>
          </div>

          <div className="kanban">
            {BOARD.map((stage) => {
              const items = byStage.get(stage) ?? [];
              return (
                <div className="kb-col" key={stage}>
                  <div className="kb-col__head">
                    {PLATFORM_LEAD_STAGE_LABEL[stage]}
                    <em>{items.length}</em>
                  </div>
                  {STAGE_HELP[stage] && <p className="kb-col__help">{STAGE_HELP[stage]}</p>}
                  {items.map((l) => (
                    <article
                      key={l.id}
                      className={`kb-card${stage === "FECHADO" ? " kb-card--won" : l.diagnosticScore != null ? " kb-card--hot" : ""}`}
                      style={{ opacity: busyId === l.id ? 0.5 : 1 }}
                    >
                      <strong>{l.company || l.name}</strong>
                      <span className="kb-meta">
                        {l.company ? `${l.name} · ` : ""}
                        {l.segment ?? "—"}
                        {l.employeesCount ? ` · ${l.employeesCount} colab.` : ""}
                      </span>
                      <div className="kb-foot">
                        <span className="kb-score">
                          {l.diagnosticScore != null ? `Pré ${l.diagnosticScore}` : "Sem pré-diag."}
                        </span>
                        {l.riskGrade && (
                          <span
                            className={`kb-risk kb-risk--${l.riskGrade.toLowerCase()}`}
                            title="Grau de risco preliminar (base: CNPJ)"
                          >
                            Risco {l.riskGrade}
                          </span>
                        )}
                        {l.phone && <span className="kb-wpp">{l.phone}</span>}
                      </div>
                      <select
                        value={l.stage}
                        disabled={busyId === l.id || !!l.convertedTenantId}
                        onChange={(e) => move(l.id, e.target.value as PlatformLeadStage)}
                        className="kb-stage-select"
                        aria-label="Mover lead no funil"
                      >
                        {ALL_STAGES.map((s) => (
                          <option key={s} value={s}>{PLATFORM_LEAD_STAGE_LABEL[s]}</option>
                        ))}
                      </select>
                      {l.convertedTenantId ? (
                        <span className="kb-converted">✓ Cliente Habilitado · sistema liberado</span>
                      ) : l.stage === "ONBOARDING" ? (
                        <button type="button" className="kb-convert" onClick={() => setConverting(l)}>
                          Habilitar cliente (sistema) →
                        </button>
                      ) : nextStage(l.stage) ? (
                        <button
                          type="button"
                          className="kb-convert"
                          disabled={busyId === l.id}
                          onClick={() => {
                            const n = nextStage(l.stage);
                            if (n) move(l.id, n);
                          }}
                        >
                          Avançar → {PLATFORM_LEAD_STAGE_LABEL[nextStage(l.stage)!]}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="kb-report"
                        onClick={() => setDataLead(l)}
                        title="Ver todos os dados capturados pelo CNPJ + recomendação CNAE"
                      >
                        ⊙ Ver dados da empresa
                      </button>
                      {l.diagnosticScore != null && (
                        <button
                          type="button"
                          className="kb-report"
                          onClick={() => setReportingLead(l)}
                          title="Gerar Relatório Preliminar CRIVO via IA"
                        >
                          ◈ Relatório CRIVO
                        </button>
                      )}
                    </article>
                  ))}
                  {items.length === 0 && <p className="kb-empty">—</p>}
                </div>
              );
            })}
          </div>

          {(byStage.get("PERDIDO")?.length ?? 0) > 0 && (
            <p className="dash-state" style={{ marginTop: 16 }}>
              {byStage.get("PERDIDO")!.length} lead(s) marcados como perdidos (fora do funil).
            </p>
          )}
        </>
      )}

      {converting && (
        <ConvertModal
          lead={converting}
          onClose={() => setConverting(null)}
          onConverted={async () => { setConverting(null); await refresh(); }}
        />
      )}

      {reportingLead && (
        <PreliminaryReportModal
          lead={reportingLead}
          onClose={() => setReportingLead(null)}
        />
      )}

      {dataLead && <LeadDataModal lead={dataLead} onClose={() => setDataLead(null)} />}
    </>
  );
}

/** Modal de conversão Lead → Cliente: escolhe o produto e provisiona a empresa. */
function ConvertModal({
  lead,
  onClose,
  onConverted,
}: {
  lead: PlatformLeadSummary;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [productId, setProductId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ProvisionResult | null>(null);
  const [access, setAccess] = useState<{ sending: boolean; sent?: boolean; reason?: string }>({ sending: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await listProducts();
        if (alive) setProducts(all.filter((p) => !p.isLeadCapture && p.status === "ACTIVE"));
      } catch {
        if (alive) setProducts([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function confirm() {
    if (!productId) return;
    setSaving(true);
    setError(null);
    try {
      setDone(await convertLead(lead.id, productId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na conversão");
    } finally {
      setSaving(false);
    }
  }

  // #12 — envia o acesso por e-mail (gera nova senha; atualiza a exibida p/ bater).
  async function sendAccessEmail() {
    setAccess({ sending: true });
    try {
      const r = await sendLeadAccess(lead.id);
      setDone((d) => (d ? { ...d, tempPassword: r.tempPassword } : d));
      setAccess({ sending: false, sent: r.sent, reason: r.reason });
    } catch (e) {
      setAccess({ sending: false, sent: false, reason: e instanceof Error ? e.message : "erro" });
    }
  }

  return (
    <div className="modal-backdrop" onClick={done ? onConverted : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{done ? "Cliente Habilitado ✓ · sistema liberado" : "Converter em cliente"}</h2>
          <button className="icon-btn" onClick={done ? onConverted : onClose} title="Fechar">✕</button>
        </header>

        <div className="modal__body">
          {done ? (
            <div className="convert-done">
              <p>
                Empresa <strong>{done.tenant.name}</strong> criada a partir do produto contratado.
              </p>
              <dl className="convert-creds">
                <div><dt>Subdomínio</dt><dd>{done.tenant.slug}</dd></div>
                <div><dt>Admin</dt><dd>{done.adminEmail}</dd></div>
                {done.tempPassword && (
                  <div>
                    <dt>Senha temporária</dt>
                    <dd><code>{done.tempPassword}</code></dd>
                  </div>
                )}
              </dl>
              {done.tempPassword && (
                <p className="convert-warn">Copie a senha agora — não será exibida novamente.</p>
              )}
              <div style={{ marginTop: 12 }}>
                <button className="btn btn--terra btn--sm" onClick={sendAccessEmail} disabled={access.sending}>
                  {access.sending ? "Enviando…" : "Enviar acesso por e-mail"}
                </button>
                {access.sent === true && (
                  <p className="convert-warn" style={{ color: "#1d9e75" }}>
                    Acesso enviado para {done.adminEmail} — a senha acima foi atualizada para a que foi enviada.
                  </p>
                )}
                {access.sent === false && access.reason === "email-not-configured" && (
                  <p className="convert-warn">
                    E-mail ainda não configurado — acesso preparado. Copie a senha acima e envie manualmente.
                  </p>
                )}
                {access.sent === false && access.reason && access.reason !== "email-not-configured" && (
                  <p className="convert-warn">Não foi possível enviar agora. Copie a senha acima.</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="convert-lead">
                Lead: <strong>{lead.name}</strong>{lead.company ? ` · ${lead.company}` : ""} · {lead.email ?? "sem e-mail"}
              </p>
              {!lead.email && (
                <p className="convert-warn">Este lead não tem e-mail — necessário para criar o acesso do admin.</p>
              )}
              <label className="prod-field prod-field--full" style={{ marginTop: 10 }}>
                <span>Solução contratada</span>
                <select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!products}>
                  <option value="">{products ? "Selecione…" : "Carregando…"}</option>
                  {(products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.modules.length} módulos
                    </option>
                  ))}
                </select>
              </label>
              <p className="prod-note">
                O sistema cria automaticamente: empresa, admin, módulos liberados, perguntas e IA do produto.
              </p>
              {error && <p className="convert-warn">{error}</p>}
            </>
          )}
        </div>

        <div className="modal__foot">
          {done ? (
            <button className="btn btn--terra btn--sm" onClick={onConverted}>Concluir</button>
          ) : (
            <>
              <button className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
              <button
                className="btn btn--terra btn--sm"
                disabled={saving || !productId || !lead.email}
                onClick={confirm}
              >
                {saving ? "Provisionando…" : "Converter e provisionar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
