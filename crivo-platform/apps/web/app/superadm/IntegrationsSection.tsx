"use client";

import { useEffect, useState } from "react";
import {
  listIntegrations,
  saveIntegration,
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

  async function save(provider: IntegrationProvider) {
    const d = draft[provider];
    if (!d) return;
    setSavingP(provider);
    setErr(null);
    setMsg(null);
    try {
      const body: { credential?: string; enabled: boolean; sandbox: boolean } = {
        enabled: d.enabled,
        sandbox: d.sandbox,
      };
      if (d.credential.trim() !== "") body.credential = d.credential.trim();
      const next = await saveIntegration(provider, body);
      setStatus(next);
      set(provider, { credential: "" });
      setMsg(`${META.find((m) => m.provider === provider)?.label} salvo.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSavingP(null);
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

              <button className="btn btn--terra btn--sm" disabled={savingP === m.provider} onClick={() => save(m.provider)}>
                {savingP === m.provider ? "Salvando…" : "Salvar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
