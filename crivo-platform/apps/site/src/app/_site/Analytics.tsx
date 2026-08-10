"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { EVENTOS, GA4_ID, capturarAtribuicao, evento, marcarGtagPronto } from "@/lib/analytics";

/**
 * Medição do site (§15) com GA4, respeitando o consentimento do §13.
 *
 * O <Script> do Next só é RENDERIZADO depois do aceite de "medição" — sem
 * aceite, nenhuma requisição sai para o Google. É o consentimento bloqueando
 * de verdade, não um aviso decorativo.
 *
 * Usa next/script (e não injeção manual) porque é o que o framework
 * recomenda para terceiros: garante carregar uma única vez mesmo navegando
 * entre rotas, e deixa a estratégia explícita.
 *
 * Também registra os cliques que o documento pede saber — WhatsApp e Portal —
 * com UM listener delegado, em vez de handler em cada link: são dezenas de
 * botões em 6 páginas, e assim link novo não passa despercebido.
 */
export function Analytics() {
  const [podeMedir, setPodeMedir] = useState(false);

  useEffect(() => {
    if (!GA4_ID) return;

    capturarAtribuicao(); // origem da 1ª visita da sessão

    const ler = () => {
      try {
        const cru = window.localStorage.getItem("crivo.cookies.v1");
        setPodeMedir(cru ? JSON.parse(cru).medicao === true : false);
      } catch {
        setPodeMedir(false);
      }
    };
    ler();
    // Aceitou com a página já aberta: ativa na hora, sem recarregar.
    window.addEventListener("crivo:consentimento", ler);

    const aoClicar = (ev: MouseEvent) => {
      const alvo = (ev.target as HTMLElement | null)?.closest?.("a");
      if (!alvo) return;
      const href = alvo.getAttribute("href") || "";
      if (/wa\.me|api\.whatsapp\.com/.test(href)) {
        evento(EVENTOS.cliqueWhatsapp, {
          origem: window.location.pathname,
          rotulo: (alvo.textContent || "").trim().slice(0, 60),
        });
      } else if (/app\.crivolegacy\.com\.br/.test(href)) {
        evento(EVENTOS.acessoPortal, { origem: window.location.pathname });
      }
    };
    document.addEventListener("click", aoClicar, true);

    return () => {
      window.removeEventListener("crivo:consentimento", ler);
      document.removeEventListener("click", aoClicar, true);
    };
  }, []);

  if (!GA4_ID || !podeMedir) return null;

  const atribuicao = capturarAtribuicao();
  return (
    <>
      <Script
        id="ga4-lib"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`}
        strategy="afterInteractive"
        onLoad={marcarGtagPronto}
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
gtag('js', new Date());
gtag('config', ${JSON.stringify(GA4_ID)}, ${JSON.stringify({
          anonymize_ip: true,
          ...atribuicao,
        })});`}
      </Script>
    </>
  );
}
