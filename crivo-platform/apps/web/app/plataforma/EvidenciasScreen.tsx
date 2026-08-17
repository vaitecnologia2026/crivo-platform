"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActionPlanData, EvidenceData } from "@crivo/types";
import { addEvidence, listActionPlans, uploadEvidence } from "@/lib/api";

/** Mesmos tipos oferecidos no anexo dentro da ação (Plano de Evolução), para o
 *  cliente não ter dois vocabulários de evidência dependendo de por onde envia. */
const EVIDENCE_KINDS = ["ata", "reunião", "print", "foto", "documento", "comunicado", "lista", "treinamento", "link"];

/**
 * Evidências — repositório dedicado (mockup Portal do Cliente 22/07).
 * "Repositório de comprovações vinculadas a ações e diagnósticos."
 * Consolida as evidências de TODOS os planos/ações num só lugar (o anexo
 * continua sendo feito na ação, dentro do Plano de Evolução — dado único,
 * sem duplicação: aqui só se consome/apresenta).
 */
export function EvidenciasScreen() {
  const [plans, setPlans] = useState<ActionPlanData[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState("");
  const [adding, setAdding] = useState(false);

  // Vira função nomeada para o envio recarregar a lista: a tabela é derivada de
  // `plans`, então sem o refresh a evidência recém-enviada só apareceria depois
  // de trocar de tela.
  async function refresh() {
    try {
      setPlans(await listActionPlans());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar evidências.");
    }
  }
  useEffect(() => { void refresh(); }, []);

  type Row = { ev: EvidenceData; acao: string; plano: string };
  const rows: Row[] = useMemo(() => {
    if (!plans) return [];
    const out: Row[] = [];
    for (const p of plans)
      for (const i of p.items)
        for (const ev of i.evidences) out.push({ ev, acao: i.action, plano: p.title });
    return out.sort((a, b) => (a.ev.createdAt < b.ev.createdAt ? 1 : -1));
  }, [plans]);

  const kinds = useMemo(() => [...new Set(rows.map((r) => r.ev.kind))].sort(), [rows]);
  const filtered = kind ? rows.filter((r) => r.ev.kind === kind) : rows;
  const uploads = rows.filter((r) => r.ev.fileName).length;

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Evidências</h1>
          <p className="page-sub">
            Repositório de comprovações vinculadas a ações e diagnósticos. Envie aqui ou pela
            própria ação, no <strong>Plano de Evolução</strong> — é o mesmo registro nos dois
            caminhos.
          </p>
        </div>
        <button className="btn btn--terra btn--sm" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancelar" : "Nova evidência"}
        </button>
      </div>

      {err && <div className="dash-state dash-state--error">{err}</div>}
      {!plans && !err && <p className="dash-state">Carregando evidências…</p>}

      {plans && adding && (
        <NewEvidenceForm
          plans={plans}
          onClose={() => setAdding(false)}
          onAdded={refresh}
        />
      )}

      {plans && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            <div className="kpi"><span className="kpi__label">Evidências</span><span className="kpi__value">{rows.length}</span></div>
            <div className="kpi"><span className="kpi__label">Tipos</span><span className="kpi__value">{kinds.length}</span></div>
            <div className="kpi"><span className="kpi__label">Arquivos enviados</span><span className="kpi__value">{uploads}</span></div>
            <div className="kpi"><span className="kpi__label">Links/registros</span><span className="kpi__value">{rows.length - uploads}</span></div>
          </div>

          <div className="card">
            <div className="card__head">
              <h3>Repositório</h3>
              <select className="kb-stage-select" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 180 }}>
                <option value="">Tipo: todos</option>
                {kinds.map((k) => (<option key={k} value={k}>{k}</option>))}
              </select>
            </div>
            {filtered.length === 0 ? (
              <p className="dash-state">
                Nenhuma evidência ainda. Envie a primeira em <strong>Nova evidência</strong> — ou
                anexe pela ação, no Plano de Evolução: nos dois caminhos ela aparece aqui.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Evidência</th><th>Status</th><th>Tipo</th><th>Vínculo (ação)</th><th>Plano</th><th>Data</th><th>Acesso</th></tr>
                </thead>
                <tbody>
                  {filtered.map(({ ev, acao, plano }) => (
                    <tr key={ev.id}>
                      <td><strong>{ev.title}</strong>{ev.note && <span className="card__sub"> · {ev.note}</span>}</td>
                      {/* A3 — status da validação CRIVO: só evidência APROVADA
                          compõe a documentação técnica (dossiê c/ fator Alto). */}
                      <td>
                        <span
                          className="pattern-tag"
                          style={{ color: ev.status === "APROVADA" ? "var(--success)" : ev.status === "REJEITADA" ? "var(--danger, #b4432f)" : "var(--gold-deep)" }}
                        >
                          {ev.status === "APROVADA" ? "Aprovada" : ev.status === "REJEITADA" ? "Rejeitada" : ev.status === "SUBSTITUIDA" ? "Substituída" : "Aguardando CRIVO"}
                        </span>
                      </td>
                      <td>{ev.kind}</td>
                      <td>{acao}</td>
                      <td className="cell-mute">{plano}</td>
                      <td>{new Date(ev.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td>
                        {ev.url ? (
                          <a className="link-gold" href={ev.url} target="_blank" rel="noopener">Abrir link</a>
                        ) : ev.fileName ? (
                          <span className="cell-mute">{ev.fileName}</span>
                        ) : (
                          <span className="cell-na">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}

/**
 * Envio de evidência direto do repositório. Usa EXATAMENTE os mesmos endpoints
 * do anexo dentro da ação (`/action-plans/items/:itemId/evidences` e
 * `.../upload`) — nada de rota paralela: a evidência continua pertencendo a uma
 * ação, que é o que a torna comprovação de alguma coisa e o que faz ela chegar
 * ao dossiê e à governança da CRIVO. O que muda é só o ponto de partida: antes
 * o cliente precisava caçar a ação dentro do Plano de Evolução para anexar.
 */
function NewEvidenceForm({
  plans,
  onClose,
  onAdded,
}: {
  plans: ActionPlanData[];
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const acoes = useMemo(
    () => plans.flatMap((p) => p.items.map((i) => ({ id: i.id, plano: p.title, acao: i.action }))),
    [plans],
  );
  const [itemId, setItemId] = useState(acoes[0]?.id ?? "");
  const [kind, setKind] = useState("documento");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) {
      setErro("Escolha a ação que esta evidência comprova.");
      return;
    }
    setSaving(true);
    setErro(null);
    try {
      if (file) {
        // Arquivo tem prioridade sobre o link — mesma regra do Plano de Evolução.
        await uploadEvidence(itemId, file, {
          kind,
          title: title.trim() || file.name,
          note: note.trim() || undefined,
        });
      } else {
        await addEvidence(itemId, {
          kind,
          title: title.trim(),
          url: url.trim() || undefined,
          note: note.trim() || undefined,
        });
      }
      await onAdded();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao enviar a evidência.");
    } finally {
      setSaving(false);
    }
  }

  // Evidência sem ação seria um arquivo solto: não comprova nada, não entra no
  // dossiê e não aparece neste repositório (que é derivado dos planos).
  if (acoes.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="dash-state" style={{ margin: 0 }}>
          Para enviar uma evidência é preciso ter ao menos uma ação registrada — a evidência é a
          comprovação de uma ação. Crie a primeira em <strong>Plano de Evolução</strong>.
        </p>
        <button className="btn btn--outline-dark btn--sm" style={{ marginTop: 12 }} onClick={onClose}>
          Fechar
        </button>
      </div>
    );
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
      <div className="card__head">
        <div>
          <h3>Nova evidência</h3>
          <span className="card__sub">
            Envie um arquivo (até 8 MB) ou um link. A CRIVO valida a evidência antes de ela compor
            dossiês e relatórios.
          </span>
        </div>
      </div>

      <div className="prod-form__grid">
        <label className="prod-field prod-field--full">
          <span>Ação que esta evidência comprova *</span>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {acoes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.plano} · {a.acao}
              </option>
            ))}
          </select>
        </label>
        <label className="prod-field">
          <span>Tipo</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {EVIDENCE_KINDS.map((k) => (<option key={k}>{k}</option>))}
          </select>
        </label>
        <label className="prod-field">
          <span>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ata da reunião 12/06" />
        </label>
        <label className="prod-field">
          <span>Arquivo (até 8 MB)</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="prod-field">
          <span>ou Link</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            disabled={!!file}
          />
        </label>
        <label className="prod-field prod-field--full">
          <span>Observação (opcional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contexto que ajude a CRIVO a validar" />
        </label>
      </div>

      {erro && <p className="dash-state dash-state--error" style={{ margin: "10px 0 0" }}>{erro}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn--terra btn--sm"
          disabled={saving || (!file && !title.trim() && !url.trim())}
        >
          {saving ? "Enviando…" : file ? "Enviar arquivo" : "Enviar evidência"}
        </button>
      </div>
    </form>
  );
}
