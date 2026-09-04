"use client";

import { useEffect, useRef, useState } from "react";
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
  type CollaboratorView,
  type CollaboratorInput,
} from "@/lib/api";
import type { CampaignSummary } from "@crivo/types";
import { isValidCpf } from "@crivo/types";

const EMPTY: CollaboratorInput = { name: "", phone: "", sector: "", email: "", cpf: "" };

const STATUS_LABEL: Record<CollaboratorView["status"], string> = {
  pending: "Pendente",
  invited: "Convite enviado",
  responded: "Respondeu",
};
const STATUS_CLASS: Record<CollaboratorView["status"], string> = {
  pending: "addx-status--AGUARDANDO_DADOS",
  invited: "addx-status--EM_REVISAO",
  responded: "addx-status--ATIVO",
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
  const first = splitLine(lines[0]).join(" ").toLowerCase();
  const startsAtHeader = first.includes("nome") || first.includes("cpf");
  const rows: CollaboratorInput[] = [];
  for (let i = startsAtHeader ? 1 : 0; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.every((c) => c === "")) continue;
    rows.push({
      name: cols[0] ?? "",
      phone: cols[1] ?? "",
      sector: cols[2] ?? "",
      email: cols[3] ?? "",
      cpf: cols[4] ?? "",
    });
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
      data: { name: c.name, phone: c.phone ?? "", sector: c.sector ?? "", email: c.email ?? "", cpf: "" },
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
        const patch: Partial<CollaboratorInput> = { name: d.name, phone: d.phone, sector: d.sector, email: d.email };
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
    const warn = c.status === "responded"
      ? `${c.name} já respondeu. A resposta (anônima) NÃO é apagada. Remover o cadastro mesmo assim?`
      : `Remover ${c.name}?`;
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
  async function copyLink(c: CollaboratorView) {
    if (!campanhaId) { alert("Escolha a campanha antes de copiar o link."); return; }
    setBusyId(c.id);
    try {
      const { link } = await getCollaboratorInviteLink(c.id, campanhaId);
      try {
        await navigator.clipboard.writeText(link);
        flashMsg(`Link de ${c.name} copiado — campanha "${nomeCampanha()}".`);
      } catch {
        window.prompt("Copie o link do colaborador:", link);
      }
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
      ["Nome Completo", "Telefone (WhatsApp)", "Setor", "E-mail", "CPF"],
      ["Maria da Silva", "11999990000", "Operações", "maria@empresa.com.br", "529.982.247-25"],
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
            são <strong>anônimas</strong> e agregadas por setor.
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
              <th>Contato</th>
              <th>CPF</th>
              <th>Status</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.sector || "—"}</td>
                <td>
                  {c.email || "—"}
                  {c.phone ? <><br /><span className="card__sub">{c.phone}</span></> : null}
                </td>
                <td><code>{c.cpfMasked}</code></td>
                <td><span className={`addx-status ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}{c.respondedAt ? ` · ${new Date(c.respondedAt).toLocaleDateString("pt-BR")}` : ""}</span></td>
                <td className="addx-actions" style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn--ghost btn--sm" disabled={busyId === c.id || !campanhaId} title={campanhaId ? "" : "Escolha a campanha acima"} onClick={() => copyLink(c)}>Copiar link</button>
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
