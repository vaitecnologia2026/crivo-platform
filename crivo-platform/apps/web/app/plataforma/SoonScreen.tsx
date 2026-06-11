"use client";

/** Placeholder honesto para telas cujo backend ainda não existe (sem mock).
 *  Usado por Relatórios e Parecer até terem modelo/serviço próprios. */
export function SoonScreen({ title, sub, message }: { title: string; sub: string; message: string }) {
  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">{sub}</p>
        </div>
      </div>
      <div className="card">
        <div className="card__head">
          <div>
            <h3>Em breve</h3>
            <span className="card__sub">{message}</span>
          </div>
          <span className="pill pill--gold">Roadmap</span>
        </div>
      </div>
    </>
  );
}
