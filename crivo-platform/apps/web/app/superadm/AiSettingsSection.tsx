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
  type AiPromptItem,
} from "@/lib/admin-api";

/** Configurações de IA (auditoria 2.3.1) — token OpenAI, modelo, módulos. */
export function AiSettingsSection() {
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

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Configurações de IA</h1>
          <p className="page-sub">
            Governança central da IA: token OpenAI/ChatGPT criptografado, modelo e em quais módulos a IA pode atuar.
            A solução (Produtos) indica se <em>permite</em> IA; o contrato libera. Os <strong>prompts técnicos</strong> ficam
            centralizados aqui (editáveis e versionados, por caso de uso) — não no cadastro de solução.
          </p>
        </div>
      </div>

      <div className="cnae-note cnae-block--warn" style={{ marginBottom: 14 }}>
        <strong>Governança (§11).</strong> A IA <strong>apoia — não decide</strong>: gera rascunhos e sinaliza, mas
        <strong> não valida a entrega final sensível</strong> (parecer, laudo, diagnóstico). A palavra final é sempre
        do especialista humano. Ela também <strong>não valida plano, evidência, dossiê ou economia automaticamente</strong>.
      </div>

      <div className="adm-callout">
        <strong>Prompt técnico é fixo e interno.</strong> O cliente nunca edita o prompt técnico. As
        <strong> diretrizes aprovadas do cliente</strong> (objetivo, regras, base de conhecimento e limitações
        em <em>Soluções → aiConfig</em>) são <strong>injetadas como contexto</strong> no prompt do Mentor/App
        (Copiloto) quando o produto contratado permite IA personalizada — sem sobrescrever o prompt técnico, que
        fica na <strong>Central de Prompts</strong> abaixo (versionado). Log por chamada segue como próxima fatia.
      </div>

      {status === "loading" && <p className="dash-state">Carregando…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar.</div>}

      {status === "ok" && data && (
        <div className="card" style={{ maxWidth: 720 }}>
          <fieldset className="prod-fs">
            <legend>Conexão</legend>
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

          <fieldset className="prod-fs" style={{ marginTop: 16 }}>
            <legend>Ativação</legend>
            <label className="prod-check" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              IA ativada no sistema
            </label>
            <span className="prod-note" style={{ margin: "0 0 8px" }}>Módulos que podem usar IA:</span>
            <div className="prod-modules">
              {MODULES.map((m) => (
                <label key={m.code} className="prod-check">
                  <input type="checkbox" checked={mods.includes(m.code)} onChange={() => toggleMod(m.code)} disabled={!enabled} />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
            <button className="btn btn--terra btn--sm" disabled={saving} onClick={save}>
              {saving ? "Salvando…" : "Salvar configurações"}
            </button>
            {savedMsg && <span className="kb-converted">✓ Salvo</span>}
          </div>
        </div>
      )}

      <AiPromptsManager />
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
    <div className="card" style={{ maxWidth: 720, marginTop: 18 }}>
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
