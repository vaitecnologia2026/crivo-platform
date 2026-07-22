"use client";

/** Suporte (mockup Portal do Cliente 22/07): canais oficiais da CRIVO. */
export function SuporteScreen() {
  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Suporte</h1>
          <p className="page-sub">Fale com o time CRIVO ou consulte os materiais de apoio.</p>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><h3>Atendimento CRIVO</h3></div>
          <p className="card__sub" style={{ marginBottom: 12 }}>
            Dúvidas sobre diagnósticos, plano de evolução, dossiês ou acesso de usuários.
            Resposta em horário comercial.
          </p>
          <a
            className="btn btn--gold btn--sm"
            href="https://wa.me/5511918531796?text=Preciso%20de%20suporte%20no%20portal%20CRIVO"
            target="_blank" rel="noopener"
          >
            Abrir conversa no WhatsApp
          </a>
        </div>
        <div className="card">
          <div className="card__head"><h3>Materiais de apoio</h3></div>
          <p className="card__sub" style={{ marginBottom: 12 }}>
            Guias, trilhas e playbooks do programa ficam na Academia e Recursos — incluindo o
            passo a passo de campanhas e do plano de evolução.
          </p>
          <button
            type="button"
            className="btn btn--outline-dark btn--sm"
            // Navega pelo item real da sidebar (o binding de data-route-link roda
            // no boot do shell, antes desta ilha existir — clicar no nav é robusto).
            onClick={() => document.querySelector<HTMLElement>('.nav-item[data-route="biblioteca"]')?.click()}
          >
            Ir para Academia e Recursos
          </button>
        </div>
      </div>
    </>
  );
}
