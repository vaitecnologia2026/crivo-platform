"use client";

import { useEffect, useState } from "react";
import { getEngineOverview, type EngineOverview } from "@/lib/admin-api";

type Section = string;

/** Peça configurável de um motor (o que o cliente ajusta) — call 14/07. */
type EnginePiece = { label: string; hint: string };
type EngineCard = {
  key: Section;
  name: string;
  role: string;
  pieces: EnginePiece[];
  metrics: (o: EngineOverview) => { label: string; value: string }[];
  feedsReports: boolean;
};

const ENGINES: EngineCard[] = [
  {
    key: "cnae",
    name: "Motor de Enquadramento",
    role: "Recomenda a solução, o diagnóstico e a jornada a partir do CNPJ/CNAE e sinais operacionais. Read-only — não ativa contrato.",
    pieces: [
      { label: "Regras por divisão CNAE", hint: "risco preliminar por divisão (00–99)" },
      { label: "Sinais operacionais", hint: "turnover, liderança, expansão, governança de IA" },
      { label: "Validação humana", hint: "obrigatória antes da proposta comercial" },
    ],
    metrics: (o) => [{ label: "Regras CNAE", value: String(o.enquadramento.cnaeRules) }],
    feedsReports: true,
  },
  {
    key: "metodologia",
    name: "Motor de Diagnósticos",
    role: "Cadastra os diagnósticos (dimensões, perguntas, pesos, faixas) e a memória de cálculo. Versionado — cada mudança gera uma versão nova, a anterior é arquivada.",
    pieces: [
      { label: "Dimensões e perguntas", hint: "peso, invertida, faixas por instrumento" },
      { label: "Memória de cálculo", hint: "média ponderada · média simples · soma normalizada" },
      { label: "Instrumentos", hint: "diagnósticos nativos + personalizados (sem depender de dev)" },
    ],
    metrics: (o) => [
      { label: "Instrumentos ativos", value: String(o.diagnosticos.instruments) },
      { label: "Metodologias publicadas", value: String(o.diagnosticos.activeMethodologies) },
      { label: "Respostas coletadas", value: String(o.diagnosticos.responses) },
    ],
    feedsReports: true,
  },
  {
    key: "evolucao",
    name: "Motor de Evolução",
    role: "Consolida o Plano de Evolução do cliente: ações com origem, responsável, prazo, evidência e status. Rastreável por origem (diagnóstico, consultor, IA…).",
    pieces: [
      { label: "Ações e origens", hint: "de onde veio cada ação (diagnóstico, consultor, IA…)" },
      { label: "Governança de status", hint: "sugerida → em revisão → aprovada → concluída" },
      { label: "Evidência esperada", hint: "o que cada ação precisa comprovar" },
    ],
    metrics: (o) => [{ label: "Ações no plano", value: String(o.evolucao.actions) }],
    feedsReports: true,
  },
  {
    key: "evidencias",
    name: "Evidências",
    role: "Governança das evidências enviadas pelo cliente: a CRIVO aprova, rejeita (com motivo) ou substitui. Evidência aprovada alimenta dossiês e relatórios.",
    pieces: [
      { label: "Tipos de evidência", hint: "ata, print, documento, indicador, link…" },
      { label: "Fluxo de aprovação", hint: "aprovar · rejeitar com motivo · substituir" },
      { label: "Alimenta o dossiê", hint: "só evidência aprovada entra no relatório" },
    ],
    metrics: (o) => [
      { label: "Total de evidências", value: String(o.evidencias.total) },
      { label: "Aprovadas", value: String(o.evidencias.approved) },
    ],
    feedsReports: true,
  },
];

/**
 * Configuração do Motor (mockup do cliente 14/07): centro de configuração dos
 * motores CRIVO. Mostra o que cada motor configura, os números reais e o que
 * alimenta os relatórios — para o cliente ter "liberdade de configurar e
 * precisão nos relatórios". Abrir cada motor leva à sua tela de configuração.
 */
export function EngineConfigSection({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const [overview, setOverview] = useState<EngineOverview | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    getEngineOverview()
      .then((o) => { setOverview(o); setStatus("ok"); })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Configuração do Motor</h1>
          <p className="page-sub">
            Centro de configuração dos motores CRIVO. Cada motor tem suas peças e sua pontuação — configure
            uma vez, sem depender de desenvolvimento, e mantenha a precisão dos relatórios.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando motores…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar os motores.</div>
      )}

      {status === "ok" && overview && (
        <>
          <div className="eng-grid">
            {ENGINES.map((e) => (
              <article key={e.key} className="eng-card">
                <div className="eng-card__head">
                  <h2 className="eng-card__name">{e.name}</h2>
                  {e.feedsReports && <span className="eng-card__feed">Alimenta relatórios</span>}
                </div>
                <p className="eng-card__role">{e.role}</p>

                <div className="eng-metrics">
                  {e.metrics(overview).map((m) => (
                    <div key={m.label} className="eng-metric">
                      <strong>{m.value}</strong>
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>

                <div className="eng-pieces">
                  <span className="sol-label">Peças configuráveis</span>
                  <ul>
                    {e.pieces.map((p) => (
                      <li key={p.label}>
                        <strong>{p.label}</strong>
                        <span>{p.hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button type="button" className="btn btn--sm sol-newbtn eng-card__open" onClick={() => onNavigate(e.key)}>
                  Abrir {e.name}
                </button>
              </article>
            ))}
          </div>

          {/* Como os motores compõem o relatório do cliente (precisão dos relatórios) */}
          <div className="eng-flow">
            <span className="crm-panel__title">Como os motores alimentam os relatórios</span>
            <div className="eng-flow__chain">
              <span className="eng-flow__step">Enquadramento</span>
              <i aria-hidden="true">→</i>
              <span className="eng-flow__step">Diagnóstico</span>
              <i aria-hidden="true">→</i>
              <span className="eng-flow__step">Evolução (ações)</span>
              <i aria-hidden="true">→</i>
              <span className="eng-flow__step">Evidências aprovadas</span>
              <i aria-hidden="true">→</i>
              <span className="eng-flow__step eng-flow__step--out">Dossiês & Relatórios</span>
            </div>
            <p>
              O relatório do cliente é montado nesta ordem: a recomendação do enquadramento orienta o
              diagnóstico contratado; a pontuação do diagnóstico gera o plano de evolução; cada ação recebe
              evidências que a CRIVO aprova; só o que é aprovado entra nos dossiês e relatórios. Ajustar a
              memória de cálculo de um diagnóstico muda a pontuação — e a precisão do relatório — de forma
              versionada e rastreável.
            </p>
          </div>

          <div className="crm-rules">
            <span className="crm-panel__title">Regras desta tela</span>
            <p>
              A <strong>Configuração do Motor</strong> é o mapa dos motores. A configuração de cada motor
              acontece na tela do próprio motor; a <strong>ativação por cliente</strong> ocorre em Contratos
              e Liberações. Mudanças na memória de cálculo são <strong>versionadas</strong> — nenhuma
              resposta já pontuada é recalculada retroativamente.
            </p>
          </div>
        </>
      )}
    </>
  );
}
