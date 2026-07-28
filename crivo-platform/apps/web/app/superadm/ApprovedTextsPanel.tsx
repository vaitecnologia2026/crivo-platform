"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateApprovedTextDraft,
  listApprovedTexts,
  listTenants,
  revokeApprovedText,
  saveApprovedText,
  type ApprovedTextRow,
} from "@/lib/admin-api";
import type { TenantSummary } from "@crivo/types";

const STATUS_LABEL: Record<ApprovedTextRow["status"], string> = {
  APROVADO: "Aprovado",
  RASCUNHO: "Rascunho",
  PENDENTE: "Pendente",
};
const STATUS_CLASS: Record<ApprovedTextRow["status"], string> = {
  APROVADO: "addx-status--ATIVO",
  RASCUNHO: "addx-status--EM_REVISAO",
  PENDENTE: "addx-status--SUSPENSO",
};

const MAX_LEN = 8000;

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function keyOf(r: Pick<ApprovedTextRow, "docType" | "field">): string {
  return `${r.docType}:${r.field}`;
}

/**
 * F3 — Textos aprovados dos documentos (decisão 1-A do cliente): a IA da
 * Plataforma gera o RASCUNHO com os dados reais da empresa, a equipe CRIVO
 * edita e APROVA aqui, e só o texto aprovado entra nos documentos. Os campos
 * obrigatórios (dicionário do pacote) bloqueiam a emissão oficial enquanto
 * não aprovados.
 */
export function ApprovedTextsPanel() {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [rows, setRows] = useState<ApprovedTextRow[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});
  // Guard de resposta obsoleta: trocar de empresa com um load em voo NÃO pode
  // pintar (nem deixar aprovar) o texto da empresa anterior.
  const loadSeq = useRef(0);

  useEffect(() => {
    listTenants()
      .then(setTenants)
      .catch(() => setTenants([]));
  }, []);

  /** Carga completa (troca de empresa): reinicializa textareas do servidor. */
  async function load(orgId: string) {
    const seq = ++loadSeq.current;
    if (!orgId) {
      setRows(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    setNotice({});
    try {
      const list = await listApprovedTexts(orgId);
      if (seq !== loadSeq.current) return; // resposta velha — descarta
      setRows(list);
      const initial: Record<string, string> = {};
      for (const r of list) initial[keyOf(r)] = r.draft ?? r.approvedContent ?? "";
      setTexts(initial);
      setStatus("ok");
    } catch {
      if (seq !== loadSeq.current) return;
      setStatus("error");
    }
  }

  /**
   * Pós-ação: atualiza status/metadados de todos os campos, mas só o textarea
   * do campo AGIDO é resetado do servidor — edições não salvas dos demais
   * campos permanecem intactas.
   */
  async function refresh(orgId: string, actedKey: string) {
    const seq = ++loadSeq.current;
    const list = await listApprovedTexts(orgId);
    if (seq !== loadSeq.current) return;
    setRows(list);
    const acted = list.find((r) => keyOf(r) === actedKey);
    if (acted) {
      setTexts((prev) => ({ ...prev, [actedKey]: acted.draft ?? acted.approvedContent ?? "" }));
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, ApprovedTextRow[]>();
    for (const r of rows ?? []) {
      const list = map.get(r.docLabel) ?? [];
      list.push(r);
      map.set(r.docLabel, list);
    }
    return [...map.entries()];
  }, [rows]);

  async function run(key: string, fn: () => Promise<void>, doneMsg: string) {
    const orgId = tenantId;
    setBusyKey(key);
    setNotice((n) => ({ ...n, [key]: "" }));
    try {
      await fn();
      await refresh(orgId, key);
      setNotice((n) => ({ ...n, [key]: doneMsg }));
    } catch (err) {
      setNotice((n) => ({ ...n, [key]: err instanceof Error ? err.message : "Falha na operação." }));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <div className="adm-callout" style={{ marginBottom: 16 }}>
        Fluxo oficial (decisão do cliente): a IA da Plataforma gera o rascunho com os dados reais da
        empresa, a equipe CRIVO edita e aprova, e só o texto aprovado entra nos documentos. Os campos
        marcados como obrigatórios bloqueiam a emissão oficial enquanto não houver texto aprovado.
      </div>

      <div className="prod-field" style={{ maxWidth: 420, marginBottom: 18 }}>
        <label htmlFor="atx-tenant">Empresa</label>
        <select
          id="atx-tenant"
          className="mod-select"
          value={tenantId}
          disabled={busyKey !== null}
          onChange={(e) => {
            setTenantId(e.target.value);
            void load(e.target.value);
          }}
        >
          <option value="">Selecione a empresa…</option>
          {(tenants ?? []).map((t) => (
            <option key={t.id} value={t.organizationId}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {status === "loading" && <p className="dash-state">Carregando textos…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar os textos desta empresa.{" "}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void load(tenantId)}>
            Tentar de novo
          </button>
        </div>
      )}
      {status === "idle" && (
        <p className="dash-state">Selecione uma empresa para ver a fila de textos dos documentos dela.</p>
      )}

      {status === "ok" &&
        groups.map(([docLabel, fields]) => (
          <div className="crm-panel" style={{ marginBottom: 20 }} key={docLabel}>
            <span className="crm-panel__title">{docLabel}</span>
            {fields.map((r) => {
              const key = keyOf(r);
              const busy = busyKey === key;
              const text = texts[key] ?? "";
              const newerDraft =
                r.status === "APROVADO" && r.draft != null && r.draft !== r.approvedContent;
              return (
                <div className="card" style={{ marginBottom: 14 }} key={key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong>{r.label}</strong>
                    {r.required && <span className="sol-chip">obrigatório na emissão</span>}
                    <span className={`addx-status ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {newerDraft && <span className="sol-chip">rascunho mais novo que o aprovado</span>}
                  </div>
                  <p className="prod-note" style={{ margin: "6px 0 8px" }}>
                    {r.status === "APROVADO"
                      ? `Aprovado por ${r.approvedBy ?? "—"} em ${fmtDate(r.approvedAt)}.${newerDraft ? " O documento emitido continua usando o texto aprovado abaixo até uma nova aprovação." : ""}`
                      : r.draftAt
                        ? `Rascunho ${r.draftModel ? `da IA (${r.draftModel})` : "manual"} de ${fmtDate(r.draftAt)} — ainda não aprovado.`
                        : "Sem texto ainda — gere um rascunho com a IA ou escreva manualmente."}
                  </p>
                  {newerDraft && (
                    <details style={{ marginBottom: 8 }}>
                      <summary className="prod-note" style={{ cursor: "pointer" }}>
                        Ver o texto aprovado em vigor (o que sai no documento)
                      </summary>
                      <p className="prod-note" style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                        {r.approvedContent}
                      </p>
                    </details>
                  )}
                  <textarea
                    className="mod-select"
                    style={{ width: "100%", minHeight: 110, resize: "vertical", padding: 10 }}
                    value={text}
                    maxLength={MAX_LEN}
                    disabled={busy}
                    onChange={(e) => setTexts((t) => ({ ...t, [key]: e.target.value }))}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => {
                        if (
                          text.trim() &&
                          text !== (r.draft ?? r.approvedContent ?? "") &&
                          !window.confirm("O campo tem texto não salvo — gerar um novo rascunho com a IA vai substituí-lo. Continuar?")
                        )
                          return;
                        void run(key, async () => {
                          await generateApprovedTextDraft(tenantId, r.docType, r.field);
                        }, "Rascunho gerado pela IA — revise e aprove.");
                      }}
                    >
                      Gerar rascunho com IA
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busy || !text.trim()}
                      onClick={() =>
                        void run(key, async () => {
                          await saveApprovedText(tenantId, r.docType, r.field, { content: text });
                        }, "Rascunho salvo.")
                      }
                    >
                      Salvar rascunho
                    </button>
                    <button
                      type="button"
                      className="btn btn--terra btn--sm"
                      disabled={busy || !text.trim()}
                      onClick={() => {
                        const msg =
                          r.status === "APROVADO"
                            ? "Aprovar este texto? Ele SUBSTITUI o texto aprovado em vigor no documento (a aprovação fica auditada)."
                            : "Aprovar este texto? Ele passa a entrar no documento emitido (a aprovação fica auditada).";
                        if (!window.confirm(msg)) return;
                        void run(key, async () => {
                          await saveApprovedText(tenantId, r.docType, r.field, { content: text, approve: true });
                        }, "Texto aprovado — já entra no documento.");
                      }}
                    >
                      Aprovar texto
                    </button>
                    {r.status === "APROVADO" && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm("Remover a aprovação? O documento volta a sair sem este texto até nova aprovação.")) return;
                          void run(key, async () => {
                            await revokeApprovedText(tenantId, r.docType, r.field);
                          }, "Aprovação removida.");
                        }}
                      >
                        Remover aprovação
                      </button>
                    )}
                    {busy && <span className="prod-note">Processando…</span>}
                  </div>
                  {notice[key] && (
                    <p className="evd-reason" style={{ marginTop: 8 }}>
                      {notice[key]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </>
  );
}
