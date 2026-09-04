"use client";

import type { ReactNode } from "react";
import type { DiagnosticAggregate } from "@/lib/api";

/**
 * Resultado agregado de um diagnóstico, em card.
 *
 * Nasceu dentro da tela do Essencial e virou componente porque a Visão Geral
 * passou a mostrar o mesmo resultado — é lá que o cliente procura, e era o que
 * faltava: a empresa coletava as respostas e o dashboard não mostrava nada.
 * Duas telas, um só desenho: se o card mudar, muda nos dois lugares.
 *
 * Só apresentação — quem busca os dados é a tela.
 */
export function ResultadoDiagnosticoCard({
  data,
  title,
  subtitle,
}: {
  data: DiagnosticAggregate;
  title: string;
  subtitle: ReactNode;
}) {
  const dims = data.byDimension ?? {};
  // Pior dimensão no topo: é por onde a empresa começa.
  const ordenadas = Object.entries(dims).sort((a, b) => a[1] - b[1]);

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card__head">
        <div>
          <h3>{title}</h3>
          <span className="card__sub">{subtitle}</span>
        </div>
      </div>

      {data.suppressed ? (
        <p className="card__sub">
          <strong>{data.totalRespondents} resposta(s)</strong> recebida(s). O resultado é liberado a
          partir de <strong>{data.minRespondents}</strong> — o mínimo que preserva o anonimato de quem
          respondeu. {data.minRespondents > data.totalRespondents
            ? `Faltam ${data.minRespondents - data.totalRespondents}.`
            : ""}
        </p>
      ) : (
        <>
          {/* kpi-grid--inset é a grade de 2 colunas do design system. Antes daqui
              a classe usada era `kpi-row`, que não existe em nenhum CSS: os dois
              KPIs ficavam empilhados. */}
          <div className="kpi-grid kpi-grid--inset" style={{ marginBottom: 14 }}>
            <div className="kpi">
              <span className="kpi__label">Índice geral</span>
              <strong className="kpi__value" style={{ color: data.levelColor ?? undefined }}>
                {data.score}
              </strong>
              <span className="card__sub">{data.levelLabel}</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Respondentes</span>
              <strong className="kpi__value">{data.totalRespondents}</strong>
              <span className="card__sub">
                respostas válidas
                {data.selfAssessments
                  ? ` · ${data.totalRespondents - data.selfAssessments} por link + ${data.selfAssessments} autoavaliação`
                  : ""}
              </span>
            </div>
          </div>
          {data.methodologyMixed && (
            <p className="card__sub">
              Atenção: há respostas de versões diferentes do questionário — a comparação entre elas
              não é direta.
            </p>
          )}
          <table className="data-table">
            <thead><tr><th>Dimensão</th><th style={{ width: 220 }}>Índice</th></tr></thead>
            <tbody>
              {ordenadas.map(([slug, valor]) => {
                const banda = data.dimensionBands?.[slug];
                return (
                  <tr key={slug}>
                    <td>{data.dimensionLabels?.[slug] ?? slug}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: "var(--line)", borderRadius: 999 }}>
                          <div style={{
                            width: `${valor}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: banda?.color ?? "var(--gold)",
                          }} />
                        </div>
                        <strong style={{ minWidth: 34, textAlign: "right" }}>{valor}</strong>
                      </div>
                      {banda && <span className="card__sub">{banda.label}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
