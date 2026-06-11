"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { LibraryItemData, LibraryKind } from "@crivo/types";

type LoadStatus = "loading" | "error" | "ok";

const KIND_LABEL: Record<LibraryKind, string> = {
  artigo: "Artigo",
  podcast: "Podcast",
  ebook: "E-book",
  curso: "Curso",
  framework: "Framework",
};

/** Biblioteca & Formação: acervo de conteúdo real do tenant. */
export function BibliotecaScreen() {
  const [data, setData] = useState<LibraryItemData[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  async function load() {
    setStatus("loading");
    try {
      setData(await apiFetch<LibraryItemData[]>("/library"));
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<LibraryItemData[]>("/library");
        if (alive) {
          setData(d);
          setStatus("ok");
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Biblioteca & Formação</h1>
          <p className="page-sub">Materiais, frameworks e cursos da sua empresa.</p>
        </div>
        <div className="route__actions">
          <button className="btn btn--outline-dark btn--sm" onClick={load} disabled={status === "loading"}>
            {status === "loading" ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {status === "loading" && <p className="dash-state">Carregando biblioteca…</p>}

      {status === "error" && (
        <div className="dash-state dash-state--error">
          Não foi possível carregar a biblioteca.{" "}
          <button className="btn btn--outline-dark btn--sm" onClick={load}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "ok" && data && data.length === 0 && (
        <div className="card">
          <div className="card__head">
            <div>
              <h3>Acervo vazio</h3>
              <span className="card__sub">Nenhum material publicado ainda.</span>
            </div>
          </div>
        </div>
      )}

      {status === "ok" && data && data.length > 0 && (
        <div className="grid grid--3">
          {data.map((item) => (
            <div key={item.id} className="card card--mini">
              <span className="card__eyebrow">{KIND_LABEL[item.kind] ?? item.kind}</span>
              <h4>{item.title}</h4>
              {item.description && <p>{item.description}</p>}
              {item.url && (
                <a className="link-gold" href={item.url} target="_blank" rel="noreferrer">
                  Acessar →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
