"use client";

import { useEffect, useState } from "react";
import type { GroupOverview } from "@crivo/types";
import { getMyGroupOverview } from "@/lib/api";

type LoadStatus = "loading" | "ok" | "denied" | "error";

function scorePill(score: number): string {
  if (score >= 70) return "score-pill score-pill--high";
  if (score >= 50) return "score-pill score-pill--mid";
  return "score-pill score-pill--low";
}

function pct(done: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((done / total) * 100)}%`;
}

/** F3 — Consolidado do Grupo Empresarial (portal do cliente · Admin de Grupo).
 *  Só agregados por CNPJ (§11). O acesso é resolvido no backend (grupo
 *  consolidado + e-mail autorizado); 403 vira a mensagem "sem acesso". */
export function GrupoScreen() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [data, setData] = useState<GroupOverview | null>(null);

  useEffect(() => {
    let alive = true;
    getMyGroupOverview()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setStatus("ok");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message.toLowerCase() : "";
        setStatus(msg.includes("acesso") || msg.includes("403") ? "denied" : "error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const c = data?.consolidated;

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Grupo Empresarial</h1>
          <p className="page-sub">
            Visão consolidada dos CNPJs do seu grupo. Cada empresa mantém seus dados
            separados — aqui você acompanha o todo.
          </p>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando consolidado do grupo…</p>}

      {status === "denied" && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Consolidado do grupo não disponível</h3>
              <span className="card__sub">
                A visão consolidada do grupo é liberada pela CRIVO mediante contratação e
                autorização. Fale com a CRIVO para habilitar o acesso.
              </span>
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar o consolidado.</div>
      )}

      {status === "ok" && data && c && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <span className="kpi__label">Empresas (CNPJs)</span>
              <strong className="kpi__value">{c.tenants}</strong>
              <span className="kpi__delta">{c.activeUsers} usuários ativos</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">ICD do grupo</span>
              <strong className="kpi__value">{c.icdAverage ?? "—"}</strong>
              <span className="kpi__delta">
                {c.icdCovered > 0
                  ? `média de ${c.icdCovered} CNPJ${c.icdCovered === 1 ? "" : "s"} com ciclo fechado`
                  : "sem ciclo ICD fechado"}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Plano de ação</span>
              <strong className="kpi__value">{pct(c.actionsDone, c.actionsTotal)}</strong>
              <span className="kpi__delta">
                {c.actionsDone}/{c.actionsTotal} ações encerradas
              </span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Evidências</span>
              <strong className="kpi__value">{c.evidences}</strong>
              <span className="kpi__delta">
                {c.campaignsOpen} campanha{c.campaignsOpen === 1 ? "" : "s"} aberta
                {c.campaignsOpen === 1 ? "" : "s"} · Pocket {c.pocketDone}/{c.pocketTotal}
              </span>
            </div>
          </div>

          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empresa (CNPJ)</th>
                  <th>ICD</th>
                  <th>Usuários</th>
                  <th>Avaliações</th>
                  <th>Ações</th>
                  <th>Evidências</th>
                  <th>Pocket</th>
                  <th>Campanhas</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((t) => (
                  <tr key={t.tenantId}>
                    <td>
                      <strong>{t.name}</strong>
                      {t.status !== "ACTIVE" && (
                        <span className="pattern-tag pattern-tag--alert" style={{ marginLeft: 8 }}>
                          {t.status === "SUSPENDED" ? "Bloqueada" : "Excluída"}
                        </span>
                      )}
                    </td>
                    <td>
                      {t.icdScore != null ? (
                        <span className={scorePill(t.icdScore)}>{t.icdScore}</span>
                      ) : t.icdSuppressed ? (
                        <span
                          className="cell-mute"
                          title="Suprimido pela regra de privacidade (menos de 5 líderes elegíveis)"
                        >
                          suprimido
                        </span>
                      ) : (
                        <span className="cell-mute">—</span>
                      )}
                    </td>
                    <td>{t.activeUsers}</td>
                    <td>{t.assessments}</td>
                    <td>
                      {t.actionsDone}/{t.actionsTotal}
                      <span className="cell-mute"> ({pct(t.actionsDone, t.actionsTotal)})</span>
                    </td>
                    <td>{t.evidences}</td>
                    <td>
                      {t.pocketDone}/{t.pocketTotal}
                    </td>
                    <td>
                      {t.campaignsOpen} aberta{t.campaignsOpen === 1 ? "" : "s"}
                      <span className="cell-mute"> de {t.campaignsTotal}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="objection" style={{ marginTop: 16 }}>
            Dados agregados por empresa. Em respeito à privacidade (§11), nenhum resultado
            individual de líder é exibido no consolidado.
          </p>
        </>
      )}
    </>
  );
}
