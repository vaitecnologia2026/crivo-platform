"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  CONTRACT_STATUS_LABEL,
  platformLeadOriginLabel,
  type BusinessGroupSummary,
  type ContractStatus,
  type DashboardData,
  type TenantSummary,
} from "@crivo/types";
import { getDashboard, listAllContracts, listGroups, listTenants, type ContractListItem } from "@/lib/admin-api";

type Load = "loading" | "error" | "ok";
type Tab = "executiva" | "comercial" | "contratos" | "clientes" | "entregas" | "exportacoes";

const TABS: { key: Tab; label: string }[] = [
  { key: "executiva", label: "Visão Executiva" },
  { key: "comercial", label: "Comercial" },
  { key: "contratos", label: "Contratos e Receita" },
  { key: "clientes", label: "Clientes, Soluções e Adicionais" },
  { key: "entregas", label: "Entregas" },
  { key: "exportacoes", label: "Exportações" },
];

const PERIODS: { days: number; label: string }[] = [
  { days: 30, label: "30 dias" },
  { days: 60, label: "60 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
];

/* Filtros do mockup que ainda não têm dado no schema para ligar. Mesma convenção
   do Dashboard de Gestão (FILTER_SOON): aparecem apagados, não como select morto. */
const FILTER_SOON = ["Contrato", "Solução", "Adicional", "Status", "Consultor", "Modelo comercial"];

/* Indicadores do mockup sem suporte no schema. Não são exibidos com número —
   mesma "nota de honestidade" do Dashboard, para não induzir leitura errada. */
const NAO_MODELADO = [
  "Receita faturada",
  "Receita recebida",
  "Receita em atraso",
  "Novo MRR",
  "Expansão de MRR",
  "Redução de MRR",
  "Cancelamento de MRR",
  "Receita por adicional",
  "Diagnósticos concluídos",
  "Relatórios emitidos",
  "Dossiês emitidos",
];

const SELECT_STYLE: CSSProperties = {
  font: "inherit",
  fontSize: 12.5,
  padding: "5px 8px",
  borderRadius: 8,
  border: "1px solid var(--line, #E3DDD3)",
  background: "transparent",
  maxWidth: 190,
};

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

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** CSV com separador ";" e BOM — abre direto no Excel em pt-BR, sem passo de importação. */
function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      {hint && <span className="kpi__delta">{hint}</span>}
    </div>
  );
}

/** Relatórios Gerenciais CRIVO — leitura executiva agregada (mockup Lovable).
 *  Seis blocos: Visão Executiva, Comercial, Contratos e Receita, Clientes/Soluções/
 *  Adicionais, Entregas e Exportações. Dados REAIS (mesma fonte do Dashboard de
 *  Gestão + lista de contratos); filtros funcionais de período, grupo e empresa.
 *  Indicadores do mockup ainda sem dado no schema não recebem número: entram na
 *  lista "a modelar", igual à nota de honestidade do Dashboard. */
export function ManagementReportsSection() {
  const [tab, setTab] = useState<Tab>("executiva");
  const [days, setDays] = useState(30);
  const [groupId, setGroupId] = useState("");
  const [tenantId, setTenantId] = useState("");

  const [load, setLoad] = useState<Load>("loading");
  const [d, setD] = useState<DashboardData | null>(null);

  const [groups, setGroups] = useState<BusinessGroupSummary[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [contracts, setContracts] = useState<ContractListItem[] | null>(null);

  // Catálogos dos selects + lista de contratos (uma vez). A lista de contratos é
  // complementar: se falhar, os demais blocos continuam funcionando.
  useEffect(() => {
    listGroups().then(setGroups).catch(() => setGroups([]));
    listTenants().then(setTenants).catch(() => setTenants([]));
    listAllContracts().then(setContracts).catch(() => setContracts([]));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoad("loading");
    getDashboard(days, { groupId, tenantId })
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
  }, [days, groupId, tenantId]);

  // Recorte da lista de contratos igual ao do dashboard: empresa exata; grupo =
  // contrato do próprio grupo OU de qualquer empresa vinculada a ele.
  const contratos = useMemo(() => {
    if (!contracts) return [];
    if (tenantId) return contracts.filter((c) => c.tenantId === tenantId);
    if (groupId) {
      const ids = new Set(tenants.filter((t) => t.groupId === groupId).map((t) => t.id));
      return contracts.filter((c) => c.groupId === groupId || (c.tenantId !== null && ids.has(c.tenantId)));
    }
    return contracts;
  }, [contracts, tenants, groupId, tenantId]);

  const adicionaisLiberados = useMemo(
    () => contratos.reduce((acc, c) => acc + c.addonsCount, 0),
    [contratos],
  );

  const topClientes = useMemo(
    () => [...contratos].sort((a, b) => b.mrrCents - a.mrrCents).slice(0, 8),
    [contratos],
  );

  const periodoLabel = PERIODS.find((p) => p.days === days)?.label ?? `${days} dias`;
  const escopo = tenantId
    ? tenants.find((t) => t.id === tenantId)?.name ?? "empresa"
    : groupId
      ? groups.find((g) => g.id === groupId)?.name ?? "grupo"
      : "Todos os clientes";
  const hasFilters = !!(groupId || tenantId);

  // ── Exportações (CSV real, gerado do que está na tela) ──
  const cabecalho: (string | number)[][] = [
    ["Relatórios Gerenciais CRIVO"],
    ["Período", periodoLabel],
    ["Escopo", escopo],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    [],
  ];

  function exportExecutiva() {
    if (!d) return;
    downloadCsv("crivo-relatorio-executivo.csv", [
      ...cabecalho,
      ["Indicador", "Valor"],
      ["MRR", brl(d.contratos.mrrCents)],
      ["ARR", brl(d.contratos.arrCents)],
      ["Faturamento estimado no período", brl(d.comercial.faturamentoEstimadoCents)],
      ["Valor em pipeline", brl(d.comercial.valorPropostoCents)],
      ["Contratos ativos", d.contratos.ativos],
      ["Clientes ativos", d.executivo.clientesAtivos],
      ["Clientes bloqueados", d.executivo.clientesBloqueados],
      ["Novos clientes no período", d.executivo.novosClientes],
      ["Conversão (%)", d.comercial.conversao],
    ]);
  }

  function exportComercial() {
    if (!d) return;
    downloadCsv("crivo-relatorio-comercial.csv", [
      ...cabecalho,
      ["Indicador", "Valor"],
      ["Leads", d.comercial.leads],
      ["Leads no período anterior", d.comercial.leadsPrev],
      ["Propostas", d.comercial.propostas],
      ["Propostas enviadas", d.comercial.propostasEnviadas],
      ["Vendas fechadas", d.comercial.fechadas],
      ["Conversão (%)", d.comercial.conversao],
      ["Ticket médio", brl(d.comercial.ticketMedioCents)],
      ["Leads sem 1º contato", d.comercial.leadsSemPrimeiroContato],
      [],
      ["Etapa do funil", "Leads"],
      ...d.comercial.funnel.map((f) => [f.label, f.count] as (string | number)[]),
      [],
      ["Origem", "Leads"],
      ...d.comercial.porOrigem.map((o) => [platformLeadOriginLabel(o.origem), o.count] as (string | number)[]),
      [],
      ["Motivo de perda", "Leads"],
      ...d.comercial.motivosPerda.map((m) => [m.motivo, m.count] as (string | number)[]),
    ]);
  }

  function exportContratos() {
    if (!d) return;
    downloadCsv("crivo-relatorio-contratos.csv", [
      ...cabecalho,
      ["Indicador", "Valor"],
      ["MRR", brl(d.contratos.mrrCents)],
      ["ARR", brl(d.contratos.arrCents)],
      ["Contratos ativos", d.contratos.ativos],
      ["Contratos com adicionais", d.contratos.comAdicionais],
      ["Vencendo em 30 dias", d.contratos.vencendo30],
      ["Vencendo em 60 dias", d.contratos.vencendo60],
      ["Vencendo em 90 dias", d.contratos.vencendo90],
      [],
      ["Status", "Contratos"],
      ...d.contratos.porStatus.map(
        (s) => [CONTRACT_STATUS_LABEL[s.status as ContractStatus] ?? s.status, s.count] as (string | number)[],
      ),
      [],
      ["Contrato", "Cliente", "Solução", "Status", "MRR", "Adicionais", "Ciclos"],
      ...contratos.map(
        (c) =>
          [
            c.shortId,
            c.clientName,
            c.productName ?? "—",
            CONTRACT_STATUS_LABEL[c.status as ContractStatus] ?? c.status,
            brl(c.mrrCents),
            c.addonsCount,
            c.rounds,
          ] as (string | number)[],
      ),
    ]);
  }

  function exportSolucoes() {
    if (!d) return;
    downloadCsv("crivo-relatorio-solucoes.csv", [
      ...cabecalho,
      ["Solução", "Vendas", "Receita mensal"],
      ...d.comercial.porSolucao.map(
        (s) => [s.produto, s.count, brl(s.receitaMensalCents)] as (string | number)[],
      ),
    ]);
  }

  function exportEntregas() {
    if (!d) return;
    downloadCsv("crivo-relatorio-entregas.csv", [
      ...cabecalho,
      ["Indicador", "Valor"],
      ["Diagnósticos em andamento", d.entregas.diagnosticosAndamento],
      ["Avaliações", d.entregas.avaliacoes],
      ["Planos pendentes de validação", d.entregas.planosPendentes],
      ["Ações pendentes", d.entregas.acoesPendentes],
      ["Evidências registradas", d.entregas.evidencias],
      ["Mentorias agendadas", d.entregas.mentoriasAgendadas],
      ["Mentorias atrasadas", d.entregas.mentoriasAtrasadas],
      ["Clientes sem responsável", d.entregas.clientesSemResponsavel],
      ["Clientes sem avanço", d.entregas.clientesSemAvanco],
    ]);
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Relatórios Gerenciais CRIVO</h1>
          <p className="page-sub">
            Leitura executiva agregada por período, grupo e empresa — comercial, contratos e receita,
            soluções, adicionais e entregas. Exportação em CSV do que está na tela.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 14 }}>
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

          <select
            value={groupId}
            onChange={(e) => { setGroupId(e.target.value); setTenantId(""); }}
            style={SELECT_STYLE}
            title="Grupo empresarial"
          >
            <option value="">Grupo: todos</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={SELECT_STYLE} title="Empresa (CNPJ)">
            <option value="">Empresa: todas</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              className="btn btn--sm btn--outline-dark"
              onClick={() => { setGroupId(""); setTenantId(""); }}
            >
              Limpar
            </button>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
            {FILTER_SOON.map((f) => (
              <span key={f} className="pattern-tag" style={{ opacity: 0.45 }} title="Filtro em breve">{f}</span>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-sec)", margin: "8px 0 0" }}>
          Escopo atual: <strong>{escopo}</strong> · últimos {periodoLabel}. O bloco Comercial (funil de
          leads) responde ao período; Contratos, Clientes e Entregas respondem também a grupo e empresa.
        </p>
      </div>

      <div className="adm-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`adm-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {load === "loading" && <p className="dash-state">Carregando os relatórios…</p>}
      {load === "error" && <div className="dash-state dash-state--error">Não foi possível carregar os relatórios gerenciais.</div>}

      {load === "ok" && d && (
        <>
          {tab === "executiva" && (
            <>
              <div className="kpi-grid">
                <Kpi label="MRR (recorrência)" value={brl(d.contratos.mrrCents)} hint={`ARR ${brl(d.contratos.arrCents)} · estimado`} />
                <Kpi label="Faturamento estimado" value={brl(d.comercial.faturamentoEstimadoCents)} hint={`no período · ${periodoLabel}`} />
                <Kpi label="Valor em pipeline" value={brl(d.comercial.valorPropostoCents)} hint={`${d.comercial.propostasEnviadas} proposta(s) enviada(s)`} />
                <Kpi label="Ticket médio" value={brl(d.comercial.ticketMedioCents)} hint="por venda fechada" />
                <Kpi label="Contratos ativos" value={String(d.contratos.ativos)} hint={`${d.contratos.comAdicionais} com adicionais`} />
                <Kpi label="Clientes ativos" value={String(d.executivo.clientesAtivos)} hint={`${d.executivo.clientesBloqueados} bloqueado(s)`} />
                <Kpi label="Novos clientes" value={String(d.executivo.novosClientes)} hint={`últimos ${d.periodDays} dias`} />
                <Kpi label="Taxa de conversão" value={`${d.comercial.conversao}%`} hint="lead → venda" />
              </div>

              <div className="adm-callout">
                <strong>Receita contratada</strong> é o que está assinado (MRR/ARR dos contratos ativos).
                Receita <strong>faturada</strong> e <strong>recebida</strong> dependem do módulo financeiro
                e ainda não são apuradas — por isso não aparecem com número aqui. Valores únicos
                (implantação/setup) não somam ao MRR.
              </div>
            </>
          )}

          {tab === "comercial" && (
            <>
              <div className="kpi-grid">
                <Kpi label="Leads no período" value={String(d.comercial.leads)} hint={`período anterior: ${d.comercial.leadsPrev}`} />
                <Kpi label="Propostas" value={String(d.comercial.propostas)} hint={`${d.comercial.propostasEnviadas} enviada(s)`} />
                <Kpi label="Vendas fechadas" value={String(d.comercial.fechadas)} hint={`conversão ${d.comercial.conversao}%`} />
                <Kpi label="Ticket médio" value={brl(d.comercial.ticketMedioCents)} hint="por venda fechada" />
                <Kpi label="Sem 1º contato" value={String(d.comercial.leadsSemPrimeiroContato)} hint="leads aguardando retorno" />
              </div>

              <div style={SEC_HEAD}>Funil, origem e perdas</div>
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead><tr><th>Etapa do funil</th><th>Leads</th></tr></thead>
                  <tbody>
                    {d.comercial.funnel.map((f) => (
                      <tr key={f.key}><td><strong>{f.label}</strong></td><td>{f.count}</td></tr>
                    ))}
                    {d.comercial.funnel.length === 0 && (
                      <tr><td colSpan={2} style={{ textAlign: "center", padding: 20 }}>Sem leads no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="card" style={{ padding: 0, overflowX: "auto", marginTop: 14 }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead><tr><th>Origem</th><th>Leads</th></tr></thead>
                  <tbody>
                    {d.comercial.porOrigem.map((o) => (
                      <tr key={o.origem}><td><strong>{platformLeadOriginLabel(o.origem)}</strong></td><td>{o.count}</td></tr>
                    ))}
                    {d.comercial.porOrigem.length === 0 && (
                      <tr><td colSpan={2} style={{ textAlign: "center", padding: 20 }}>Sem origem registrada no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="card" style={{ padding: 0, overflowX: "auto", marginTop: 14 }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead><tr><th>Motivo de perda</th><th>Leads</th></tr></thead>
                  <tbody>
                    {d.comercial.motivosPerda.map((m) => (
                      <tr key={m.motivo}><td><strong>{m.motivo}</strong></td><td>{m.count}</td></tr>
                    ))}
                    {d.comercial.motivosPerda.length === 0 && (
                      <tr><td colSpan={2} style={{ textAlign: "center", padding: 20 }}>Nenhuma perda registrada no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "contratos" && (
            <>
              <div className="kpi-grid">
                <Kpi label="MRR (recorrência)" value={brl(d.contratos.mrrCents)} hint="contratos ativos" />
                <Kpi label="ARR" value={brl(d.contratos.arrCents)} hint="MRR × 12 · estimado" />
                <Kpi label="Contratos ativos" value={String(d.contratos.ativos)} hint={`${d.contratos.comAdicionais} com adicionais`} />
                <Kpi label="Vencendo em 30 dias" value={String(d.contratos.vencendo30)} hint={`60 dias: ${d.contratos.vencendo60} · 90 dias: ${d.contratos.vencendo90}`} />
              </div>

              <div style={SEC_HEAD}>Contratos por status</div>
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead><tr><th>Status</th><th>Contratos</th></tr></thead>
                  <tbody>
                    {d.contratos.porStatus.map((s) => (
                      <tr key={s.status}>
                        <td><strong>{CONTRACT_STATUS_LABEL[s.status as ContractStatus] ?? s.status}</strong></td>
                        <td>{s.count}</td>
                      </tr>
                    ))}
                    {d.contratos.porStatus.length === 0 && (
                      <tr><td colSpan={2} style={{ textAlign: "center", padding: 20 }}>Nenhum contrato cadastrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="adm-callout" style={{ marginTop: 14 }}>
                A movimentação de MRR (<strong>novo</strong>, <strong>expansão</strong>,
                <strong> redução</strong> e <strong>cancelamento</strong>) exige histórico de alterações
                do contrato, que ainda não é guardado. Aparece na lista de métricas a modelar.
              </div>
            </>
          )}

          {tab === "clientes" && (
            <>
              <div style={SEC_HEAD}>Vendas por solução</div>
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead><tr><th>Solução</th><th>Vendas</th><th>Receita mensal</th></tr></thead>
                  <tbody>
                    {d.comercial.porSolucao.map((s) => (
                      <tr key={s.produto}>
                        <td><strong>{s.produto}</strong></td>
                        <td>{s.count}</td>
                        <td>{brl(s.receitaMensalCents)}</td>
                      </tr>
                    ))}
                    {d.comercial.porSolucao.length === 0 && (
                      <tr><td colSpan={3} style={{ textAlign: "center", padding: 20 }}>Nenhuma venda por solução no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={SEC_HEAD}>Adicionais liberados</div>
              <div className="kpi-grid">
                <Kpi label="Contratos com adicionais" value={String(d.contratos.comAdicionais)} hint="pelo menos um adicional liberado" />
                <Kpi label="Adicionais liberados" value={String(adicionaisLiberados)} hint="somados em todos os contratos do escopo" />
              </div>

              <div style={SEC_HEAD}>Clientes por MRR</div>
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead><tr><th>Cliente</th><th>Contrato</th><th>Solução</th><th>MRR</th><th>Adicionais</th><th>Status</th></tr></thead>
                  <tbody>
                    {topClientes.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.clientName}</strong></td>
                        <td className="cell-mute">{c.shortId}</td>
                        <td className="cell-mute">{c.productName ?? "—"}</td>
                        <td>{brl(c.mrrCents)}</td>
                        <td>{c.addonsCount}</td>
                        <td>{CONTRACT_STATUS_LABEL[c.status as ContractStatus] ?? c.status}</td>
                      </tr>
                    ))}
                    {topClientes.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: 20 }}>Nenhum contrato no escopo selecionado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "entregas" && (
            <div className="kpi-grid">
              <Kpi label="Diagnósticos em andamento" value={String(d.entregas.diagnosticosAndamento)} hint="ciclos abertos" />
              <Kpi label="Avaliações" value={String(d.entregas.avaliacoes)} hint="respostas registradas" />
              <Kpi label="Planos pendentes" value={String(d.entregas.planosPendentes)} hint="minutas não validadas" />
              <Kpi label="Ações pendentes" value={String(d.entregas.acoesPendentes)} hint="ainda não concluídas" />
              <Kpi label="Evidências" value={String(d.entregas.evidencias)} hint="registradas na plataforma" />
              <Kpi label="Mentorias agendadas" value={String(d.entregas.mentoriasAgendadas)} hint={`${d.entregas.mentoriasAtrasadas} atrasada(s)`} />
              <Kpi label="Clientes sem responsável" value={String(d.entregas.clientesSemResponsavel)} hint="sem consultor vinculado" />
              <Kpi label="Clientes sem avanço" value={String(d.entregas.clientesSemAvanco)} hint="ativos sem diagnóstico iniciado" />
            </div>
          )}

          {tab === "exportacoes" && (
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Exportações</h3>
                  <span className="card__sub">
                    Cada arquivo sai com o período e o escopo aplicados no filtro acima. CSV com
                    separador &quot;;&quot; — abre direto no Excel em português.
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                <button className="btn btn--sm btn--outline-dark" onClick={exportExecutiva}>CSV · Visão Executiva</button>
                <button className="btn btn--sm btn--outline-dark" onClick={exportComercial}>CSV · Comercial</button>
                <button className="btn btn--sm btn--outline-dark" onClick={exportContratos}>CSV · Contratos e Receita</button>
                <button className="btn btn--sm btn--outline-dark" onClick={exportSolucoes}>CSV · Soluções</button>
                <button className="btn btn--sm btn--outline-dark" onClick={exportEntregas}>CSV · Entregas</button>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-sec)", margin: "12px 0 0" }}>
                Dossiê em PDF por cliente continua no <strong>Motor de Relatórios e Dossiês</strong>, que é
                onde os modelos de documento são administrados — não foi duplicado aqui.
              </p>
            </div>
          )}

          {/* Nota de honestidade — mesma do Dashboard de Gestão. */}
          <div className="card" style={{ marginTop: 16, background: "#FBF9F5", borderLeft: "3px solid #A8693D" }}>
            <div className="card__head">
              <div>
                <h3>Métricas a modelar</h3>
                <span className="card__sub">
                  Indicadores do mockup ainda sem dado no sistema — não exibidos com número para não
                  induzir a leitura. Precisam de nova modelagem/decisão.
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {NAO_MODELADO.map((m) => (
                <span key={m} className="pattern-tag pattern-tag--alert">{m}</span>
              ))}
              {d.naoModelado.map((m) => (
                <span key={m} className="pattern-tag pattern-tag--alert">{m}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
