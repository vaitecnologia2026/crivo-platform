"use client";

import { useEffect, useRef, useState } from "react";
import { AGE_BANDS, SHIFTS, WORK_MODELS } from "@crivo/types";
import {
  listCollaborators,
  createCollaborator,
  updateCollaborator,
  deleteCollaborator,
  importCollaborators,
  sendCollaboratorEmail,
  sendCollaboratorWhatsapp,
  getCollaboratorInviteLink,
  listCampaigns,
  listCampaignParticipants,
  type CollaboratorView,
  type CollaboratorInput,
} from "@/lib/api";
import type { CampaignSummary } from "@crivo/types";
import { isValidCpf } from "@crivo/types";

const EMPTY: CollaboratorInput = {
  name: "", phone: "", sector: "", email: "", cpf: "",
  unit: "", area: "", role: "", shift: "", ghe: "", manager: "", workModel: "", gender: "", ageBand: "",
};

/**
 * Colunas do CSV — por CABEÇALHO, não por posição (Ajustes Finais: o cadastro
 * ganhou Unidade, Área, Cargo/Função, Turno, GHE, Gestor, Modelo de trabalho e,
 * opcionais, Sexo/Gênero e Ano de nascimento/Faixa etária). Um arquivo antigo,
 * sem cabeçalho, continua sendo lido na ordem Nome · Telefone · Setor · E-mail · CPF.
 * "Processo" não existe aqui de propósito.
 */
const CSV_COLUNAS: { key: keyof CollaboratorInput; nomes: string[] }[] = [
  { key: "name", nomes: ["nome", "nome completo", "colaborador"] },
  { key: "phone", nomes: ["telefone", "telefone (whatsapp)", "whatsapp", "celular"] },
  { key: "sector", nomes: ["setor"] },
  { key: "email", nomes: ["e-mail", "email"] },
  { key: "cpf", nomes: ["cpf"] },
  { key: "unit", nomes: ["unidade", "filial", "estabelecimento"] },
  { key: "area", nomes: ["area"] },
  { key: "role", nomes: ["cargo", "funcao", "cargo/funcao", "cargo ou funcao"] },
  { key: "shift", nomes: ["turno"] },
  { key: "ghe", nomes: ["ghe", "grupo de exposicao", "ghe/grupo de exposicao", "grupo homogeneo de exposicao"] },
  { key: "manager", nomes: ["gestor", "gestor imediato", "lider", "gerente"] },
  { key: "workModel", nomes: ["modelo de trabalho", "modelo", "regime"] },
  { key: "gender", nomes: ["sexo", "genero", "sexo/genero"] },
  { key: "birthYear", nomes: ["ano de nascimento", "nascimento", "ano nascimento"] },
  { key: "ageBand", nomes: ["faixa etaria", "faixa"] },
];
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
function colunaDoCabecalho(celula: string): keyof CollaboratorInput | null {
  const k = semAcento(celula).replace(/\s+/g, " ").replace(/[*:]/g, "").trim();
  for (const c of CSV_COLUNAS) if (c.nomes.includes(k)) return c.key;
  // "Turno *", "GHE (opcional)" etc.
  for (const c of CSV_COLUNAS) if (c.nomes.some((n) => k.startsWith(n + " ") || k.startsWith(n + "("))) return c.key;
  return null;
}

// Participação nominal PROTEGIDA (homologação 17/09): a tela mostra convite,
// nunca "Respondeu" ao lado do nome — a resposta é anônima e a adesão sai em
// número na campanha. O servidor não manda esse dado (collaborators.service).
const STATUS_LABEL: Record<CollaboratorView["status"], string> = {
  pending: "Sem convite",
  invited: "Convite enviado",
};
/** O back fala em português no status por campanha; a tela usa o mesmo vocabulário. */
const STATUS_DA_CAMPANHA: Record<"pendente" | "convidado", CollaboratorView["status"]> = {
  pendente: "pending",
  convidado: "invited",
};
const STATUS_CLASS: Record<CollaboratorView["status"], string> = {
  pending: "addx-status--AGUARDANDO_DADOS",
  invited: "addx-status--EM_REVISAO",
};

/** Gera e baixa um CSV client-side (BOM + ";" para o Excel pt-BR abrir certo). */
function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const esc = (v: unknown) =>
    /[";\n\r]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "");
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

/** Parser CSV simples: detecta ; ou , , tolera BOM e aspas, pula cabeçalho. */
function parseCsv(text: string): CollaboratorInput[] {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delim = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  const cabecalho = splitLine(lines[0]).map(colunaDoCabecalho);
  const startsAtHeader = cabecalho.some((c) => c !== null);
  const rows: CollaboratorInput[] = [];
  for (let i = startsAtHeader ? 1 : 0; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.every((c) => c === "")) continue;
    if (!startsAtHeader) {
      // Arquivo antigo, sem cabeçalho: ordem do modelo original.
      rows.push({ name: cols[0] ?? "", phone: cols[1] ?? "", sector: cols[2] ?? "", email: cols[3] ?? "", cpf: cols[4] ?? "" });
      continue;
    }
    const row: CollaboratorInput = { name: "", cpf: "" };
    cabecalho.forEach((key, idx) => {
      if (!key) return;
      const v = (cols[idx] ?? "").trim();
      if (key === "birthYear") {
        const ano = Number(v.replace(/\D/g, "").slice(0, 4));
        if (ano >= 1900 && ano <= 2100) row.birthYear = ano;
        return;
      }
      (row as unknown as Record<string, unknown>)[key] = v;
    });
    rows.push(row);
  }
  return rows;
}

export function ColaboradoresScreen() {
  const [rows, setRows] = useState<CollaboratorView[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [form, setForm] = useState<{ id: string | null; data: CollaboratorInput } | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // O convite pertence a uma CAMPANHA: sem ciclo escolhido não há envio. Antes o
  // e-mail saía só por existir cadastro importado e a resposta não pertencia a
  // campanha nenhuma — a tela de campanhas não tinha como medir adesão.
  const [campanhas, setCampanhas] = useState<CampaignSummary[]>([]);
  const [campanhaId, setCampanhaId] = useState<string>("");
  /**
   * Convite POR CAMPANHA (a lista geral traz o último convite da pessoa em
   * qualquer campanha; com uma campanha escolhida, vale o convite DAQUELA).
   * Adesão da campanha em número, para a tela não perder a leitura de
   * "quantos já responderam" ao deixar de mostrar quem.
   */
  const [naCampanha, setNaCampanha] = useState<Record<string, { status: CollaboratorView["status"] }>>({});
  const [adesao, setAdesao] = useState<{ cadastrados: number; convidados: number; responderam: number } | null>(null);

  async function load() {
    setStatus("loading");
    try {
      const [colabs, camps] = await Promise.all([
        listCollaborators(),
        listCampaigns().catch(() => [] as CampaignSummary[]),
      ]);
      setRows(colabs);
      const abertas = camps.filter((c) => c.status === "OPEN");
      setCampanhas(abertas);
      // Uma campanha aberta só: já vem escolhida (nada a decidir).
      setCampanhaId((atual) =>
        atual && abertas.some((c) => c.id === atual) ? atual : abertas.length === 1 ? abertas[0].id : "",
      );
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!campanhaId) {
      setNaCampanha({});
      setAdesao(null);
      return;
    }
    let vivo = true;
    void listCampaignParticipants(campanhaId)
      .then((r) => {
        if (!vivo) return;
        const mapa: Record<string, { status: CollaboratorView["status"] }> = {};
        for (const p of r.participants) {
          mapa[p.id] = { status: STATUS_DA_CAMPANHA[p.status] };
        }
        setNaCampanha(mapa);
        setAdesao(r.resumo);
      })
      // Falha aqui degrada para o status geral — não vale derrubar a tela.
      .catch(() => { if (vivo) { setNaCampanha({}); setAdesao(null); } });
    return () => { vivo = false; };
  }, [campanhaId, rows]);

  const nomeCampanha = () => campanhas.find((c) => c.id === campanhaId)?.name ?? "";

  function flashMsg(m: string) {
    setFlash(m);
    setTimeout(() => setFlash(null), 2600);
  }

  function openNew() {
    setForm({ id: null, data: { ...EMPTY } });
    setFormErr(null);
  }
  function openEdit(c: CollaboratorView) {
    setForm({
      id: c.id,
      data: {
        name: c.name, phone: c.phone ?? "", sector: c.sector ?? "", email: c.email ?? "", cpf: "",
        unit: c.unit ?? "", area: c.area ?? "", role: c.role ?? "", shift: c.shift ?? "", ghe: c.ghe ?? "",
        manager: c.manager ?? "", workModel: c.workModel ?? "", gender: c.gender ?? "",
        birthYear: c.birthYear ?? undefined, ageBand: c.ageBand ?? "",
      },
    });
    setFormErr(null);
  }

  async function save() {
    if (!form) return;
    const d = form.data;
    if (!d.name.trim()) { setFormErr("Informe o nome completo."); return; }
    // No cadastro novo o CPF é obrigatório e validado; na edição, só se preenchido.
    if (form.id === null || d.cpf.trim()) {
      if (!isValidCpf(d.cpf)) { setFormErr("CPF inválido."); return; }
    }
    setSaving(true);
    setFormErr(null);
    try {
      if (form.id) {
        const patch: Partial<CollaboratorInput> = {
          name: d.name, phone: d.phone, sector: d.sector, email: d.email,
          unit: d.unit, area: d.area, role: d.role, shift: d.shift, ghe: d.ghe, manager: d.manager,
          workModel: d.workModel, gender: d.gender, birthYear: d.birthYear, ageBand: d.ageBand,
        };
        if (d.cpf.trim()) patch.cpf = d.cpf;
        await updateCollaborator(form.id, patch);
      } else {
        await createCollaborator(d);
      }
      setForm(null);
      await load();
      flashMsg("Colaborador salvo.");
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: CollaboratorView) {
    // Não se sabe (nem se mostra) se a pessoa respondeu: o aviso vale para todos.
    const warn = `Remover ${c.name}? Se já respondeu, a resposta (anônima) NÃO é apagada.`;
    if (!confirm(warn)) return;
    setBusyId(c.id);
    try {
      await deleteCollaborator(c.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao remover.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Copia o link do convite DAQUELA campanha (criando o convite se preciso).
   *
   * Antes copiava o token do próprio colaborador, que responde fora de qualquer
   * campanha: exigir campanha no envio por e-mail e deixar o link livre no botão
   * ao lado anulava a regra — a resposta entrava no agregado sem pertencer a
   * ciclo nenhum, e a campanha não a contava.
   */
  async function copiaParaAreaDeTransferencia(link: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(link);
      flashMsg(aviso);
    } catch {
      // Sem permissão de clipboard (http, iframe, navegador antigo): mostrar o
      // link para copiar à mão é melhor do que falhar em silêncio.
      window.prompt("Copie o link do colaborador:", link);
    }
  }

  async function copyLink(c: CollaboratorView) {
    // SEM campanha aberta, copia o link PESSOAL do colaborador (/r/<token>),
    // que já vem na listagem. O aviso no topo da tela sempre prometeu isso
    // ("copiar o link continua funcionando, mas a resposta não entra em nenhum
    // ciclo") — era só o botão que exigia campanha e travava a coleta.
    if (!campanhaId) {
      if (!c.link) { alert("Este colaborador ainda não tem link. Recarregue a tela."); return; }
      await copiaParaAreaDeTransferencia(
        c.link,
        `Link pessoal de ${c.name} copiado — a resposta NÃO entra em nenhuma campanha.`,
      );
      return;
    }
    setBusyId(c.id);
    try {
      const { link } = await getCollaboratorInviteLink(c.id, campanhaId);
      await copiaParaAreaDeTransferencia(link, `Link de ${c.name} copiado — campanha "${nomeCampanha()}".`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao gerar o link.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendEmail(c: CollaboratorView) {
    if (!campanhaId) { alert("Escolha a campanha antes de enviar o convite."); return; }
    setBusyId(c.id);
    try {
      await sendCollaboratorEmail(c.id, campanhaId);
      await load();
      flashMsg(`E-mail enviado para ${c.name} — campanha "${nomeCampanha()}".`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao enviar e-mail.");
    } finally {
      setBusyId(null);
    }
  }
  async function sendWa(c: CollaboratorView) {
    if (!campanhaId) { alert("Escolha a campanha antes de enviar o convite."); return; }
    setBusyId(c.id);
    try {
      await sendCollaboratorWhatsapp(c.id, campanhaId);
      await load();
      flashMsg(`WhatsApp enviado para ${c.name} — campanha "${nomeCampanha()}".`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao enviar WhatsApp.");
    } finally {
      setBusyId(null);
    }
  }

  function downloadModel() {
    downloadCsv("modelo-colaboradores.csv", [
      [
        "Nome Completo", "Telefone (WhatsApp)", "Setor", "E-mail", "CPF",
        "Unidade", "Área", "Cargo/Função", "Turno", "GHE/Grupo de Exposição", "Gestor", "Modelo de trabalho",
        "Sexo/Gênero (opcional)", "Ano de nascimento (opcional)", "Faixa etária (opcional)",
      ],
      [
        "Maria da Silva", "11999990000", "Operações", "maria@empresa.com.br", "529.982.247-25",
        "Matriz", "Produção", "Operadora", "Noite", "GHE-Produção", "João Souza", "Presencial",
        "Feminino", "1990", "",
      ],
    ]);
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImportMsg("Lendo arquivo…");
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) { setImportMsg("Nenhuma linha encontrada no CSV."); return; }
      const res = await importCollaborators(parsed);
      await load();
      const errTxt = res.errors.length
        ? ` · ${res.errors.length} ignorada(s): ${res.errors.slice(0, 3).map((e) => `linha ${e.line} (${e.reason})`).join("; ")}${res.errors.length > 3 ? "…" : ""}`
        : "";
      setImportMsg(`${res.created} colaborador(es) importado(s)${errTxt}`);
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (status === "loading") return <p className="dash-state">Carregando colaboradores…</p>;
  if (status === "error") return <div className="dash-state dash-state--error">Não foi possível carregar os colaboradores.</div>;

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">Colaboradores</h1>
          <p className="page-sub">
            Cadastre quem vai responder o diagnóstico contratado. Cada colaborador recebe um <strong>link
            único</strong>; no acesso ele confirma o <strong>CPF</strong> e responde uma única vez. As respostas
            são <strong>anônimas</strong> e agregadas por recorte (GHE informado pela empresa, unidade, área,
            setor, cargo, turno…), sempre com o mínimo de respostas por grupo.
          </p>
        </div>
        <div className="route__actions">
          <button className="btn btn--gold btn--sm" onClick={openNew}>+ Novo colaborador</button>
          <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>Importar CSV</button>
          <button className="btn btn--ghost btn--sm" onClick={downloadModel}>Baixar modelo CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => onImportFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {/* A campanha é o contexto do convite: sem ela o envio fica bloqueado, com o
          caminho para criar uma. É o que liga a coleta ao ciclo e faz a adesão e a
          evolução por campanha existirem. */}
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        {campanhas.length === 0 ? (
          <p className="card__sub" style={{ margin: 0 }}>
            <strong>Nenhuma campanha aberta.</strong> O convite ao colaborador acontece dentro de uma
            campanha — crie uma em <strong>Campanhas de Diagnóstico</strong> e volte aqui para enviar.
            Copiar o link continua funcionando, mas a resposta não entra em nenhum ciclo.
          </p>
        ) : (
          <label style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: 0 }}>
            <span style={{ fontSize: 12, color: "var(--text-sec)" }}>Convidar para a campanha:</span>
            <select
              className="mod-select"
              value={campanhaId}
              onChange={(e) => setCampanhaId(e.target.value)}
              style={{ minWidth: 260 }}
            >
              <option value="">— escolha a campanha —</option>
              {campanhas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.sector ? ` · ${c.sector}` : ""}
                </option>
              ))}
            </select>
            <span className="card__sub" style={{ margin: 0 }}>
              As respostas deste convite entram nesta campanha.
              {adesao && (
                <> Adesão: <strong>{adesao.responderam}</strong> resposta(s) de {adesao.convidados} convidado(s) — quem respondeu é confidencial.</>
              )}
            </span>
          </label>
        )}
      </div>

      {flash && <div className="dash-state" style={{ color: "var(--success,#2e7d5b)" }}>{flash}</div>}
      {importMsg && <div className="card card__sub" style={{ padding: 12, marginBottom: 12 }}>{importMsg}</div>}

      {form && (
        <div className="card" style={{ borderTop: "3px solid var(--gold)", marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{form.id ? "Editar colaborador" : "Novo colaborador"}</h3>
          <div className="prod-form__grid">
            <label className="prod-field">
              <span>Nome completo *</span>
              <input value={form.data.name} onChange={(e) => setForm({ ...form, data: { ...form.data, name: e.target.value } })} />
            </label>
            <label className="prod-field">
              <span>Telefone (WhatsApp)</span>
              <input value={form.data.phone} placeholder="(11) 99999-0000" onChange={(e) => setForm({ ...form, data: { ...form.data, phone: e.target.value } })} />
            </label>
            <label className="prod-field">
              <span>Setor</span>
              <input value={form.data.sector} onChange={(e) => setForm({ ...form, data: { ...form.data, sector: e.target.value } })} />
            </label>
            <label className="prod-field">
              <span>E-mail</span>
              <input type="email" value={form.data.email} onChange={(e) => setForm({ ...form, data: { ...form.data, email: e.target.value } })} />
            </label>
            <label className="prod-field">
              <span>CPF {form.id ? "(deixe em branco para manter)" : "*"}</span>
              <input value={form.data.cpf} placeholder="000.000.000-00" onChange={(e) => setForm({ ...form, data: { ...form.data, cpf: e.target.value } })} />
            </label>
            {/* Recortes (Ajustes Finais de Homologação). GHE é o que a empresa
                informa — o sistema nunca deduz de Área/Setor. */}
            <label className="prod-field"><span>Unidade</span>
              <input value={form.data.unit ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, unit: e.target.value } })} />
            </label>
            <label className="prod-field"><span>Área</span>
              <input value={form.data.area ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, area: e.target.value } })} />
            </label>
            <label className="prod-field"><span>Cargo/Função</span>
              <input value={form.data.role ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, role: e.target.value } })} />
            </label>
            <label className="prod-field"><span>Turno</span>
              <input list="crivo-turnos" value={form.data.shift ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, shift: e.target.value } })} />
              <datalist id="crivo-turnos">{SHIFTS.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="prod-field"><span>GHE / Grupo de exposição (informado pela empresa)</span>
              <input value={form.data.ghe ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, ghe: e.target.value } })} />
            </label>
            <label className="prod-field"><span>Gestor</span>
              <input value={form.data.manager ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, manager: e.target.value } })} />
            </label>
            <label className="prod-field"><span>Modelo de trabalho</span>
              <input list="crivo-modelos" value={form.data.workModel ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, workModel: e.target.value } })} />
              <datalist id="crivo-modelos">{WORK_MODELS.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="prod-field"><span>Sexo/Gênero (opcional)</span>
              <input value={form.data.gender ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, gender: e.target.value } })} />
            </label>
            <label className="prod-field"><span>Ano de nascimento (opcional)</span>
              <input type="number" min={1900} max={2100} value={form.data.birthYear ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, birthYear: e.target.value ? Number(e.target.value) : undefined } })} />
            </label>
            <label className="prod-field"><span>Faixa etária (opcional, se não houver o ano)</span>
              <input list="crivo-faixas" value={form.data.ageBand ?? ""} onChange={(e) => setForm({ ...form, data: { ...form.data, ageBand: e.target.value } })} />
              <datalist id="crivo-faixas">{AGE_BANDS.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
          </div>
          {formErr && <p className="evd-reason" style={{ color: "var(--danger,#b4453a)" }}>{formErr}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="btn btn--gold btn--sm" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</button>
            <button className="btn btn--ghost btn--sm" disabled={saving} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Setor</th>
              <th>Recortes</th>
              <th>Contato</th>
              <th>CPF</th>
              <th>{campanhaId ? "Convite nesta campanha" : "Convite (último)"}</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.sector || "—"}</td>
                <td className="card__sub">
                  {[
                    c.ghe ? `GHE ${c.ghe}` : null,
                    c.unit,
                    c.area,
                    c.role,
                    c.shift,
                    c.workModel,
                  ].filter(Boolean).join(" · ") || "—"}
                </td>
                <td>
                  {c.email || "—"}
                  {c.phone ? <><br /><span className="card__sub">{c.phone}</span></> : null}
                </td>
                <td><code>{c.cpfMasked}</code></td>
                <td>
                  {(() => {
                    const nesta = campanhaId ? naCampanha[c.id] : undefined;
                    const st = nesta?.status ?? c.status;
                    return <span className={`addx-status ${STATUS_CLASS[st]}`}>{STATUS_LABEL[st]}</span>;
                  })()}
                </td>
                <td className="addx-actions" style={{ whiteSpace: "nowrap" }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    disabled={busyId === c.id}
                    title={
                      campanhaId
                        ? `Link do convite na campanha "${nomeCampanha()}"`
                        : "Link pessoal — funciona, mas a resposta não entra em nenhuma campanha"
                    }
                    onClick={() => copyLink(c)}
                  >
                    Copiar link
                  </button>
                  <button className="btn btn--ghost btn--sm" disabled={busyId === c.id || !c.email || !campanhaId} title={!c.email ? "Sem e-mail" : !campanhaId ? "Escolha a campanha acima" : ""} onClick={() => sendEmail(c)}>E-mail</button>
                  <button className="btn btn--ghost btn--sm" disabled={busyId === c.id || !c.phone || !campanhaId} title={!c.phone ? "Sem telefone" : !campanhaId ? "Escolha a campanha acima" : ""} onClick={() => sendWa(c)}>WhatsApp</button>
                  <button className="btn btn--ghost btn--sm" disabled={busyId === c.id} onClick={() => openEdit(c)}>Editar</button>
                  <button className="btn btn--ghost btn--sm" disabled={busyId === c.id} style={{ color: "var(--danger,#b4453a)" }} onClick={() => remove(c)}>Remover</button>
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
              <tr><td colSpan={6} className="card__sub" style={{ textAlign: "center", padding: 24 }}>Nenhum colaborador cadastrado. Use “+ Novo colaborador” ou “Importar CSV”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
