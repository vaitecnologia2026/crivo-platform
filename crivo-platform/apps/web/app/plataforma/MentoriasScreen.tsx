"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MENTORIA_FORMAT_LABEL, MENTORIA_STATUS_LABEL, type MentoriaFormat, type MentoriaStatus } from "@crivo/types";
import { getMyMentorias, type MentoriaTenantEntry } from "@/lib/api";
import { exportPDF, exportXLSX, useExportContext } from "@/lib/exports";
import { IconCalendarClock, IconClose, IconDownload, IconFileText, IconLink, IconPlay } from "./Icons";

type LoadStatus = "loading" | "ok" | "error";

function statusPillClass(s: MentoriaStatus): string {
  if (s === "REALIZADA") return "score-pill--high";
  if (s === "CANCELADA") return "score-pill--low";
  return "score-pill--mid";
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Mentorias do tenant (#59). Líder vê as suas; RH/CEO veem todas. */
export function MentoriasScreen() {
  const [rows, setRows] = useState<MentoriaTenantEntry[] | null>(null);
  // "Horas contratadas" vem do CONTRATO vigente da empresa (Contract.contractedHours,
  // gravado pelo Super Admin). null = campo não preenchido no contrato — mostra
  // "—" com o aviso, em vez de inventar um número.
  const [contractedHours, setContractedHours] = useState<number | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [detail, setDetail] = useState<MentoriaTenantEntry | null>(null);
  const exportCtx = useExportContext();

  async function refresh() {
    setStatus("loading");
    try {
      const r = await getMyMentorias();
      setRows(r.rows);
      setContractedHours(r.contractedHours);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    getMyMentorias()
      .then((r) => { if (alive) { setRows(r.rows); setContractedHours(r.contractedHours); setStatus("ok"); } })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, []);

  const upcoming = rows?.filter((m) => m.status === "AGENDADA" && new Date(m.scheduledAt) >= new Date()) ?? [];
  const past = rows?.filter((m) => !upcoming.includes(m)) ?? [];

  // KPIs calculados no cliente — mesmos critérios do protótipo, mas sobre dados reais.
  const now = Date.now();
  const proximos30 = upcoming.filter((m) => new Date(m.scheduledAt).getTime() - now <= 30 * DIA_MS).length;
  const mentoresDesignados = new Set((rows ?? []).map((m) => m.mentorName).filter(Boolean)).size;
  const horasUtilizadas = (rows ?? [])
    .filter((m) => m.status === "REALIZADA")
    .reduce((acc, m) => acc + (m.durationMin ?? 0), 0) / 60;

  function exportRows() {
    return (rows ?? []).map((m) => ({
      Tema: m.title, Mentor: m.mentorName, Participante: m.attendee,
      Quando: new Date(m.scheduledAt).toLocaleString("pt-BR"),
      "Duração (min)": m.durationMin,
      Formato: MENTORIA_FORMAT_LABEL[m.format as MentoriaFormat] ?? m.format,
      Status: MENTORIA_STATUS_LABEL[m.status as MentoriaStatus] ?? m.status,
    }));
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Mentorias e Agenda</h1>
          <p className="page-sub">Encontros com mentores CRIVO, sessões de devolutiva e comitês executivos.</p>
        </div>
        <div className="route__actions">
          <button
            className="btn btn--outline-dark btn--sm"
            disabled={!exportCtx || !rows?.length}
            onClick={() => exportCtx && exportXLSX("crivo-mentorias", [{ name: "Mentorias", rows: exportRows() }], exportCtx)}
          >
            <IconDownload size={14} /> XLSX
          </button>
          <button
            className="btn btn--outline-dark btn--sm"
            disabled={!exportCtx || !rows?.length}
            onClick={() => exportCtx && exportPDF("crivo-mentorias", "Mentorias e Agenda", [{ heading: "Mentorias", rows: exportRows() }], exportCtx)}
          >
            <IconFileText size={14} /> PDF
          </button>
          <button className="btn btn--outline-dark btn--sm" onClick={refresh} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando mentorias…</p>}
      {status === "error" && <div className="dash-state dash-state--error">Não foi possível carregar.</div>}

      {status === "ok" && rows && rows.length === 0 && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Nenhuma mentoria agendada ainda</h3>
              <span className="card__sub">
                Quando uma mentoria for contratada e agendada pelo time CRIVO, ela aparece aqui.
              </span>
            </div>
          </div>
        </div>
      )}

      {status === "ok" && rows && rows.length > 0 && (
        <div className="kpi-grid">
          <div className="kpi">
            <span className="kpi__label">Próximos 30 dias</span>
            <strong className="kpi__value">{proximos30}</strong>
          </div>
          <div className="kpi">
            <span className="kpi__label">Horas contratadas</span>
            {contractedHours != null ? (
              <strong className="kpi__value">{contractedHours.toLocaleString("pt-BR")}</strong>
            ) : (
              <>
                <strong className="kpi__value">—</strong>
                <span className="kpi__delta kpi__delta--neutral" title="Não informado no contrato">não informado no contrato</span>
              </>
            )}
          </div>
          <div className="kpi">
            <span className="kpi__label">Horas utilizadas</span>
            <strong className="kpi__value">{horasUtilizadas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong>
          </div>
          <div className="kpi">
            <span className="kpi__label">Mentores designados</span>
            <strong className="kpi__value">{mentoresDesignados}</strong>
          </div>
        </div>
      )}

      {status === "ok" && upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card__head">
            <div>
              <h3>Próximas mentorias</h3>
              <span className="card__sub">{upcoming.length} agendada{upcoming.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <ul className="agenda-list">
            {upcoming.map((m) => {
              const d = new Date(m.scheduledAt);
              return (
                <li key={m.id} className="agenda-row">
                  <div className="agenda-row__when">
                    <span className="agenda-row__date">{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                    <span className="agenda-row__time">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="agenda-row__body">
                    <div className="agenda-row__theme">{m.title}</div>
                    <div className="agenda-row__mentor"><IconCalendarClock size={12} /> Mentor: {m.mentorName}</div>
                  </div>
                  <div className="agenda-row__actions">
                    <span className={`score-pill ${statusPillClass(m.status as MentoriaStatus)}`}>
                      {MENTORIA_STATUS_LABEL[m.status as MentoriaStatus] ?? m.status}
                    </span>
                    <button className="btn btn--outline-dark btn--sm" onClick={() => setDetail(m)}>Detalhes</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {status === "ok" && past.length > 0 && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Histórico</h3>
              <span className="card__sub">Mentorias passadas, realizadas ou canceladas</span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Mentor</th>
                <th>Quando</th>
                <th>Status</th>
                <th>Notas</th>
                <th aria-label="ações" />
              </tr>
            </thead>
            <tbody>
              {past.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.title}</strong>
                    {m.recordingUrl && (
                      <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" className="lib-act" style={{ marginLeft: 8 }}>
                        <IconPlay size={14} /> gravação
                      </a>
                    )}
                  </td>
                  <td>{m.mentorName}</td>
                  <td>{new Date(m.scheduledAt).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <span className={`score-pill ${statusPillClass(m.status as MentoriaStatus)}`}>
                      {MENTORIA_STATUS_LABEL[m.status as MentoriaStatus] ?? m.status}
                    </span>
                  </td>
                  <td className="card__sub">{m.notes ?? "—"}</td>
                  <td><button className="lib-act" onClick={() => setDetail(m)}>Detalhes</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && <MentoriaDetailModal m={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

/** Modal "Detalhes" (protótipo abria um toast; aqui mostra os campos reais do
 *  registro — formato, mentor, participante, acesso, local, notas, gravação). */
function MentoriaDetailModal({ m, onClose }: { m: MentoriaTenantEntry; onClose: () => void }) {
  const d = new Date(m.scheduledAt);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <div>
            <span className="card__eyebrow">{MENTORIA_FORMAT_LABEL[m.format as MentoriaFormat] ?? m.format}</span>
            <h2 style={{ marginTop: 4 }}>{m.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar"><IconClose size={16} /></button>
        </header>
        <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className={`score-pill ${statusPillClass(m.status as MentoriaStatus)}`}>
              {MENTORIA_STATUS_LABEL[m.status as MentoriaStatus] ?? m.status}
            </span>
          </div>
          <Field label="Quando" value={`${d.toLocaleString("pt-BR")} · ${m.durationMin} min`} />
          <Field label="Mentor" value={m.mentorName} />
          <Field label="Participante" value={m.attendee} />
          {m.meetingUrl && (
            <Field label="Acesso" value={
              <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer" className="lib-act">
                <IconLink size={14} /> entrar na sessão
              </a>
            } />
          )}
          {m.location && !m.meetingUrl && <Field label="Local" value={m.location} />}
          {m.notes && <Field label="Notas" value={m.notes} />}
          {m.recordingUrl && (
            <Field label="Gravação" value={
              <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" className="lib-act">
                <IconPlay size={14} /> assistir
              </a>
            } />
          )}
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--outline-dark btn--sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span className="card__eyebrow" style={{ marginBottom: 2 }}>{label}</span>
      <div style={{ fontSize: 13.5 }}>{value}</div>
    </div>
  );
}
