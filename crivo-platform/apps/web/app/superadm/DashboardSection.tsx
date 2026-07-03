"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CONTRACT_STATUS_LABEL, type ContractStatus, type DashboardData } from "@crivo/types";
import { getDashboard } from "@/lib/admin-api";

type Load = "loading" | "error" | "ok";

const PERIODS: { days: number; label: string }[] = [
  { days: 30, label: "30 dias" },
  { days: 60, label: "60 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
];

const FILTER_CHIPS = [
  "Origem",
  "Responsável",
  "Grupo",
  "Empresa",
  "CNPJ",
  "Solução",
  "Status",
  "Tipo de contrato",
  "Cidade",
  "Estado",
  "Consultor",
];

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const SEV_COLOR: Record<string, string> = { CRITICO: "#C0392B", ATENCAO: "#8A6D1F", OK: "#2E7D4F" };
const SEV_BG: Record<string, string> = { CRITICO: "#F9E9E1", ATENCAO: "#FAF3DC", OK: "#EAF4EE" };
const SEV_LABEL: Record<string, string> = { CRITICO: "🔴 Crítico", ATENCAO: "🟠 Atenção", OK: "🟢 Em dia" };

/** Barra horizontal com track + fill inline (não depende de classe externa). */
function Bars({
  items,
  color = "#A8693D",
}: {
  items: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 44px", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-sec, #5B6B7B)" }}>{it.label}</span>
          <span style={{ height: 8, borderRadius: 99, background: "rgba(20,38,60,.08)", overflow: "hidden" }}>
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${Math.round((it.value / max) * 100)}%`,
                background: color,
                borderRadius: 99,
                transition: "width .6s ease",
              }}
            />
          </span>
          <strong style={{ fontSize: 13, textAlign: "right" }}>{it.value}</strong>
        </div>
      ))}
      {items.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-sec)" }}>Sem dados no período.</span>}
    </div>
  );
}

const SEC_HEAD: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "#14263C",
  margin: "26px 0 12px",
  paddingBottom: 6,
  borderBottom: "1px solid var(--line, #E3DDD3)",
};

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0) return <span className="kpi__delta">período anterior: 0</span>;
  const pctChange = Math.round(((now - prev) / prev) * 100);
  const up = pctChange >= 0;
  return (
    <span className="kpi__delta" style={{ color: up ? "#2E7D4F" : "#C0392B" }}>
      {up ? "↑" : "↓"} {Math.abs(pctChange)}% vs. anterior
    </span>
  );
}

/** Dashboard de Gestão CRIVO (Caderno Tela 01) — central operacional. Dados reais
 *  do banco; métricas ainda não modeladas aparecem na nota "a modelar". */
export function DashboardSection() {
  const [days, setDays] = useState(30);
  const [load, setLoad] = useState<Load>("loading");
  const [d, setD] = useState<DashboardData | null>(null);

  useEffect(() => {
    let alive = true;
    setLoad("loading");
    getDashboard(days)
      .then((res) => {
        if (!alive) return;
        setD(res);
        setLoad("ok");
      })
      .catch(() => {
        if (alive) setLoad("error");
      });
    return () => {
      alive = false;
    };
  }, [days]);

  return (
    <>
      {/* Filtros globais */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 12.5, letterSpacing: ".04em" }}>Período</strong>
          <div style={{ display: "flex", gap: 4 }}>
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className="btn btn--sm"
                style={{
                  background: days === p.days ? "#14263C" : "transparent",
                  color: days === p.days ? "#fff" : "inherit",
                  border: "1px solid var(--line, #E3DDD3)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span style={{ width: 1, height: 20, background: "var(--line, #E3DDD3)" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {FILTER_CHIPS.map((f) => (
              <span key={f} className="pattern-tag" style={{ opacity: 0.5 }} title="Filtro em breve">
                {f}
              </span>
            ))}
            <span style={{ fontSize: 11.5, color: "var(--text-sec)" }}>filtros adicionais — em breve</span>
          </div>
        </div>
      </div>

      {load === "loading" && <p className="dash-state">Carregando o dashboard…</p>}
      {load === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar o dashboard.</div>
      )}

      {load === "ok" && d && (
        <>
          {/* ══ COMERCIAL ══ */}
          <div style={SEC_HEAD}>Comercial</div>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">Leads no período</span>
              <strong className="kpi__value">{d.comercial.leads}</strong>
              <Delta now={d.comercial.leads} prev={d.comercial.leadsPrev} />
            </div>
            <div className="kpi">
              <span className="kpi__label">Propostas</span>
              <strong className="kpi__value">{d.comercial.propostas}</strong>
              <span className="kpi__delta">em etapa de proposta</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Vendas fechadas</span>
              <strong className="kpi__value">{d.comercial.fechadas}</strong>
              <span className="kpi__delta">conversão {d.comercial.conversao}%</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Faturamento estimado</span>
              <strong className="kpi__value" style={{ fontSize: 28 }}>{brl(d.comercial.faturamentoEstimadoCents)}</strong>
              <span className="kpi__delta">ticket médio {brl(d.comercial.ticketMedioCents)} · estimado</span>
            </div>
          </div>

          <div className="grid grid--2" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Funil comercial</h3>
                  <span className="card__sub">Distribuição dos leads por etapa (período)</span>
                </div>
              </div>
              <Bars items={d.comercial.funnel.map((f) => ({ label: f.label, value: f.count }))} />
            </div>
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Conversão por origem</h3>
                  <span className="card__sub">De onde vêm os leads</span>
                </div>
              </div>
              <Bars items={d.comercial.porOrigem.map((o) => ({ label: o.origem, value: o.count }))} color="#14263C" />
            </div>
          </div>

          {d.comercial.porSolucao.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card__head">
                <div>
                  <h3>Soluções mais contratadas</h3>
                  <span className="card__sub">Contratos ativos por solução + receita mensal estimada</span>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Solução</th><th>Contratos</th><th>Receita mensal (est.)</th></tr>
                </thead>
                <tbody>
                  {d.comercial.porSolucao.map((s) => (
                    <tr key={s.produto}>
                      <td><strong>{s.produto}</strong></td>
                      <td>{s.count}</td>
                      <td>{brl(s.receitaMensalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ CONTRATOS ══ */}
          <div style={SEC_HEAD}>Contratos</div>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">Contratos ativos</span>
              <strong className="kpi__value">{d.contratos.ativos}</strong>
              <span className="kpi__delta">{d.contratos.comAdicionais} com adicionais</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">MRR (recorrência)</span>
              <strong className="kpi__value" style={{ fontSize: 28 }}>{brl(d.contratos.mrrCents)}</strong>
              <span className="kpi__delta">ARR {brl(d.contratos.arrCents)} · estimado</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Vencendo (30/60/90d)</span>
              <strong className="kpi__value">{d.contratos.vencendo30}<small> / {d.contratos.vencendo60} / {d.contratos.vencendo90}</small></strong>
              <span className="kpi__delta">renovações a acompanhar</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Com adicionais</span>
              <strong className="kpi__value">{d.contratos.comAdicionais}</strong>
              <span className="kpi__delta">upsell ativo</span>
            </div>
          </div>
          {d.contratos.porStatus.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card__head"><div><h3>Contratos por status</h3></div></div>
              <Bars
                items={d.contratos.porStatus.map((s) => ({
                  label: CONTRACT_STATUS_LABEL[s.status as ContractStatus] ?? s.status,
                  value: s.count,
                }))}
              />
            </div>
          )}

          {/* ══ ENTREGAS ══ */}
          <div style={SEC_HEAD}>Entregas dos clientes</div>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">Diagnósticos em andamento</span>
              <strong className="kpi__value">{d.entregas.diagnosticosAndamento}</strong>
              <span className="kpi__delta">{d.entregas.avaliacoes} avaliações no total</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Planos pendentes</span>
              <strong className="kpi__value">{d.entregas.planosPendentes}</strong>
              <span className="kpi__delta">{d.entregas.acoesPendentes} ações não concluídas</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Mentorias</span>
              <strong className="kpi__value">{d.entregas.mentoriasAgendadas}</strong>
              <span className="kpi__delta" style={{ color: d.entregas.mentoriasAtrasadas > 0 ? "#C0392B" : undefined }}>
                {d.entregas.mentoriasAtrasadas} atrasada(s)
              </span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Clientes sem responsável</span>
              <strong className="kpi__value">{d.entregas.clientesSemResponsavel}</strong>
              <span className="kpi__delta">{d.entregas.evidencias} evidências registradas</span>
            </div>
          </div>

          {/* ══ INDICADORES EXECUTIVOS ══ */}
          <div style={SEC_HEAD}>Indicadores executivos</div>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi__label">Clientes ativos</span>
              <strong className="kpi__value">{d.executivo.clientesAtivos}</strong>
              <span className="kpi__delta">{d.executivo.novosClientes} novos no período</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Clientes bloqueados</span>
              <strong className="kpi__value">{d.executivo.clientesBloqueados}</strong>
              <span className="kpi__delta">acesso suspenso</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Novos clientes</span>
              <strong className="kpi__value">{d.executivo.novosClientes}</strong>
              <span className="kpi__delta">últimos {d.periodDays} dias</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Taxa de conversão</span>
              <strong className="kpi__value">{d.comercial.conversao}%</strong>
              <span className="kpi__delta">lead → venda</span>
            </div>
          </div>

          {/* ══ CENTRAL DE PENDÊNCIAS ══ */}
          <div style={SEC_HEAD}>Central de pendências</div>
          <div className="card">
            {d.pendencias.length === 0 ? (
              <p className="dash-state" style={{ margin: 0 }}>🟢 Nada pendente por aqui — tudo em dia.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Prioridade</th><th>Empresa</th><th>Tipo</th><th>Prazo</th></tr>
                </thead>
                <tbody>
                  {d.pendencias.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <span
                          className="pattern-tag"
                          style={{ background: SEV_BG[p.severidade], color: SEV_COLOR[p.severidade] }}
                        >
                          {SEV_LABEL[p.severidade]}
                        </span>
                      </td>
                      <td><strong>{p.empresa}</strong></td>
                      <td>{p.tipo}</td>
                      <td className="cell-mute">
                        {p.prazo ? new Date(p.prazo).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Nota de honestidade: métricas ainda não modeladas */}
          <div
            className="card"
            style={{ marginTop: 16, background: "#FBF9F5", borderLeft: "3px solid #A8693D" }}
          >
            <div className="card__head">
              <div>
                <h3>Métricas a modelar</h3>
                <span className="card__sub">
                  Itens do caderno que ainda não têm dado no sistema — não são exibidos com número
                  para não induzir a leitura. Precisam de nova modelagem/decisão.
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {d.naoModelado.map((m) => (
                <span key={m} className="pattern-tag pattern-tag--alert">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
