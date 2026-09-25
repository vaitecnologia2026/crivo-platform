"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  PLATFORM_LEAD_STAGES,
  PLATFORM_LEAD_STAGE_LABEL,
  platformLeadOriginLabel,
  type BusinessGroupSummary,
  type DashboardData,
  type TenantSummary,
} from "@crivo/types";
import { getAuditLog, getDashboard, listGroups, listTenants, type AuditEntry } from "@/lib/admin-api";
import { CnpjLookupCard } from "./CnpjLookupCard";

type Load = "loading" | "error" | "ok";

const PERIODS: { days: number; label: string }[] = [
  { days: 30, label: "30 dias" },
  { days: 60, label: "60 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
];

const SHORTCUTS: { section: string; label: string }[] = [
  { section: "empresas", label: "Empresas-cliente" },
  { section: "crm", label: "CRM — Funil" },
  { section: "contratos", label: "Contratos" },
  { section: "produtos", label: "Soluções" },
  { section: "inteligencia", label: "Inteligência CRIVO" },
];

/** Hint dos indicadores que o sistema ainda não apura (sem número falso). */
const SEM_FINANCEIRO = "aguarda módulo financeiro";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Minutos → "1h 42min" / "35 min" / "3 dias". null = sem dado. */
function fmtDuration(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
  }
  return `${Math.round(min / 1440)} dias`;
}

const dataLocal = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
/** Prazo de ação é data sem hora (gravada em UTC). */
const dataUtc = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });

// ── Blocos visuais (protótipo Lovable · /dashboard) ──

function Kpi({
  label, value, hint, aModelar, tone, onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  aModelar?: boolean;
  tone?: "alert";
  onClick?: () => void;
}) {
  const cls = `gd-kpi${aModelar ? " gd-kpi--amodelar" : ""}${tone === "alert" ? " gd-kpi--alert" : ""}`;
  const body = (
    <>
      <span className="gd-kpi__label">
        {label}
        {aModelar && <span className="gd-kpi__tag">a definir</span>}
      </span>
      <strong className="gd-kpi__value">{value}</strong>
      {hint && <span className="gd-kpi__hint">{hint}</span>}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title="Abrir detalhamento">{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="gd-block">
      <div className="gd-block__title">{title}</div>
      <div className="gd-grid">{children}</div>
    </div>
  );
}

type DrillColumn = { key: string; label: string };
type Drill = {
  title: string;
  subtitle: string;
  chips: string[];
  columns: DrillColumn[];
  rows: Record<string, string>[];
  exportName: string;
};

async function exportarXlsx(nome: string, columns: DrillColumn[], rows: Record<string, string>[]) {
  const XLSX = await import("xlsx");
  const dados = rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, r[c.key] || "—"])));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Detalhamento");
  XLSX.writeFile(wb, `${nome}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Painel lateral de detalhamento (DrillDrawer do protótipo): herda o recorte
 *  do ponto clicado (chips) e lista os registros que compõem o valor. */
function DrillDrawer({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="gd-drawer-backdrop" onClick={onClose}>
      <aside className="gd-drawer" role="dialog" aria-modal="true" aria-label={drill.title} onClick={(e) => e.stopPropagation()}>
        <div className="gd-drawer__head">
          <div>
            <h3 className="gd-drawer__title">{drill.title}</h3>
            <p className="gd-drawer__sub">{drill.subtitle}</p>
          </div>
          <button type="button" className="gd-drawer__close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="gd-drawer__chips">
          {drill.chips.map((c) => <span key={c} className="gd-drawer__chip">{c}</span>)}
        </div>

        <div className="gd-drawer__bar">
          <span>{drill.rows.length} registro{drill.rows.length === 1 ? "" : "s"}</span>
          <button
            type="button"
            className="btn btn--sm btn--outline-dark"
            disabled={drill.rows.length === 0}
            onClick={() => void exportarXlsx(drill.exportName, drill.columns, drill.rows)}
          >
            ↓ Exportar XLSX
          </button>
        </div>

        <div className="gd-drawer__table">
          <table className="data-table" style={{ margin: 0 }}>
            <thead><tr>{drill.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {drill.rows.map((r, i) => (
                <tr key={i}>{drill.columns.map((c) => <td key={c.key}>{r[c.key] || "—"}</td>)}</tr>
              ))}
              {drill.rows.length === 0 && (
                <tr><td colSpan={drill.columns.length} className="cell-mute" style={{ textAlign: "center", padding: 24 }}>Sem registros para este recorte.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="gd-drawer__foot">
          Registros que compõem o valor exibido (até 200 por lista). A exportação traz exatamente o que está na tabela.
        </p>
      </aside>
    </div>
  );
}

/** Dashboard de Gestão CRIVO (Caderno Tela 01 · protótipo Lovable /dashboard) —
 *  central operacional. Dados reais; indicadores que o sistema ainda não apura
 *  aparecem como "a definir", sem número. KPIs destacados abrem o detalhamento. */
export function DashboardSection({
  onNavigate,
  auditLabel = (a) => a,
}: {
  onNavigate: (section: string) => void;
  auditLabel?: (action: string) => string;
}) {
  const [days, setDays] = useState(30);
  const [origem, setOrigem] = useState("");
  const [groupId, setGroupId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [consultor, setConsultor] = useState("");
  const [status, setStatus] = useState("");
  const [load, setLoad] = useState<Load>("loading");
  const [d, setD] = useState<DashboardData | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);

  const [groups, setGroups] = useState<BusinessGroupSummary[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [origemOpts, setOrigemOpts] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);

  // Catálogos dos selects + últimas ações auditadas (uma vez).
  useEffect(() => {
    listGroups().then(setGroups).catch(() => setGroups([]));
    listTenants().then(setTenants).catch(() => setTenants([]));
    getAuditLog({ limit: 6 }).then(setAudit).catch(() => setAudit([]));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoad("loading");
    getDashboard(days, { origem, groupId, tenantId, consultor, status })
      .then((res) => {
        if (!alive) return;
        setD(res);
        // Guarda a lista completa de origens quando não há recorte de origem.
        if (!origem) setOrigemOpts(res.comercial.porOrigem.map((o) => o.origem));
        setLoad("ok");
      })
      .catch(() => {
        if (alive) setLoad("error");
      });
    return () => {
      alive = false;
    };
  }, [days, origem, groupId, tenantId, consultor, status]);

  const hasFilters = !!(origem || groupId || tenantId || consultor || status);
  const periodoLabel = PERIODS.find((p) => p.days === days)?.label ?? `${days} dias`;
  const grupoNome = groups.find((g) => g.id === groupId)?.name;
  const empresaNome = tenants.find((t) => t.id === tenantId)?.name;
  const recorte = empresaNome ?? (grupoNome ? `Grupo ${grupoNome}` : "Todas as empresas");
  const tenantOpts = groupId ? tenants.filter((t) => t.groupId === groupId) : tenants;
  const statusLabel = (PLATFORM_LEAD_STAGES as readonly string[]).includes(status)
    ? PLATFORM_LEAD_STAGE_LABEL[status as (typeof PLATFORM_LEAD_STAGES)[number]]
    : "todos";

  const chips = [
    `Período · ${periodoLabel}`,
    `Origem · ${origem ? platformLeadOriginLabel(origem) : "todas"}`,
    `Grupo · ${grupoNome ?? "todos"}`,
    `Empresa · ${empresaNome ?? "todas"}`,
    `Consultor · ${consultor || "todos"}`,
  ];

  function abrirLeads(filtro: "todos" | "atendidos" | "sem-contato") {
    if (!d) return;
    const base = d.detalhe.leads.filter((l) =>
      filtro === "atendidos" ? l.atendido : filtro === "sem-contato" ? !l.atendido : true,
    );
    const titulo = filtro === "atendidos" ? "Leads atendidos" : filtro === "sem-contato" ? "Leads sem 1º contato" : "Leads no período";
    setDrill({
      title: titulo,
      subtitle: "Registros comerciais que compõem o valor exibido.",
      chips: [...chips, `Status · ${statusLabel}`],
      columns: [
        { key: "empresa", label: "Empresa" },
        { key: "origem", label: "Origem" },
        { key: "responsavel", label: "Responsável" },
        { key: "status", label: "Status" },
        { key: "data", label: "Entrada" },
      ],
      rows: base.map((l) => ({
        empresa: l.empresa,
        origem: l.origem ? platformLeadOriginLabel(l.origem) : "",
        responsavel: l.responsavel ?? "",
        status: l.etapa,
        data: dataLocal(l.criadoEm),
      })),
      exportName: `dashboard-${filtro === "todos" ? "leads" : `leads-${filtro}`}-detalhamento`,
    });
  }

  function abrirContratacoes() {
    if (!d) return;
    setDrill({
      title: "Contratações confirmadas",
      subtitle: "Leads convertidos em cliente no período selecionado.",
      chips: [...chips, "Status · Confirmada"],
      columns: [
        { key: "empresa", label: "Empresa" },
        { key: "solucao", label: "Solução" },
        { key: "valor", label: "Valor mensal (est.)" },
        { key: "consultor", label: "Consultor" },
        { key: "data", label: "Data" },
      ],
      rows: d.detalhe.contratacoes.map((c) => ({
        empresa: c.empresa,
        solucao: c.solucao ?? "",
        valor: brl(c.valorMensalCents),
        consultor: c.consultor ?? "",
        data: dataLocal(c.data),
      })),
      exportName: "dashboard-contratacoes-detalhamento",
    });
  }

  function abrirAcoesAtrasadas() {
    if (!d) return;
    setDrill({
      title: "Ações atrasadas",
      subtitle: "Ações do Plano de Ação aprovadas ou em andamento com prazo vencido.",
      chips: [`Grupo · ${grupoNome ?? "todos"}`, `Empresa · ${empresaNome ?? "todas"}`],
      columns: [
        { key: "acao", label: "Ação" },
        { key: "empresa", label: "Empresa" },
        { key: "responsavel", label: "Responsável" },
        { key: "prazo", label: "Prazo original" },
        { key: "dias", label: "Dias em atraso" },
      ],
      rows: d.detalhe.acoesAtrasadas.map((a) => ({
        acao: a.acao,
        empresa: a.empresa,
        responsavel: a.responsavel ?? "",
        prazo: dataUtc(a.prazo),
        dias: String(a.diasAtraso),
      })),
      exportName: "dashboard-acoes-atrasadas",
    });
  }

  const funilMax = d ? Math.max(1, ...d.comercial.funilEtapas.map((f) => f.count)) : 1;
  const irRelatorios = () => onNavigate("relgerenciais");

  return (
    <>
      <div className="gd-scope">
        <span className="gd-scope__label">Recorte:</span>
        <strong>{recorte}</strong>
        <span className="gd-scope__hint">· dados reais da carteira CRIVO</span>
      </div>

      <CnpjLookupCard groups={groups} />

      {/* Filtros */}
      <div className="gd-filters">
        <span className="gd-lbl">Período</span>
        <div className="gd-pills">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={`gd-pill${days === p.days ? " is-active" : ""}`}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select className="gd-select" value={origem} onChange={(e) => setOrigem(e.target.value)} title="Origem do lead">
          <option value="">Origem: todas</option>
          {origemOpts.map((o) => <option key={o} value={o}>{platformLeadOriginLabel(o)}</option>)}
        </select>
        <select className="gd-select" value={groupId} onChange={(e) => { setGroupId(e.target.value); setTenantId(""); }} title="Grupo empresarial">
          <option value="">Grupo: todos</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="gd-select" value={tenantId} onChange={(e) => setTenantId(e.target.value)} title="Empresa (CNPJ)">
          <option value="">Empresa: todas</option>
          {tenantOpts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="gd-select" value={consultor} onChange={(e) => setConsultor(e.target.value)} title="Responsável comercial (leads) e responsável CRIVO (contratos)">
          <option value="">Consultor: todos</option>
          {(d?.consultores ?? (consultor ? [consultor] : [])).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="gd-select" value={status} onChange={(e) => setStatus(e.target.value)} title="Etapa do lead no funil">
          <option value="">Status: todos</option>
          {PLATFORM_LEAD_STAGES.map((s) => <option key={s} value={s}>{PLATFORM_LEAD_STAGE_LABEL[s]}</option>)}
        </select>
        {hasFilters && (
          <button
            type="button"
            className="gd-chip"
            onClick={() => { setOrigem(""); setGroupId(""); setTenantId(""); setConsultor(""); setStatus(""); }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Atalhos */}
      <div className="gd-shortcuts">
        <span className="gd-lbl">Atalhos:</span>
        {SHORTCUTS.map((s) => (
          <button key={s.section} type="button" className="gd-chip" onClick={() => onNavigate(s.section)}>
            {s.label}
          </button>
        ))}
      </div>

      {load === "loading" && <p className="dash-state" style={{ marginTop: 24 }}>Carregando o dashboard…</p>}
      {load === "error" && <div className="dash-state dash-state--error" style={{ marginTop: 24 }}>Não foi possível carregar o dashboard.</div>}

      {load === "ok" && d && (
        <>
          {/* COMERCIAL */}
          <Block title="Comercial">
            <Kpi label="Leads no período" value={String(d.comercial.leads)} hint={`período anterior: ${d.comercial.leadsPrev}`} onClick={() => abrirLeads("todos")} />
            <Kpi label="Leads atendidos" value={String(d.comercial.leadsAtendidos)} hint="com 1º contato registrado" onClick={() => abrirLeads("atendidos")} />
            <Kpi label="Sem 1º contato" value={String(d.comercial.leadsSemPrimeiroContato)} hint="aguardando retorno" onClick={() => abrirLeads("sem-contato")} />
            <Kpi label="Tempo médio resposta" value={fmtDuration(d.comercial.tempoRespostaMedioMin)} hint="lead → 1º contato" />
            <Kpi label="Propostas enviadas" value={String(d.comercial.propostasEnviadas)} />
            <Kpi label="Contratações confirmadas" value={String(d.comercial.fechadas)} onClick={abrirContratacoes} />
            <Kpi label="Taxa de conversão" value={`${d.comercial.conversao}%`} hint="lead → contratação" />
            <Kpi
              label="Faturamento contratado"
              value={brl(d.comercial.faturamentoEstimadoCents)}
              hint={`ticket médio ${brl(d.comercial.ticketMedioCents)} · estimado`}
              onClick={abrirContratacoes}
            />
            <Kpi label="Valor em pipeline" value={brl(d.comercial.valorPropostoCents)} />
            <Kpi label="Ticket médio" value={brl(d.comercial.ticketMedioCents)} />
          </Block>

          <div className="gd-2col">
            <div className="gd-panel">
              <div className="gd-panel__title">Funil por etapa</div>
              <div className="gd-funil">
                {d.comercial.funilEtapas.map((f) => (
                  <div key={f.key}>
                    <div className="gd-funil__row"><span>{f.label}</span><span className="cell-mute">{f.count}</span></div>
                    <div className="gd-funil__track"><div className="gd-funil__fill" style={{ width: `${(f.count / funilMax) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="gd-panel">
              <div className="gd-panel__title">Motivos de não conversão</div>
              <ul className="gd-list">
                {d.comercial.motivosPerda.map((m) => (
                  <li key={m.motivo}><span>{m.motivo}</span><span className="cell-mute">{m.count}</span></li>
                ))}
                {d.comercial.motivosPerda.length === 0 && <li className="cell-mute">Nenhuma perda registrada no período.</li>}
              </ul>
            </div>
          </div>

          {/* CONTRATOS */}
          <Block title="Contratos">
            <Kpi label="Ativos" value={String(d.contratos.ativos)} />
            <Kpi label="Em rascunho" value={String(d.contratos.rascunho)} />
            <Kpi label="Vencendo em 30d" value={String(d.contratos.vencendo30)} />
            <Kpi label="Vencendo em 60d" value={String(d.contratos.vencendo60)} />
            <Kpi label="Vencendo em 90d" value={String(d.contratos.vencendo90)} />
            <Kpi label="MRR" value={brl(d.contratos.mrrCents)} hint="estimado" />
            <Kpi label="ARR" value={brl(d.contratos.arrCents)} hint="MRR × 12 · estimado" />
            <Kpi label="Com adicionais" value={String(d.contratos.comAdicionais)} />
            <Kpi label="Expansões contratuais" value="—" aModelar hint="aguarda histórico de aditivos" />
            <Kpi label="Clientes bloqueados" value={String(d.executivo.clientesBloqueados)} />
          </Block>

          {/* ENTREGAS */}
          <Block title="Entregas">
            <Kpi label="Diagnósticos em andamento" value={String(d.entregas.diagnosticosAndamento)} />
            <Kpi label="Avaliações realizadas" value={String(d.entregas.avaliacoes)} />
            <Kpi label="Planos pendentes" value={String(d.entregas.planosPendentes)} hint="aguardando validação" />
            <Kpi label="Ações atrasadas" value={String(d.entregas.acoesAtrasadas)} onClick={abrirAcoesAtrasadas} />
            <Kpi label="Mentorias agendadas" value={String(d.entregas.mentoriasAgendadas)} />
            <Kpi label="Mentorias atrasadas" value={String(d.entregas.mentoriasAtrasadas)} />
            <Kpi label="Evidências registradas" value={String(d.entregas.evidencias)} />
            <Kpi label="Clientes sem responsável" value={String(d.entregas.clientesSemResponsavel)} hint="contrato sem responsável CRIVO" />
            <Kpi label="Clientes sem avanço" value={String(d.entregas.clientesSemAvanco)} hint="ativos sem diagnóstico iniciado" />
          </Block>

          {/* FINANCEIRO E CARTEIRA — cada card abre os Relatórios Gerenciais */}
          <Block title="Financeiro e Carteira">
            <Kpi label="Receita contratada" value={brl(d.financeiro.receitaContratadaCents)} hint="contratado no período · estimado" onClick={irRelatorios} />
            <Kpi label="Faturada" value="—" aModelar hint={SEM_FINANCEIRO} onClick={irRelatorios} />
            <Kpi label="Recebida" value="—" aModelar hint={SEM_FINANCEIRO} onClick={irRelatorios} />
            <Kpi label="Em atraso" value="—" aModelar tone="alert" hint={SEM_FINANCEIRO} onClick={irRelatorios} />
            <Kpi label="MRR" value={brl(d.contratos.mrrCents)} hint="MRR atual" onClick={irRelatorios} />
            <Kpi label="ARR" value={brl(d.contratos.arrCents)} hint="ARR estimado" onClick={irRelatorios} />
            <Kpi label="Novo MRR" value={brl(d.financeiro.novoMrrCents)} hint="contratos iniciados no período" onClick={irRelatorios} />
            <Kpi label="Expansão" value="—" aModelar hint={SEM_FINANCEIRO} onClick={irRelatorios} />
            <Kpi label="Redução" value="—" aModelar hint={SEM_FINANCEIRO} onClick={irRelatorios} />
            <Kpi label="Cancelamento" value="—" aModelar hint={SEM_FINANCEIRO} onClick={irRelatorios} />
            <Kpi label="Contratos a vencer" value={String(d.financeiro.contratosVencer60)} hint="próximos 60 dias" onClick={irRelatorios} />
            <Kpi label="Em renovação" value={String(d.financeiro.emRenovacao)} hint="renovações em negociação no CRM" onClick={irRelatorios} />
          </Block>

          {/* EXECUTIVO */}
          <Block title="Executivo">
            <Kpi label="Clientes ativos" value={String(d.executivo.clientesAtivos)} />
            <Kpi label="Novos clientes" value={String(d.executivo.novosClientes)} hint={`últimos ${periodoLabel}`} />
            <Kpi label="Clientes bloqueados" value={String(d.executivo.clientesBloqueados)} />
            <Kpi label="Central de pendências" value={String(d.pendencias.length)} />
          </Block>

          {/* PENDÊNCIAS + AUDITORIA */}
          <div className="gd-bottom">
            <div>
              <div className="gd-block__title">Central de Pendências</div>
              <div className="gd-panel gd-panel--list">
                <ul className="gd-pend">
                  {d.pendencias.map((p, i) => (
                    <li key={i}>
                      <div>
                        <div className="gd-pend__txt">{p.texto}</div>
                        <div className="gd-pend__area">{p.area}</div>
                      </div>
                      <button type="button" className="gd-pend__open" onClick={() => onNavigate(p.secao)}>Abrir ↗</button>
                    </li>
                  ))}
                  {d.pendencias.length === 0 && <li className="cell-mute">Nada pendente por aqui — tudo em dia.</li>}
                </ul>
              </div>
            </div>

            <div>
              <div className="gd-block__title">Últimas ações auditadas</div>
              <div className="gd-panel gd-panel--list">
                <ul className="gd-audit">
                  {(audit ?? []).map((a) => (
                    <li key={a.id}>
                      <span>{auditLabel(a.action)}</span>
                      <span className="cell-mute">{new Date(a.at).toLocaleString("pt-BR")}</span>
                    </li>
                  ))}
                  {audit === null && <li className="cell-mute">Carregando…</li>}
                  {audit?.length === 0 && <li className="cell-mute">Sem eventos ainda.</li>}
                </ul>
              </div>
            </div>
          </div>

          <div className="gd-rulebox">
            <div className="gd-rulebox__title">Regras desta tela</div>
            Este é o painel <b>operacional</b>. Para análise profunda por cliente/CNPJ — cruzando diagnóstico, plano,
            evidências, ICD, custos e evolução — abra a{" "}
            <button type="button" className="linklike" onClick={() => onNavigate("inteligencia")}>Inteligência CRIVO</button>.
            Métricas marcadas como <b>a definir</b> aguardam integração de dado; não exibem número falso. Clique nos KPIs
            comerciais e em Ações atrasadas para abrir o detalhamento; os cards de Financeiro e Carteira abrem os
            Relatórios Gerenciais.
          </div>
        </>
      )}

      {drill && <DrillDrawer drill={drill} onClose={() => setDrill(null)} />}
    </>
  );
}
