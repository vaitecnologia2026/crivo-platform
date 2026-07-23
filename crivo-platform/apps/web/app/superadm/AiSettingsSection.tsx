"use client";

import { useEffect, useState } from "react";
import {
  AI_MODELS,
  AI_STATUS_LABEL,
  MODULES,
  type AiSettingsData,
} from "@crivo/types";
import {
  getAiSettings,
  testAiConnection,
  updateAiSettings,
  getAiPrompts,
  updateAiPrompt,
  resetAiPrompt,
  getAiUsage,
  getAiLogs,
  getAiContexts,
  type AiPromptItem,
  type AiUsageSummary,
  type AiLogRow,
  type AiContextRow,
} from "@/lib/admin-api";

/** Casos de uso REAIS do motor de IA e o módulo que os libera (gate). */
const USE_CASES: { useCase: string; where: string; gateModules: string[] }[] = [
  { useCase: "copiloto", where: "Portal do Cliente · Área do Líder (Copiloto)", gateModules: ["copiloto", "lider"] },
  { useCase: "preliminary_report", where: "LP / CRM · Relatório Preliminar do lead (e-mail)", gateModules: ["relatorios"] },
  { useCase: "pocket_summary", where: "Portal do Cliente · síntese da Mentoria IA Pocket", gateModules: ["pocket"] },
  { useCase: "people_analytics", where: "Portal do Cliente · People Analytics (análise de RH)", gateModules: ["analytics"] },
];

type Tab = "provedores" | "casos" | "prompts" | "contextos" | "consumo" | "logs";
const TABS: { key: Tab; label: string }[] = [
  { key: "provedores", label: "Provedores e Modelos" },
  { key: "casos", label: "Casos de Uso" },
  { key: "prompts", label: "Prompts e Políticas" },
  { key: "contextos", label: "Contextos por Cliente" },
  { key: "consumo", label: "Consumo e Limites" },
  { key: "logs", label: "Versões e Logs" },
];

/**
 * IA da Plataforma (grupo Motores, mockup do cliente) — governança central da IA
 * em 6 abas: conexão/modelo, casos de uso (gates por módulo), Central de Prompts,
 * contextos por cliente (diretrizes do contrato), consumo real (ai_call_logs) e
 * logs por chamada. Toda chamada de IA passa pelo motor central e é medida.
 */
export function AiSettingsSection() {
  const [tab, setTab] = useState<Tab>("provedores");
  const [data, setData] = useState<AiSettingsData | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [apiKey, setApiKey] = useState(""); // token novo (vazio = manter)
  const [model, setModel] = useState("gpt-4o-mini");
  const [enabled, setEnabled] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  async function load() {
    try {
      const d = await getAiSettings();
      setData(d);
      setModel(d.model);
      setEnabled(d.enabled);
      setMods(d.enabledModules);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  function toggleMod(code: string) {
    setMods((m) => (m.includes(code) ? m.filter((c) => c !== code) : [...m, code]));
  }

  async function save() {
    setSaving(true);
    setSavedMsg(false);
    try {
      const d = await updateAiSettings({
        model,
        enabled,
        enabledModules: mods,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setData(d);
      setApiKey("");
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await testAiConnection(apiKey.trim() || undefined);
      setTestMsg(r.ok ? "✓ Conexão OK com a OpenAI." : `✕ ${AI_STATUS_LABEL[r.status] ?? r.status}${r.message ? ` — ${r.message}` : ""}`);
      await load();
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : "Falha no teste");
    } finally {
      setTesting(false);
    }
  }

  async function removeKey() {
    if (!confirm("Remover o token de IA configurado?")) return;
    setSaving(true);
    try { setData(await updateAiSettings({ apiKey: "" })); setApiKey(""); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha"); } finally { setSaving(false); }
  }

  const saveRow = (
    <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
      <button className="btn btn--terra btn--sm" disabled={saving} onClick={save}>
        {saving ? "Salvando…" : "Salvar configurações"}
      </button>
      {savedMsg && <span className="kb-converted">✓ Salvo</span>}
    </div>
  );

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">IA da Plataforma</h1>
          <p className="page-sub">
            Motor de IA da CRIVO: conexão e modelo, casos de uso liberados, prompts técnicos
            versionados, contextos por cliente e o consumo real — cada chamada de IA passa pelo
            motor central e fica registrada (tokens, latência e erros).
          </p>
        </div>
      </div>

      <div className="cnae-note cnae-block--warn" style={{ marginBottom: 14 }}>
        <strong>Governança (§11).</strong> A IA <strong>apoia — não decide</strong>: gera rascunhos e sinaliza, mas
        <strong> não valida a entrega final sensível</strong> (parecer, laudo, diagnóstico). A palavra final é sempre
        do especialista humano. Ela também <strong>não valida plano, evidência, dossiê ou economia automaticamente</strong>.
      </div>

      <div className="adm-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`adm-tab${tab === t.key ? " is-active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {status === "loading" && <p className="dash-state">Carregando…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar.</div>}

      {status === "ok" && data && tab === "provedores" && (
        <div className="card" style={{ maxWidth: 720 }}>
          <fieldset className="prod-fs">
            <legend>Conexão</legend>
            <p className="prod-note" style={{ marginTop: 0 }}>
              Provedor atual: <strong>OpenAI</strong> (único suportado nesta versão). O token fica
              criptografado em repouso e nunca é exibido.
            </p>
            <div className="prod-form__grid">
              <label className="prod-field prod-field--full">
                <span>Token da OpenAI {data.hasKey && <em style={{ color: "var(--success)", fontStyle: "normal" }}>· configurado (••••{data.keyHint})</em>}</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={data.hasKey ? "Deixe vazio para manter o token atual" : "sk-…"}
                  autoComplete="off"
                />
              </label>
              <label className="prod-field">
                <span>Modelo</span>
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  {AI_MODELS.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </label>
              <label className="prod-field">
                <span>Status da integração</span>
                <input
                  readOnly
                  value={`${AI_STATUS_LABEL[data.lastStatus ?? "untested"] ?? data.lastStatus ?? "—"}${data.lastTestedAt ? ` · ${new Date(data.lastTestedAt).toLocaleString("pt-BR")}` : ""}`}
                  style={{ background: "var(--line-soft)" }}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn--outline-dark btn--sm" disabled={testing} onClick={test}>
                {testing ? "Testando…" : "Testar conexão"}
              </button>
              {data.hasKey && (
                <button className="btn btn--ghost btn--sm" disabled={saving} onClick={removeKey} style={{ color: "var(--danger, #b4453a)" }}>
                  Remover token
                </button>
              )}
              {testMsg && <span className="prod-note" style={{ margin: 0 }}>{testMsg}</span>}
            </div>
          </fieldset>
          {saveRow}
        </div>
      )}

      {status === "ok" && data && tab === "casos" && (
        <>
          <div className="card" style={{ maxWidth: 720 }}>
            <fieldset className="prod-fs">
              <legend>Ativação</legend>
              <label className="prod-check" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                IA ativada no sistema
              </label>
              <span className="prod-note" style={{ margin: "0 0 8px" }}>Módulos que podem usar IA (vazio = todos liberados):</span>
              <div className="prod-modules">
                {MODULES.map((m) => (
                  <label key={m.code} className="prod-check">
                    <input type="checkbox" checked={mods.includes(m.code)} onChange={() => toggleMod(m.code)} disabled={!enabled} />
                    {m.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {saveRow}
          </div>

          <div className="addx-wrap" style={{ marginTop: 18 }}>
            <table className="addx-table">
              <thead>
                <tr>
                  <th>Caso de uso</th>
                  <th>Onde roda</th>
                  <th>Módulo que libera</th>
                  <th>Situação agora</th>
                </tr>
              </thead>
              <tbody>
                {USE_CASES.map((u) => {
                  // Mesmo gate do backend: sem token configurado, nenhum caso roda
                  // (copiloto/pocket/relatórios checam `!enabled || !hasKey`).
                  const blockedBy = !enabled
                    ? "IA desativada no sistema"
                    : !data.hasKey
                      ? "Sem token configurado"
                      : mods.length > 0 && !u.gateModules.some((g) => mods.includes(g))
                        ? "Módulo não liberado acima"
                        : null;
                  return (
                    <tr key={u.useCase}>
                      <td className="cell-code"><code>{u.useCase}</code></td>
                      <td>{u.where}</td>
                      <td>{u.gateModules.join(" ou ")}</td>
                      <td>
                        <span className={`addx-status ${blockedBy ? "addx-status--AGUARDANDO_DADOS" : "addx-status--ATIVO"}`}>
                          {blockedBy ? "Bloqueado" : "Liberado"}
                        </span>
                        {blockedBy && <p className="evd-reason">{blockedBy}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {status === "ok" && tab === "prompts" && (
        <>
          <div className="adm-callout">
            <strong>Prompt técnico é fixo e interno.</strong> O cliente nunca edita o prompt técnico. As
            <strong> diretrizes aprovadas do cliente</strong> (objetivo, regras, base de conhecimento e limitações
            em <em>Soluções → IA personalizada</em>) são <strong>injetadas como contexto</strong> quando o produto
            contratado permite — veja a aba <em>Contextos por Cliente</em>.
          </div>
          <AiPromptsManager />
        </>
      )}

      {status === "ok" && tab === "contextos" && <AiContextsPanel />}
      {status === "ok" && tab === "consumo" && <AiUsagePanel />}
      {status === "ok" && tab === "logs" && <AiLogsPanel />}
    </>
  );
}

/** Contextos por Cliente — o bloco de diretrizes EXATO aplicado ao Copiloto de cada empresa. */
function AiContextsPanel() {
  const [rows, setRows] = useState<AiContextRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAiContexts().then(setRows).catch(() => setError(true));
  }, []);

  if (error) return <div className="dash-state dash-state--error">Não foi possível carregar os contextos.</div>;
  if (!rows) return <p className="dash-state">Carregando contextos…</p>;

  return (
    <>
      <div className="adm-callout">
        As diretrizes são definidas por <strong>solução</strong> (Soluções CRIVO → IA personalizada) e
        valem para a empresa via <strong>contrato</strong>. O texto abaixo é exatamente o bloco anexado
        ao prompt do Copiloto de cada cliente — mesma resolução usada em tempo de execução.
      </div>
      <div className="addx-wrap">
        <table className="addx-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Solução contratada</th>
              <th>Contrato</th>
              <th>IA personalizada</th>
              <th>Diretrizes aplicadas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tenantId}>
                <td className="addx-name"><strong>{r.tenantName}</strong></td>
                <td>{r.productName ?? "—"}</td>
                <td>{r.contractStatus}</td>
                <td>
                  <span className={`addx-status ${r.allowsCustomAi ? "addx-status--ATIVO" : "addx-status--AGUARDANDO_DADOS"}`}>
                    {r.allowsCustomAi ? "Permitida" : "Padrão CRIVO"}
                  </span>
                </td>
                <td style={{ maxWidth: 420 }}>
                  {r.allowsCustomAi && r.directives ? (
                    <details>
                      <summary style={{ cursor: "pointer" }}>Ver bloco de contexto</summary>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: 11.5, lineHeight: 1.5, margin: "8px 0 0" }}>{r.directives}</pre>
                    </details>
                  ) : r.allowsCustomAi ? (
                    <span className="cell-mute">Permitida, mas sem diretrizes preenchidas na solução.</span>
                  ) : (
                    <span className="cell-mute">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="addx-empty">Nenhuma empresa com contrato ativo ou em rascunho.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Consumo e Limites — agregado real de ai_call_logs (últimos 30 dias). */
function AiUsagePanel() {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAiUsage(30).then(setUsage).catch(() => setError(true));
  }, []);

  if (error) return <div className="dash-state dash-state--error">Não foi possível carregar o consumo.</div>;
  if (!usage) return <p className="dash-state">Carregando consumo…</p>;

  const t = usage.totals;
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  return (
    <>
      <div className="kpi-grid crm-kpis" style={{ marginBottom: 20, gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <div className="kpi"><span className="kpi__label">Chamadas ({usage.days}d)</span><strong className="kpi__value">{fmt(t.calls)}</strong></div>
        <div className="kpi"><span className="kpi__label">Com erro</span><strong className="kpi__value">{fmt(t.errorCalls)}</strong></div>
        <div className="kpi"><span className="kpi__label">Tokens totais</span><strong className="kpi__value">{fmt(t.totalTokens)}</strong></div>
        <div className="kpi"><span className="kpi__label">Tokens de resposta</span><strong className="kpi__value">{fmt(t.completionTokens)}</strong></div>
      </div>

      <div className="addx-wrap">
        <table className="addx-table">
          <thead>
            <tr><th>Caso de uso</th><th>Chamadas</th><th>Erros</th><th>Tokens</th></tr>
          </thead>
          <tbody>
            {usage.byUseCase.map((u) => (
              <tr key={u.useCase}>
                <td className="cell-code"><code>{u.useCase}</code></td>
                <td>{fmt(u.calls)}</td>
                <td>{fmt(u.errors)}</td>
                <td>{fmt(u.totalTokens)}</td>
              </tr>
            ))}
            {usage.byUseCase.length === 0 && (
              <tr><td colSpan={4} className="addx-empty">Nenhuma chamada de IA registrada nos últimos {usage.days} dias.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="addx-wrap" style={{ marginTop: 18 }}>
        <table className="addx-table">
          <thead>
            <tr><th>Empresa</th><th>Chamadas</th><th>Tokens</th></tr>
          </thead>
          <tbody>
            {usage.byTenant.map((u) => (
              <tr key={u.tenantId ?? "none"}>
                <td className="addx-name"><strong>{u.tenantName}</strong></td>
                <td>{fmt(u.calls)}</td>
                <td>{fmt(u.totalTokens)}</td>
              </tr>
            ))}
            {usage.byTenant.length === 0 && (
              <tr><td colSpan={3} className="addx-empty">Sem consumo por empresa no período.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="crm-rules" style={{ marginTop: 18 }}>
        <span className="crm-panel__title">Limites</span>
        <p>
          Hoje o controle é por <strong>ativação global + módulos liberados</strong> (aba Casos de Uso).
          Não há cota de IA por empresa — quando essa regra comercial for definida, ela entra aqui
          usando esta mesma medição por chamada.
        </p>
      </div>
    </>
  );
}

/** Versões e Logs — versão efetiva dos prompts + telemetria por chamada. */
function AiLogsPanel() {
  const [logs, setLogs] = useState<AiLogRow[] | null>(null);
  const [prompts, setPrompts] = useState<AiPromptItem[] | null>(null);
  const [useCase, setUseCase] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAiPrompts().then(setPrompts).catch(() => setPrompts([]));
  }, []);
  useEffect(() => {
    // Guard de resposta obsoleta: trocar o filtro rápido pode fazer a resposta
    // ANTIGA chegar depois da nova e sobrescrever a lista.
    let alive = true;
    setLogs(null);
    setError(false);
    getAiLogs({ limit: 100, useCase: useCase || undefined, onlyErrors })
      .then((rows) => { if (alive) setLogs(rows); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [useCase, onlyErrors]);

  return (
    <>
      {prompts && prompts.length > 0 && (
        <div className="addx-wrap" style={{ marginBottom: 18 }}>
          <table className="addx-table">
            <thead>
              <tr><th>Prompt</th><th>Versão em uso</th><th>Última edição</th></tr>
            </thead>
            <tbody>
              {prompts.map((p) => (
                <tr key={p.useCase}>
                  <td className="addx-name"><strong>{p.label}</strong><p><code>{p.useCase}</code></p></td>
                  <td>{p.isDefault ? "padrão do sistema" : `v${p.version}`}</td>
                  <td>{p.updatedAt ? `${new Date(p.updatedAt).toLocaleString("pt-BR")}${p.updatedBy ? ` · ${p.updatedBy}` : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="evo-filters" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select className="mod-select" value={useCase} onChange={(e) => setUseCase(e.target.value)}>
          <option value="">Caso de uso: Todos</option>
          {USE_CASES.map((u) => (<option key={u.useCase} value={u.useCase}>{u.useCase}</option>))}
        </select>
        <label className="prod-check" style={{ margin: 0 }}>
          <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
          Só erros
        </label>
      </div>

      {error && (
        <div className="dash-state dash-state--error" style={{ marginTop: 14 }}>
          Não foi possível carregar os logs. Ajuste um filtro para tentar de novo.
        </div>
      )}
      {!logs && !error && <p className="dash-state">Carregando logs…</p>}
      {logs && (
        <div className="addx-wrap" style={{ marginTop: 14 }}>
          <table className="addx-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Caso de uso</th>
                <th>Empresa</th>
                <th>Modelo</th>
                <th>Tokens</th>
                <th>Latência</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(l.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="cell-code"><code>{l.useCase}</code></td>
                  <td>{l.tenantName ?? "—"}</td>
                  <td>{l.model}</td>
                  <td>{l.totalTokens != null ? l.totalTokens.toLocaleString("pt-BR") : "—"}</td>
                  <td>{(l.latencyMs / 1000).toFixed(1)}s</td>
                  <td>
                    <span className={`addx-status ${l.ok ? "addx-status--ATIVO" : "evd-status--rej"}`}>
                      {l.ok ? "OK" : "Erro"}
                    </span>
                    {!l.ok && l.errorReason && <p className="evd-reason">{l.errorReason}</p>}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="addx-empty">
                    Nenhuma chamada registrada{useCase || onlyErrors ? " com estes filtros" : " ainda — os logs começam a aparecer quando a IA for usada"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Central de Prompts (Caderno §10 · P0-c) — todos os prompts técnicos da IA, editáveis e versionados. */
function AiPromptsManager() {
  const [items, setItems] = useState<AiPromptItem[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  async function load() {
    try {
      const d = await getAiPrompts();
      setItems(d);
      setDrafts(Object.fromEntries(d.map((i) => [i.useCase, i.content])));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  async function save(useCase: string) {
    setBusyKey(useCase);
    try {
      await updateAiPrompt(useCase, drafts[useCase] ?? "");
      await load();
      setSavedKey(useCase);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao salvar o prompt");
    } finally {
      setBusyKey(null);
    }
  }

  async function reset(useCase: string) {
    if (!confirm("Restaurar o prompt padrão? A customização será removida.")) return;
    setBusyKey(useCase);
    try {
      const it = await resetAiPrompt(useCase);
      setDrafts((d) => ({ ...d, [useCase]: it.content }));
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao restaurar");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <fieldset className="prod-fs">
        <legend>Central de Prompts</legend>
        <p className="prod-note" style={{ marginTop: 0 }}>
          Todos os prompts técnicos da IA ficam aqui — um por caso de uso, editável e versionado.
          O conteúdo dinâmico (dados do líder, do lead, indicadores) é anexado automaticamente pelo
          sistema. As <strong>diretrizes do cliente</strong> (produto) entram como camada à parte.
        </p>

        {status === "loading" && <p className="dash-state">Carregando prompts…</p>}
        {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar os prompts.</div>}

        {status === "ok" && items && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map((it) => (
              <div key={it.useCase} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>{it.label}</strong>
                  <span className="prod-note" style={{ margin: 0, fontSize: 11 }}>
                    <code style={{ fontSize: 10.5 }}>{it.useCase}</code>
                    {" · "}
                    {it.isDefault ? "padrão do sistema" : `v${it.version}${it.updatedBy ? ` · ${it.updatedBy}` : ""}`}
                  </span>
                </div>
                <p className="prod-note" style={{ margin: "4px 0 6px" }}>{it.description}</p>
                <textarea
                  rows={9}
                  className="prod-field"
                  style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: 1.5, resize: "vertical" }}
                  value={drafts[it.useCase] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [it.useCase]: e.target.value }))}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
                  <button
                    className="btn btn--terra btn--sm"
                    disabled={busyKey === it.useCase || (drafts[it.useCase] ?? "") === it.content}
                    onClick={() => save(it.useCase)}
                  >
                    {busyKey === it.useCase ? "Salvando…" : "Salvar prompt"}
                  </button>
                  {!it.isDefault && (
                    <button className="btn btn--ghost btn--sm" disabled={busyKey === it.useCase} onClick={() => reset(it.useCase)}>
                      Restaurar padrão
                    </button>
                  )}
                  {savedKey === it.useCase && <span className="kb-converted">✓ Salvo</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
