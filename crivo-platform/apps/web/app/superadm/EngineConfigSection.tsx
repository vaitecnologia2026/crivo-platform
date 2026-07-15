"use client";

import { useEffect, useState } from "react";
import {
  SCORE_AGGREGATIONS,
  SCORE_AGGREGATION_LABEL,
  DEFAULT_SCALE_LABELS,
} from "@crivo/types";
import {
  getEngineConfig,
  saveEngineConfig,
  getEngineOverview,
  type EngineConfig,
  type EngineOverview,
} from "@/lib/admin-api";

type Section = string;

const BAND_KIND_LABEL: Record<EngineConfig["defaultBandKind"], string> = {
  MATURITY: "Maturidade (evolução: inicial → referência)",
  RISK: "Risco (severidade: baixo → crítico)",
};

/**
 * Configuração do Motor — a tela onde o Super Admin DEFINE como o motor funciona
 * (feedback do cliente 15/07: definir aqui, não redirecionar para os motores).
 * Cada regra abaixo é GRAVADA e TOMA EFEITO: o mínimo de respondentes governa a
 * supressão de anonimato de toda agregação; os padrões viram o ponto de partida
 * de todo diagnóstico novo. Versionado e rastreável — nada já pontuado é
 * recalculado retroativamente.
 */
export function EngineConfigSection({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const [cfg, setCfg] = useState<EngineConfig | null>(null);
  const [overview, setOverview] = useState<EngineOverview | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  // rascunho editável
  const [minResp, setMinResp] = useState(5);
  const [aggregation, setAggregation] = useState<EngineConfig["defaultAggregation"]>("MEDIA_PONDERADA");
  const [bandKind, setBandKind] = useState<EngineConfig["defaultBandKind"]>("MATURITY");
  const [customScale, setCustomScale] = useState(false);
  const [scale, setScale] = useState<string[]>(["", "", "", "", ""]);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  function hydrate(c: EngineConfig) {
    setCfg(c);
    setMinResp(c.minRespondents);
    setAggregation(c.defaultAggregation);
    setBandKind(c.defaultBandKind);
    const hasScale = c.defaultScaleLabels.length === 5;
    setCustomScale(hasScale);
    setScale(hasScale ? c.defaultScaleLabels : ["", "", "", "", ""]);
  }

  async function load() {
    try {
      const [c, o] = await Promise.all([getEngineConfig(), getEngineOverview()]);
      hydrate(c);
      setOverview(o);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  const floor = cfg?.floor ?? 3;
  const ceil = cfg?.ceil ?? 100;
  const belowSafe = minResp < 5;

  async function save() {
    setSaving(true);
    setSavedMsg(false);
    try {
      const labels = customScale ? scale.map((s) => s.trim()) : [];
      if (customScale && labels.some((s) => !s)) {
        alert("Preencha os 5 rótulos da escala padrão — ou desmarque para usar a escala CRIVO.");
        setSaving(false);
        return;
      }
      const saved = await saveEngineConfig({
        minRespondents: minResp,
        defaultAggregation: aggregation,
        defaultBandKind: bandKind,
        defaultScaleLabels: labels,
      });
      hydrate(saved);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao salvar a configuração do motor.");
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    !!cfg &&
    (minResp !== cfg.minRespondents ||
      aggregation !== cfg.defaultAggregation ||
      bandKind !== cfg.defaultBandKind ||
      (customScale ? scale.map((s) => s.trim()).join("|") : "") !==
        (cfg.defaultScaleLabels.length === 5 ? cfg.defaultScaleLabels.join("|") : ""));

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Configuração do Motor</h1>
          <p className="page-sub">
            Defina aqui <strong>como o motor funciona</strong>. Estas regras são globais, valem para
            todos os diagnósticos e tomam efeito assim que você salva — sem depender de desenvolvimento.
            Mudanças são versionadas: nenhuma resposta já pontuada é recalculada retroativamente.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando configuração…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar a configuração do motor.</div>
      )}

      {status === "ok" && cfg && (
        <>
          <div className="card" style={{ maxWidth: 760 }}>
            {/* 1 — Anonimato e divulgação */}
            <fieldset className="prod-fs">
              <legend>Anonimato e divulgação</legend>
              <div className="prod-form__grid">
                <label className="prod-field">
                  <span>Mínimo de respondentes para divulgar um resultado</span>
                  <input
                    type="number"
                    min={floor}
                    max={ceil}
                    value={minResp}
                    onChange={(e) => setMinResp(Math.max(floor, Math.min(ceil, Number(e.target.value) || floor)))}
                  />
                </label>
              </div>
              <p className="prod-note" style={{ marginBottom: 4 }}>
                Nenhum agregado — geral ou por setor — é revelado com menos respondentes do que isso.
                É a proteção de anonimato (LGPD). <strong>Toma efeito em:</strong> diagnósticos aplicados
                (link <code>/d/</code>) e questionário psicossocial.
              </p>
              {belowSafe && (
                <div className="cnae-note cnae-block--warn" style={{ marginTop: 8 }}>
                  <strong>Atenção.</strong> Abaixo de 5 respondentes a proteção de anonimato enfraquece —
                  resultados podem se aproximar de respostas individuais. Use um valor menor só em pilotos
                  controlados. Mínimo permitido: {floor}.
                </div>
              )}
            </fieldset>

            {/* 2 — Padrões de todo diagnóstico novo */}
            <fieldset className="prod-fs" style={{ marginTop: 16 }}>
              <legend>Padrão dos diagnósticos novos</legend>
              <p className="prod-note" style={{ marginTop: 0 }}>
                Ponto de partida ao criar um diagnóstico. Cada diagnóstico pode sobrepor o seu na tela do
                Motor de Diagnósticos — aqui você define o <strong>padrão</strong>.
              </p>
              <div className="prod-form__grid">
                <label className="prod-field prod-field--full">
                  <span>Modo de cálculo padrão</span>
                  <select value={aggregation} onChange={(e) => setAggregation(e.target.value as EngineConfig["defaultAggregation"])}>
                    {SCORE_AGGREGATIONS.map((a) => (
                      <option key={a} value={a}>{SCORE_AGGREGATION_LABEL[a]}</option>
                    ))}
                  </select>
                </label>
                <label className="prod-field prod-field--full">
                  <span>Régua padrão (tipo de faixa)</span>
                  <select value={bandKind} onChange={(e) => setBandKind(e.target.value as EngineConfig["defaultBandKind"])}>
                    {(["MATURITY", "RISK"] as const).map((k) => (
                      <option key={k} value={k}>{BAND_KIND_LABEL[k]}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="prod-check" style={{ marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={customScale}
                  onChange={(e) => {
                    setCustomScale(e.target.checked);
                    if (e.target.checked && scale.every((s) => !s.trim())) {
                      setScale([...DEFAULT_SCALE_LABELS]);
                    }
                  }}
                />
                Definir uma escala de resposta padrão própria
              </label>
              {!customScale ? (
                <p className="prod-note" style={{ margin: "6px 0 0" }}>
                  Usando a escala CRIVO padrão: {DEFAULT_SCALE_LABELS.join(" · ")}. A escala é rotulagem —
                  não altera a pontuação.
                </p>
              ) : (
                <div className="prod-form__grid" style={{ marginTop: 8 }}>
                  {scale.map((v, i) => (
                    <label key={i} className="prod-field">
                      <span>Âncora {i + 1}</span>
                      <input
                        type="text"
                        maxLength={60}
                        value={v}
                        placeholder={DEFAULT_SCALE_LABELS[i]}
                        onChange={(e) => setScale((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
              <button className="btn btn--terra btn--sm" disabled={saving || !dirty} onClick={save}>
                {saving ? "Salvando…" : "Salvar regras do motor"}
              </button>
              {savedMsg && <span className="kb-converted">✓ Salvo · em vigor</span>}
              {cfg.updatedAt && !savedMsg && (
                <span className="prod-note" style={{ margin: 0 }}>
                  Última alteração: {new Date(cfg.updatedAt).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          </div>

          {/* Onde estas regras estão valendo agora (efeito real, não atalho) */}
          {overview && (
            <div className="eng-flow" style={{ marginTop: 18 }}>
              <span className="crm-panel__title">Onde estas regras estão valendo agora</span>
              <div className="eng-metrics" style={{ marginTop: 10 }}>
                <div className="eng-metric">
                  <strong>{overview.diagnosticos.instruments}</strong>
                  <span>diagnósticos ativos usam estes padrões</span>
                </div>
                <div className="eng-metric">
                  <strong>{overview.diagnosticos.responses}</strong>
                  <span>respostas sob a regra de anonimato</span>
                </div>
                <div className="eng-metric">
                  <strong>{minResp}</strong>
                  <span>respondentes mínimos para divulgar</span>
                </div>
              </div>
              <p style={{ marginTop: 10 }}>
                O conteúdo de cada diagnóstico (dimensões, perguntas, pesos e faixas) é editado em{" "}
                <button type="button" className="linklike" onClick={() => onNavigate("metodologia")}>
                  Motor de Diagnósticos
                </button>
                . Esta tela define o comportamento comum a todos eles.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
