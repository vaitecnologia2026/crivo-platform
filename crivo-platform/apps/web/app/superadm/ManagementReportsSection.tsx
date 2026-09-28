"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CONTRACT_MODELS,
  CONTRACT_MODEL_LABEL,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
  platformLeadOriginLabel,
  type BusinessGroupSummary,
  type ContractModel,
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

/** "ano" = do dia 1º de janeiro até hoje (a API aceita até 365 dias). */
const PERIODS: { key: string; label: string }[] = [
  { key: "30", label: "30 dias" },
  { key: "60", label: "60 dias" },
  { key: "90", label: "90 dias" },
  { key: "365", label: "12 meses" },
  { key: "ano", label: "Ano vigente" },
];

function diasDoPeriodo(key: string): number {
  if (key !== "ano") return Number(key);
  const hoje = new Date();
  const jan1 = new Date(hoje.getFullYear(), 0, 1);
  return Math.min(365, Math.max(1, Math.ceil((hoje.getTime() - jan1.getTime()) / 86_400_000)));
}

const SEM_FINANCEIRO = "aguarda módulo financeiro";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** CSV com separador ";" e BOM — abre direto no Excel em pt-BR, sem passo de importação. */
export function downloadCsv(fileName: string, rows: (string | number)[][]) {
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

/** KPI do protótipo: faixa no topo, número serifado; "a definir" = sem dado no sistema. */
function Kpi({ label, value, hint, aModelar, tone }: { label: string; value: string; hint?: string; aModelar?: boolean; tone?: "alert" }) {
  return (
    <div className={`gd-kpi gd-kpi--mini${aModelar ? " gd-kpi--amodelar" : ""}${tone === "alert" ? " gd-kpi--alert" : ""}`}>
      <span className="gd-kpi__label">
        {label}
        {aModelar && <span className="gd-kpi__tag">a definir</span>}
      </span>
      <strong className="gd-kpi__value">{value}</strong>
      {hint && <span className="gd-kpi__hint">{hint}</span>}
    </div>
  );
}

function Filtro({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="rg-filter">
      <span className="ge-field__label">{label}</span>
      <select className="gd-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

type Linha = [string, string | number];

/** Relatórios Gerenciais CRIVO (protótipo Lovable /relatorios-gerenciais) —
 *  leitura executiva agregada pelos filtros. Dados reais: indicadores do
 *  Dashboard de Gestão (período, grupo, empresa, consultor) + lista de contratos
 *  (recortada também por contrato, solução, adicional, status e modelo).
 *  Receita faturada/recebida/em atraso e movimentação de MRR ficam "a definir". */
export function ManagementReportsSection({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const [tab, setTab] = useState<Tab>("executiva");
  const [periodo, setPeriodo] = useState("30");
  const [groupId, setGroupId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [solucao, setSolucao] = useState("");
  const [adicional, setAdicional] = useState("");
  const [status, setStatus] = useState("");
  const [consultor, setConsultor] = useState("");
  const [modelo, setModelo] = useState("");

  const [load, setLoad] = useState<Load>("loading");
  const [d, setD] = useState<DashboardData | null>(null);
  const [groups, setGroups] = useState<BusinessGroupSummary[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [contracts, setContracts] = useState<ContractListItem[] | null>(null);

  const days = diasDoPeriodo(periodo);

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
    getDashboard(days, { groupId, tenantId, consultor })
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
  }, [days, groupId, tenantId, consultor]);

  // Recorte da lista de contratos: empresa exata; grupo = contrato do próprio
  // grupo OU de qualquer empresa vinculada a ele; + filtros do contrato.
  const contratos = useMemo(() => {
    let xs = contracts ?? [];
    if (tenantId) xs = xs.filter((c) => c.tenantId === tenantId);
    else if (groupId) {
      const ids = new Set(tenants.filter((t) => t.groupId === groupId).map((t) => t.id));
      xs = xs.filter((c) => c.groupId === groupId || (c.tenantId !== null && ids.has(c.tenantId)));
    }
    if (contratoId) xs = xs.filter((c) => c.id === contratoId);
    if (solucao) xs = xs.filter((c) => c.productName === solucao);
    if (adicional) xs = xs.filter((c) => (c.addons ?? []).some((a) => a.code === adicional));
    if (status) xs = xs.filter((c) => c.status === status);
    if (consultor) xs = xs.filter((c) => c.responsible === consultor);
    if (modelo) xs = xs.filter((c) => c.model === modelo);
    return xs;
  }, [contracts, tenants, groupId, tenantId, contratoId, solucao, adicional, status, consultor, modelo]);

  // Opções dos selects vindas dos próprios contratos.
  const opcoes = useMemo(() => {
    const xs = contracts ?? [];
    const addons = new Map<string, string>();
    for (const c of xs) for (const a of c.addons ?? []) addons.set(a.code, a.label);
    const consultores = new Set<string>([...(d?.consultores ?? []), ...xs.map((c) => c.responsible ?? "").filter(Boolean)]);
    return {
      solucoes: [...new Set(xs.map((c) => c.productName).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, "pt-BR")),
      adicionais: [...addons.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
      consultores: [...consultores].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }, [contracts, d]);

  const tenantOpts = groupId ? tenants.filter((t) => t.groupId === groupId) : tenants;
  const contratoOpts = (contracts ?? []).filter((c) => !tenantId || c.tenantId === tenantId);

  // ── Números calculados sobre os contratos recortados ──
  const agora = Date.now();
  const desde = agora - days * 86_400_000;
  const ativos = contratos.filter((c) => c.status === "ATIVO");
  const mrr = ativos.reduce((s, c) => s + c.mrrCents, 0);
  const novoMrr = ativos
    .filter((c) => c.startDate && new Date(c.startDate).getTime() >= desde)
    .reduce((s, c) => s + c.mrrCents, 0);
  const aVencer = ativos.filter(
    (c) => c.endDate && new Date(c.endDate).getTime() >= agora && new Date(c.endDate).getTime() <= agora + 60 * 86_400_000,
  ).length;
  const bloqueados = contratos.filter((c) => c.status === "SUSPENSO").length;
  const clientesAtivos = new Set(ativos.map((c) => c.groupId ?? c.tenantId)).size;

  const porSolucao = useMemo(() => {
    const m = new Map<string, { qtd: number; mensal: number }>();
    for (const c of contratos) {
      if (c.status === "RASCUNHO") continue;
      const k = c.productName ?? "(sem solução)";
      const v = m.get(k) ?? { qtd: 0, mensal: 0 };
      v.qtd += 1;
      v.mensal += c.productMonthlyCents ?? 0;
      m.set(k, v);
    }
    return [...m.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.qtd - a.qtd);
  }, [contratos]);
  const porAdicional = useMemo(() => {
    const m = new Map<string, { nome: string; qtd: number; mensal: number; unico: number }>();
    for (const c of contratos) {
      if (c.status === "RASCUNHO") continue;
      for (const a of c.addons ?? []) {
        const v = m.get(a.code) ?? { nome: a.label, qtd: 0, mensal: 0, unico: 0 };
        v.qtd += 1;
        v.mensal += a.monthlyPriceCents;
        v.unico += a.monthlyPriceCents ? 0 : a.setupPriceCents;
        m.set(a.code, v);
      }
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd);
  }, [contratos]);
  const receitaAdicional = (a: { mensal: number; unico: number }) =>
    a.mensal ? `${brl(a.mensal)}/mês` : a.unico ? `${brl(a.unico)} (único)` : "—";

  const periodoLabel = PERIODS.find((p) => p.key === periodo)?.label ?? `${days} dias`;
  const escopo = tenantId
    ? tenants.find((t) => t.id === tenantId)?.name ?? "empresa"
    : groupId
      ? `Grupo ${groups.find((g) => g.id === groupId)?.name ?? ""}`
      : "Todos os clientes";

  // ── Blocos exportáveis (CSV da aba e PDF consolidado usam os mesmos dados) ──
  function blocos(dd: DashboardData): Record<Exclude<Tab, "exportacoes">, { titulo: string; linhas: Linha[] }> {
    return {
      executiva: {
        titulo: "Visão Executiva",
        linhas: [
          ["Receita contratada no período (estimada)", brl(dd.financeiro.receitaContratadaCents)],
          ["Receita faturada", "a definir"],
          ["Receita recebida", "a definir"],
          ["Em atraso", "a definir"],
          ["MRR", brl(mrr)],
          ["ARR", brl(mrr * 12)],
          ["Contratos ativos", ativos.length],
          ["Clientes ativos (com contrato ativo)", clientesAtivos],
        ],
      },
      comercial: {
        titulo: "Comercial",
        linhas: [
          ["Leads", dd.comercial.leads],
          ["Propostas enviadas", dd.comercial.propostasEnviadas],
          ["Vendas", dd.comercial.fechadas],
          ["Conversão (%)", dd.comercial.conversao],
          ["Ticket médio", brl(dd.comercial.ticketMedioCents)],
          ...dd.comercial.motivosPerda.map((m) => [`Motivo de perda · ${m.motivo}`, m.count] as Linha),
          ...dd.comercial.porOrigem.map((o) => [`Origem · ${platformLeadOriginLabel(o.origem)}`, o.count] as Linha),
        ],
      },
      contratos: {
        titulo: "Contratos e Receita",
        linhas: [
          ["MRR", brl(mrr)],
          ["ARR", brl(mrr * 12)],
          ["Novo MRR no período", brl(novoMrr)],
          ["Expansão", "a definir"],
          ["Redução", "a definir"],
          ["Cancelamento", "a definir"],
          ["Contratos a vencer (60 dias)", aVencer],
          ["Em renovação (CRM)", dd.financeiro.emRenovacao],
          ["Bloqueados (suspensos)", bloqueados],
        ],
      },
      clientes: {
        titulo: "Clientes, Soluções e Adicionais",
        linhas: [
          ...porSolucao.map((s) => [`Solução · ${s.nome} (${s.qtd})`, s.mensal ? `${brl(s.mensal)}/mês` : "—"] as Linha),
          ...porAdicional.map((a) => [`Adicional · ${a.nome} (${a.qtd})`, receitaAdicional(a)] as Linha),
        ],
      },
      entregas: {
        titulo: "Entregas",
        linhas: [
          ["Diagnósticos em andamento", dd.entregas.diagnosticosAndamento],
          ["Diagnósticos concluídos no período", dd.entregas.diagnosticosConcluidos],
          ["Ciclos de ICD em andamento", dd.entregas.ciclosIcdAbertos],
          ["Relatórios emitidos no período", dd.entregas.relatoriosEmitidos],
          ["Dossiês emitidos no período", dd.entregas.dossiesEmitidos],
          ["Itens mais contratados", porAdicional.slice(0, 3).map((a) => a.nome).join(", ") || "—"],
        ],
      },
    };
  }

  const cabecalho = (): (string | number)[][] => [
    ["Relatórios Gerenciais CRIVO"],
    ["Período", periodoLabel],
    ["Escopo", escopo],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    [],
  ];

  function csv(chave: Exclude<Tab, "exportacoes">) {
    if (!d) return;
    const b = blocos(d)[chave];
    downloadCsv(`crivo-relatorio-${chave}.csv`, [...cabecalho(), [b.titulo, "Valor"], ...b.linhas]);
  }

  async function pdf() {
    if (!d) return;
    const { exportPDF } = await import("@/lib/exports");
    const b = blocos(d);
    await exportPDF(
      "relatorios-gerenciais",
      "Relatórios Gerenciais CRIVO",
      (Object.keys(b) as (keyof typeof b)[]).map((k) => ({
        heading: b[k].titulo,
        rows: b[k].linhas.map(([indicador, valor]) => ({ Indicador: indicador, Valor: valor })),
      })),
      { company: `${escopo} · ${periodoLabel}`, source: "CRIVO · Super Admin" },
    );
  }

  function limpar() {
    setGroupId(""); setTenantId(""); setContratoId(""); setSolucao(""); setAdicional("");
    setStatus(""); setConsultor(""); setModelo("");
  }
  const temFiltro = !!(groupId || tenantId || contratoId || solucao || adicional || status || consultor || modelo);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Relatórios Gerenciais CRIVO</h1>
          <p className="page-sub">Leitura executiva agregada por qualquer combinação dos filtros. Exportação do que está na tela.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn--outline-dark btn--sm"
            disabled={!d}
            onClick={() => csv(tab === "exportacoes" ? "executiva" : tab)}
            title="CSV da aba aberta"
          >
            Exportar CSV
          </button>
          <button type="button" className="btn btn--gold btn--sm" disabled={!d} onClick={() => void pdf()} title="PDF com todas as abas">
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="gd-panel">
        <div className="rg-filters__head">
          <span className="gd-panel__title">Filtros</span>
          {temFiltro && <button type="button" className="gd-chip" onClick={limpar}>Limpar filtros</button>}
        </div>
        <div className="rg-filters">
          <Filtro label="Período" value={periodo} onChange={setPeriodo}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </Filtro>
          <Filtro label="Grupo" value={groupId} onChange={(v) => { setGroupId(v); setTenantId(""); setContratoId(""); }}>
            <option value="">Todos</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Filtro>
          <Filtro label="Empresa" value={tenantId} onChange={(v) => { setTenantId(v); setContratoId(""); }}>
            <option value="">Todas</option>
            {tenantOpts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Filtro>
          <Filtro label="Contrato" value={contratoId} onChange={setContratoId}>
            <option value="">Todos</option>
            {contratoOpts.map((c) => <option key={c.id} value={c.id}>{c.shortId} · {c.clientName}</option>)}
          </Filtro>
          <Filtro label="Solução" value={solucao} onChange={setSolucao}>
            <option value="">Todas</option>
            {opcoes.solucoes.map((s) => <option key={s} value={s}>{s}</option>)}
          </Filtro>
          <Filtro label="Adicional" value={adicional} onChange={setAdicional}>
            <option value="">Todos</option>
            {opcoes.adicionais.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Filtro>
          <Filtro label="Status" value={status} onChange={setStatus}>
            <option value="">Todos</option>
            {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>)}
          </Filtro>
          <Filtro label="Consultor" value={consultor} onChange={setConsultor}>
            <option value="">Todos</option>
            {opcoes.consultores.map((c) => <option key={c} value={c}>{c}</option>)}
          </Filtro>
          <Filtro label="Modelo comercial" value={modelo} onChange={setModelo}>
            <option value="">Todos</option>
            {CONTRACT_MODELS.map((m) => <option key={m} value={m}>{CONTRACT_MODEL_LABEL[m as ContractModel]}</option>)}
          </Filtro>
        </div>
        <p className="ge-note" style={{ marginTop: 10 }}>
          Escopo: <strong>{escopo}</strong> · {periodoLabel}. Comercial e Entregas respondem a período, grupo, empresa e
          consultor; Contratos, Receita, Soluções e Adicionais respondem a todos os filtros.
        </p>
      </div>

      <div className="rg-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`rg-tab${tab === t.key ? " is-active" : ""}`}
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
            <div className="rg-grid4">
              <Kpi label="Receita contratada" value={brl(d.financeiro.receitaContratadaCents)} hint="no período · estimada" />
              <Kpi label="Receita faturada" value="—" aModelar hint={SEM_FINANCEIRO} />
              <Kpi label="Receita recebida" value="—" aModelar hint={SEM_FINANCEIRO} />
              <Kpi label="Em atraso" value="—" aModelar tone="alert" hint={SEM_FINANCEIRO} />
              <Kpi label="MRR" value={brl(mrr)} hint="contratos ativos" />
              <Kpi label="ARR" value={brl(mrr * 12)} hint="MRR × 12 · estimado" />
              <Kpi label="Contratos ativos" value={String(ativos.length)} />
              <Kpi label="Clientes ativos" value={String(clientesAtivos)} hint="com contrato ativo" />
            </div>
          )}

          {tab === "comercial" && (
            <>
              <div className="rg-grid4">
                <Kpi label="Leads" value={String(d.comercial.leads)} hint={`período anterior: ${d.comercial.leadsPrev}`} />
                <Kpi label="Propostas" value={String(d.comercial.propostasEnviadas)} hint="enviadas no período" />
                <Kpi label="Vendas" value={String(d.comercial.fechadas)} hint="leads convertidos" />
                <Kpi label="Conversão" value={`${d.comercial.conversao}%`} hint="lead → venda" />
                <Kpi label="Ticket médio" value={brl(d.comercial.ticketMedioCents)} hint="por venda · estimado" />
              </div>
              <div className="ge-2col" style={{ marginTop: 16 }}>
                <div className="gd-panel">
                  <div className="gd-panel__title">Motivos de perda</div>
                  <ul className="gd-list">
                    {d.comercial.motivosPerda.map((m) => (
                      <li key={m.motivo}><span>{m.motivo}</span><span className="cell-mute">{m.count}</span></li>
                    ))}
                    {d.comercial.motivosPerda.length === 0 && <li className="cell-mute">Nenhuma perda registrada no período.</li>}
                  </ul>
                </div>
                <div className="gd-panel">
                  <div className="gd-panel__title">Leads por origem</div>
                  <ul className="gd-list">
                    {d.comercial.porOrigem.map((o) => (
                      <li key={o.origem}><span>{platformLeadOriginLabel(o.origem)}</span><span className="cell-mute">{o.count}</span></li>
                    ))}
                    {d.comercial.porOrigem.length === 0 && <li className="cell-mute">Sem leads no período.</li>}
                  </ul>
                </div>
              </div>
            </>
          )}

          {tab === "contratos" && (
            <>
              <div className="rg-grid4">
                <Kpi label="MRR" value={brl(mrr)} hint="contratos ativos" />
                <Kpi label="ARR" value={brl(mrr * 12)} hint="MRR × 12" />
                <Kpi label="Novo MRR" value={brl(novoMrr)} hint="contratos iniciados no período" />
                <Kpi label="Expansão" value="—" aModelar hint="aguarda histórico de aditivos" />
                <Kpi label="Redução" value="—" aModelar hint="aguarda histórico de aditivos" />
                <Kpi label="Cancelamento" value="—" aModelar hint="aguarda histórico de aditivos" />
                <Kpi label="Contratos a vencer" value={String(aVencer)} hint="próximos 60 dias" />
                <Kpi label="Em renovação" value={String(d.financeiro.emRenovacao)} hint="renovações em negociação no CRM" />
                <Kpi label="Bloqueados" value={String(bloqueados)} hint="contratos suspensos" />
              </div>
              <p className="ge-note" style={{ marginTop: 12 }}>
                Receita contratada, faturada e recebida são diferenciadas. Valores únicos (implantação/setup) não somam ao MRR.
              </p>
            </>
          )}

          {tab === "clientes" && (
            <div className="ge-2col" style={{ marginTop: 0 }}>
              <div className="gd-panel">
                <div className="gd-panel__title">Vendas por solução</div>
                <div className="ge-subtable">
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead><tr><th>Solução</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Receita</th></tr></thead>
                    <tbody>
                      {porSolucao.map((s) => (
                        <tr key={s.nome}>
                          <td>{s.nome}</td>
                          <td style={{ textAlign: "right" }}>{s.qtd}</td>
                          <td style={{ textAlign: "right" }}>{s.mensal ? `${brl(s.mensal)}/mês` : "—"}</td>
                        </tr>
                      ))}
                      {porSolucao.length === 0 && (
                        <tr><td colSpan={3} className="cell-mute" style={{ textAlign: "center", padding: 18 }}>Nenhum contrato vendido neste recorte.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="gd-panel">
                <div className="gd-panel__title">Vendas por adicional</div>
                <div className="ge-subtable">
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead><tr><th>Adicional</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Receita</th></tr></thead>
                    <tbody>
                      {porAdicional.map((a) => (
                        <tr key={a.nome}>
                          <td>{a.nome}</td>
                          <td style={{ textAlign: "right" }}>{a.qtd}</td>
                          <td style={{ textAlign: "right" }}>{receitaAdicional(a)}</td>
                        </tr>
                      ))}
                      {porAdicional.length === 0 && (
                        <tr><td colSpan={3} className="cell-mute" style={{ textAlign: "center", padding: 18 }}>Nenhum adicional vendido neste recorte.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "entregas" && (
            <div className="rg-grid4">
              <Kpi label="Diagnósticos em andamento" value={String(d.entregas.diagnosticosAndamento)} hint="ciclos abertos" />
              <Kpi label="Diagnósticos concluídos" value={String(d.entregas.diagnosticosConcluidos)} hint="fechados no período" />
              <Kpi label="Ciclos em andamento" value={String(d.entregas.ciclosIcdAbertos)} hint="ciclos trimestrais de ICD" />
              <Kpi label="Relatórios emitidos" value={String(d.entregas.relatoriosEmitidos)} hint="emissões oficiais no período" />
              <Kpi label="Dossiês" value={String(d.entregas.dossiesEmitidos)} hint="emitidos no período" />
              <div className="gd-panel rg-span3">
                <div className="gd-panel__title">Itens mais contratados</div>
                <div className="rg-chips">
                  {porAdicional.slice(0, 3).map((a) => <span key={a.nome} className="rg-chip">{a.nome}</span>)}
                  {porAdicional.length === 0 && <span className="cell-mute">Nenhum adicional contratado neste recorte.</span>}
                </div>
              </div>
            </div>
          )}

          {tab === "exportacoes" && (
            <div className="gd-panel">
              <p className="ge-note" style={{ marginTop: 0 }}>
                Cada arquivo sai com o período e o escopo dos filtros acima. CSV com separador &quot;;&quot; — abre direto no
                Excel em português. O PDF consolida todas as abas.
              </p>
              <div className="rg-exports">
                <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => csv("executiva")}>CSV · Visão Executiva</button>
                <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => csv("comercial")}>CSV · Comercial</button>
                <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => csv("contratos")}>CSV · Contratos e Receita</button>
                <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => csv("clientes")}>CSV · Soluções e Adicionais</button>
                <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => csv("entregas")}>CSV · Entregas</button>
                <button type="button" className="btn btn--outline-dark btn--sm" onClick={() => void pdf()}>PDF · Relatório consolidado</button>
                {onNavigate && (
                  <button type="button" className="gd-chip" onClick={() => onNavigate("overview")}>Voltar ao Dashboard</button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="gd-rulebox">
        <div className="gd-rulebox__title">Regras desta tela</div>
        Diferencia claramente <b>receita contratada</b>, <b>faturada</b> e <b>recebida</b>. Valores únicos não somam ao MRR.
        Este é o destino dos cliques financeiros do Dashboard. Indicadores marcados como <b>a definir</b> aguardam o módulo
        financeiro ou o histórico de aditivos — não exibem número falso.
      </div>
    </>
  );
}
