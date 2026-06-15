"use client";

import { useEffect, useState } from "react";
import { MENTORIA_FORMAT_LABEL, MENTORIA_STATUS_LABEL, type MentoriaFormat, type MentoriaStatus } from "@crivo/types";
import { getMyMentorias, type MentoriaTenantEntry } from "@/lib/api";

type LoadStatus = "loading" | "ok" | "error";

function statusPillClass(s: MentoriaStatus): string {
  if (s === "REALIZADA") return "score-pill--high";
  if (s === "CANCELADA") return "score-pill--low";
  return "score-pill--mid";
}

/** Mentorias do tenant (#59). Líder vê as suas; RH/CEO veem todas. */
export function MentoriasScreen() {
  const [rows, setRows] = useState<MentoriaTenantEntry[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  async function refresh() {
    setStatus("loading");
    try {
      setRows(await getMyMentorias());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    getMyMentorias()
      .then((r) => { if (alive) { setRows(r); setStatus("ok"); } })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, []);

  const upcoming = rows?.filter((m) => m.status === "AGENDADA" && new Date(m.scheduledAt) >= new Date()) ?? [];
  const past = rows?.filter((m) => !upcoming.includes(m)) ?? [];

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Mentorias</h1>
          <p className="page-sub">Agenda e histórico das mentorias contratadas.</p>
        </div>
        <div className="route__actions">
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

      {status === "ok" && upcoming.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card__head">
            <div>
              <h3>Próximas mentorias</h3>
              <span className="card__sub">{upcoming.length} agendada{upcoming.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Mentor</th>
                <th>Participante</th>
                <th>Quando</th>
                <th>Formato</th>
                <th>Acesso</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.title}</strong></td>
                  <td>{m.mentorName}</td>
                  <td>{m.attendee}</td>
                  <td>
                    {new Date(m.scheduledAt).toLocaleString("pt-BR")}{" "}
                    <span className="card__sub">· {m.durationMin}min</span>
                  </td>
                  <td>{MENTORIA_FORMAT_LABEL[m.format as MentoriaFormat] ?? m.format}</td>
                  <td>
                    {m.meetingUrl && (
                      <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer" className="lib-act">
                        🔗 entrar
                      </a>
                    )}
                    {m.location && !m.meetingUrl && <span className="card__sub">{m.location}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              </tr>
            </thead>
            <tbody>
              {past.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.title}</strong>
                    {m.recordingUrl && (
                      <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" className="lib-act" style={{ marginLeft: 8 }}>
                        ▶ gravação
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
