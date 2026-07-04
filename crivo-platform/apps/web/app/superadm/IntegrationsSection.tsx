"use client";

import { useEffect, useState } from "react";
import {
  listIntegrations,
  saveIntegration,
  testIntegration,
  type IntegrationProvider,
  type IntegrationStatus,
} from "../../lib/admin-api";
import "./cnae.css";

const META: {
  provider: IntegrationProvider;
  label: string;
  role: string;
  credLabel: string;
  help: string;
  sandbox: boolean;
}[] = [
  {
    provider: "clicksign",
    label: "Clicksign",
    role: "Assinatura eletrônica do contrato",
    credLabel: "Access Token",
    help: "Painel Clicksign → Configurações → API → Access Token (use o token de Produção).",
    sandbox: false,
  },
  {
    provider: "asaas",
    label: "Asaas",
    role: "Cobrança — boleto, Pix e cartão",
    credLabel: "API Key",
    help: "Painel Asaas → Configurações → Integrações → Chave de API.",
    sandbox: true,
  },
  {
    provider: "mercadopago",
    label: "Mercado Pago",
    role: "Cobrança — checkout (Pix / cartão)",
    credLabel: "Access Token",
    help: "Mercado Pago → Suas integrações → Credenciais de produção → Access Token.",
    sandbox: true,
  },
];

type Draft = { credential: string; enabled: boolean; sandbox: boolean };

export function IntegrationsSection() {
  const [status, setStatus] = useState<IntegrationStatus[]>([]);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [savingP, setSavingP] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [testingP, setTestingP] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<Record<string, { ok: boolean; message: string }>>({});
  // Confirmação de ativação em produção (Tela 07 · critério de aceite).
  const [confirmProd, setConfirmProd] = useState<IntegrationProvider | null>(null);
  const [purpose, setPurpose] = useState("");

  async function refresh() {
    const s = await listIntegrations().catch(() => [] as IntegrationStatus[]);
    setStatus(s);
    const d: Record<string, Draft> = {};
    for (const m of META) {
      const cur = s.find((x) => x.provider === m.provider);
      d[m.provider] = { credential: "", enabled: cur?.enabled ?? false, sandbox: cur?.sandbox ?? false };
    }
    setDraft(d);
  }

  useEffect(() => {
    refresh();
  }, []);

  function set(provider: string, patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, [provider]: { ...d[provider], ...patch } }));
  }

  /** Salva de fato (com finalidade/confirmação quando é produção). */
  async function doSave(provider: IntegrationProvider, extra?: { purpose?: string; confirmProduction?: boolean }) {
    const d = draft[provider];
    if (!d) return;
    setSavingP(provider);
    setErr(null);
    setMsg(null);
    try {
      const body: { credential?: string; enabled: boolean; sandbox: boolean; purpose?: string; confirmProduction?: boolean } = {
        enabled: d.enabled,
        sandbox: d.sandbox,
        ...extra,
      };
      if (d.credential.trim() !== "") body.credential = d.credential.trim();
      const next = await saveIntegration(provider, body);
      setStatus(next);
      set(provider, { credential: "" });
      setConfirmProd(null);
      setPurpose("");
      setMsg(`${META.find((m) => m.provider === provider)?.label} salvo.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSavingP(null);
    }
  }

  /** Ativar em PRODUÇÃO (ativa + não-sandbox) exige confirmação + finalidade. */
  function save(provider: IntegrationProvider) {
    const d = draft[provider];
    if (!d) return;
    if (d.enabled && !d.sandbox) {
      setConfirmProd(provider);
      setPurpose("");
      return;
    }
    void doSave(provider);
  }

  async function test(provider: IntegrationProvider) {
    setTestingP(provider);
    try {
      const r = await testIntegration(provider);
      setTestMsg((t) => ({ ...t, [provider]: r }));
    } catch (e) {
      setTestMsg((t) => ({ ...t, [provider]: { ok: false, message: e instanceof Error ? e.message : "Erro." } }));
    } finally {
      setTestingP(null);
    }
  }

  return (
    <div>
      <p className="cnae-muted" style={{ marginTop: 0 }}>
        Cole as chaves de API de cada serviço. Elas ficam <strong>cifradas</strong> no servidor — só o final é
        exibido como referência. Depois é só ativar e usar no Onboarding da empresa.
      </p>
      {err && <div className="cnae-note cnae-block--warn">{err}</div>}
      {msg && <div className="cnae-note cnae-note--ok">{msg}</div>}

      <div className="int-grid">
        {META.map((m) => {
          const st = status.find((x) => x.provider === m.provider);
          const d = draft[m.provider] ?? { credential: "", enabled: false, sandbox: false };
          const state = st?.enabled && st?.hasCredential ? "Ativa" : st?.hasCredential ? "Configurada" : "Pendente";
          return (
            <div key={m.provider} className="cnae-card int-card">
              <div className="int-card__head">
                <div>
                  <h3>{m.label}</h3>
                  <span className="cnae-muted">{m.role}</span>
                </div>
                <span className={`cnae-badge cnae-badge--${state === "Ativa" ? "baixo" : state === "Configurada" ? "medio" : "alto"}`}>
                  {state}
                </span>
              </div>

              <label className="prod-field prod-field--full">
                <span>
                  {m.credLabel}
                  {st?.hint ? ` · atual: ${st.hint}` : ""}
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={d.credential}
                  placeholder={st?.hasCredential ? "Deixe vazio para manter a chave atual" : "Cole a chave aqui"}
                  onChange={(e) => set(m.provider, { credential: e.target.value })}
                />
              </label>
              <p className="int-help cnae-muted">{m.help}</p>

              <label className="prod-check">
                <input type="checkbox" checked={d.enabled} onChange={(e) => set(m.provider, { enabled: e.target.checked })} />
                <span>Ativada</span>
              </label>
              {m.sandbox && (
                <label className="prod-check">
                  <input
                    type="checkbox"
                    checked={d.sandbox}
                    onChange={(e) => set(m.provider, { sandbox: e.target.checked })}
                  />
                  <span>Ambiente de testes (sandbox)</span>
                </label>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn btn--terra btn--sm" disabled={savingP === m.provider} onClick={() => save(m.provider)}>
                  {savingP === m.provider ? "Salvando…" : d.enabled && !d.sandbox ? "Ativar em produção…" : "Salvar"}
                </button>
                <button
                  className="btn btn--outline-dark btn--sm"
                  disabled={testingP === m.provider || !st?.hasCredential}
                  title={st?.hasCredential ? "Testa a chave contra o provedor" : "Salve uma chave primeiro"}
                  onClick={() => test(m.provider)}
                >
                  {testingP === m.provider ? "Testando…" : "Testar conexão"}
                </button>
              </div>
              {testMsg[m.provider] && (
                <p
                  className="cnae-note"
                  style={{ marginTop: 8, color: testMsg[m.provider].ok ? "#2E7D4F" : "#C0392B" }}
                >
                  {testMsg[m.provider].ok ? "✓ " : "✕ "}
                  {testMsg[m.provider].message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {confirmProd && (
        <div className="modal-backdrop" onClick={() => setConfirmProd(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal__head">
              <h2>Ativar em produção — {META.find((m) => m.provider === confirmProd)?.label}</h2>
              <button className="icon-btn" onClick={() => setConfirmProd(null)} title="Fechar">✕</button>
            </header>
            <div className="modal__body" style={{ display: "grid", gap: 12 }}>
              <p className="cnae-muted" style={{ margin: 0 }}>
                Você está ativando esta integração em <strong>PRODUÇÃO</strong> (cobrança/assinatura reais).
                Informe a finalidade — fica registrada na auditoria (usuário, data, finalidade e status).
              </p>
              <label className="prod-field prod-field--full">
                <span>Finalidade da ativação</span>
                <input
                  value={purpose}
                  autoFocus
                  maxLength={240}
                  placeholder="Ex.: cobrança dos contratos ativos"
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </label>
            </div>
            <div className="modal__foot">
              <button className="btn btn--outline-dark btn--sm" onClick={() => setConfirmProd(null)}>Cancelar</button>
              <button
                className="btn btn--terra btn--sm"
                disabled={savingP === confirmProd || !purpose.trim()}
                onClick={() => doSave(confirmProd, { purpose: purpose.trim(), confirmProduction: true })}
              >
                {savingP === confirmProd ? "Ativando…" : "Confirmar ativação em produção"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
