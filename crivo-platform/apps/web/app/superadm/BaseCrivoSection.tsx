"use client";

import { useEffect, useState } from "react";
import { PEOPLE_INDICATORS } from "@crivo/types";
import { getBenchmarks, type BenchmarksData } from "../../lib/admin-api";
import "./cnae.css";

const LABELS: Record<string, string> = {
  ...Object.fromEntries(PEOPLE_INDICATORS.map((d) => [d.key, d.label])),
  diagnostico: "Diagnóstico (pré)",
};
const COL_ORDER = [...PEOPLE_INDICATORS.map((d) => d.key), "diagnostico"];

/** Base CRIVO / Benchmarks (Fase 5 — §11): inteligência agregada e anonimizada. */
export function BaseCrivoSection() {
  const [data, setData] = useState<BenchmarksData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    getBenchmarks()
      .then((d) => {
        setData(d);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  const cols = data ? COL_ORDER.filter((k) => data.groups.some((g) => !g.suppressed && g.averages[k] != null)) : [];

  return (
    <div>
      <p className="cnae-muted" style={{ marginTop: 0 }}>
        Inteligência <strong>agregada e anonimizada</strong> entre as empresas-cliente — benchmarks por porte, com
        supressão de recortes pequenos. Base da evolução metodológica, cases e prova social (§11).
      </p>

      <div className="cnae-note cnae-block--warn" style={{ marginBottom: 14 }}>
        <strong>Privacidade &amp; finalidade.</strong> <strong>Opt-in por empresa</strong> (só entra quem autorizou o uso
        no benchmark, em <em>Empresas → Dados</em>) + anonimização + volume mínimo ({data?.minCount ?? 3} empresas por
        recorte) + LGPD + <strong>log de acesso</strong>. Nenhuma empresa é identificável; recortes pequenos são suprimidos.
      </div>

      {status === "loading" && <p className="cnae-muted">Carregando base agregada…</p>}
      {status === "error" && <div className="cnae-note cnae-block--warn">Não foi possível carregar.</div>}

      {status === "ok" && data && (
        <>
          <div className="cnae-card__hero" style={{ marginBottom: 12 }}>
            <span className="cnae-badge cnae-badge--baixo">{data.totalCompanies} empresa(s) autorizada(s)</span>
            <span className="cnae-muted">
              {data.groups.length} recorte(s) · {data.suppressedGroups} suprimido(s) por volume
            </span>
          </div>

          {data.groups.length === 0 ? (
            <p className="cnae-muted">
              Ainda sem recortes. A base agrega só empresas que <strong>autorizaram</strong> o uso no benchmark
              (marque em <em>Empresas → Dados</em>) e que tenham dados de People Analytics/diagnóstico suficientes.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="cnae-table">
                <thead>
                  <tr>
                    <th>Recorte (porte)</th>
                    <th>Empresas</th>
                    {cols.map((k) => (
                      <th key={k}>{LABELS[k] ?? k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((g) => (
                    <tr key={g.group}>
                      <td><strong>{g.group}</strong></td>
                      <td>{g.count}</td>
                      {g.suppressed ? (
                        <td colSpan={Math.max(1, cols.length)} style={{ color: "var(--text-muted,#8a8174)" }}>
                          confidencial (menos de {data.minCount} empresas)
                        </td>
                      ) : (
                        cols.map((k) => <td key={k}>{g.averages[k] != null ? g.averages[k] : "—"}</td>)
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="cnae-block" style={{ marginTop: 16 }}>
            <h4>Próximas camadas (§11)</h4>
            <p className="cnae-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              <strong>Cases</strong> (autorizados/anonimizados) e <strong>relatórios de impacto</strong> por ciclo entram
              quando houver volume + autorização contratual. A base agregada também é o insumo do{" "}
              <strong>paper metodológico</strong> futuro. O recorte por <strong>setor</strong> abre quando houver
              empresas suficientes por segmento (hoje agregamos por porte para preservar o anonimato).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
