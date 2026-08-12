"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Consentimento de cookies (§13 dos Ajustes Finais).
 *
 * Regras que o documento impõe e que o código garante:
 *  · três saídas no aviso — aceitar, RECUSAR os não necessários e gerenciar;
 *  · recusar é tão fácil quanto aceitar (mesmo peso visual, um clique);
 *  · marketing tem aceite SEPARADO de medição e NENHUM vem pré-marcado;
 *  · dá para rever a escolha quando quiser (link fixo no rodapé).
 *
 * Enquanto não houver aceite, nada opcional roda: quem for plugar medição no
 * futuro deve checar `consentimentoDeCookies()` antes de carregar o script.
 * Estilo inline de propósito — o aviso aparece em todas as rotas, inclusive as
 * legais, que não carregam o CSS da Home.
 */

const CHAVE = "crivo.cookies.v1";
const EVENTO_ABRIR = "crivo:abrir-cookies";

export type ConsentimentoCookies = {
  necessarios: true;
  medicao: boolean;
  marketing: boolean;
  em: string;
};

/** Escolha já registrada, ou null se a pessoa ainda não decidiu. */
export function consentimentoDeCookies(): ConsentimentoCookies | null {
  if (typeof window === "undefined") return null;
  try {
    const cru = window.localStorage.getItem(CHAVE);
    return cru ? (JSON.parse(cru) as ConsentimentoCookies) : null;
  } catch {
    return null;
  }
}

/** Reabre o painel — usado pelo rodapé e pela Política de Cookies. */
export function abrirPreferenciasDeCookies() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR));
}

const TERRA = "#A8693D";
const AZUL = "#0D1F3C";

const CAIXA: CSSProperties = {
  position: "fixed",
  left: 16,
  right: 16,
  bottom: 16,
  zIndex: 9999,
  margin: "0 auto",
  maxWidth: 720,
  background: "#fff",
  color: "#22303F",
  borderRadius: 6,
  borderTop: `3px solid ${TERRA}`,
  boxShadow: "0 18px 48px rgba(13,31,60,.22)",
  padding: "20px 22px",
  font: "15px/1.6 var(--font-body, system-ui, -apple-system, sans-serif)",
};

const BOTAO: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 4,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  border: `1px solid ${AZUL}`,
  background: "transparent",
  color: AZUL,
  fontFamily: "inherit",
};
const BOTAO_PRIMARIO: CSSProperties = { ...BOTAO, background: TERRA, borderColor: TERRA, color: "#fff" };
const LINHA_BOTOES: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 };

export function CookieConsent() {
  const [visivel, setVisivel] = useState(false);
  const [detalhado, setDetalhado] = useState(false);
  // NENHUM pré-marcado: a pessoa liga o que quiser, e o padrão é não consentir.
  const [medicao, setMedicao] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // A escolha vive no localStorage, que não existe no servidor: a leitura tem
    // de acontecer depois da montagem, e é uma sincronização com armazenamento
    // externo — o caso que a regra abre exceção, não uma cascata de renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!consentimentoDeCookies()) setVisivel(true);
    const reabrir = () => {
      const atual = consentimentoDeCookies();
      setMedicao(atual?.medicao ?? false);
      setMarketing(atual?.marketing ?? false);
      setDetalhado(true);
      setVisivel(true);
    };
    window.addEventListener(EVENTO_ABRIR, reabrir);
    return () => window.removeEventListener(EVENTO_ABRIR, reabrir);
  }, []);

  function registrar(escolha: { medicao: boolean; marketing: boolean }) {
    try {
      window.localStorage.setItem(
        CHAVE,
        JSON.stringify({ necessarios: true, ...escolha, em: new Date().toISOString() }),
      );
    } catch {
      // Navegador com armazenamento bloqueado: o aviso reaparece na próxima
      // visita, mas nada opcional é ativado — o padrão continua sendo não.
    }
    // Avisa o resto do app: o Analytics (§15) so carrega o GA4 depois disto.
    window.dispatchEvent(new CustomEvent("crivo:consentimento"));
    setVisivel(false);
    setDetalhado(false);
  }

  if (!visivel) return null;

  return (
    <div style={CAIXA} role="dialog" aria-modal="false" aria-label="Preferências de cookies">
      <strong style={{ display: "block", fontSize: 16, color: AZUL, marginBottom: 6 }}>
        Cookies e privacidade
      </strong>
      <p style={{ margin: 0 }}>
        Usamos cookies necessários para o site funcionar. Os de medição de uso e de marketing só são
        ativados se você aceitar — e você pode mudar de ideia quando quiser. Detalhes na{" "}
        <a href="/politica-de-cookies" style={{ color: TERRA }}>
          Política de Cookies
        </a>
        .
      </p>

      {detalhado && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <Categoria
            titulo="Necessários"
            descricao="Mantêm sua escolha de cookies e o acesso à área logada. Sem eles o site não funciona."
            marcado
            travado
          />
          <Categoria
            titulo="Medição de uso"
            descricao="Ajudam a entender, de forma agregada, quais páginas são acessadas."
            marcado={medicao}
            onChange={setMedicao}
          />
          <Categoria
            titulo="Marketing"
            descricao="Permitem medir campanhas e apresentar conteúdo relacionado. Aceite separado."
            marcado={marketing}
            onChange={setMarketing}
          />
        </div>
      )}

      <div style={LINHA_BOTOES}>
        <button style={BOTAO_PRIMARIO} onClick={() => registrar({ medicao: true, marketing: true })}>
          Aceitar todos
        </button>
        {/* Recusar tem o MESMO peso de aceitar: um clique, botão visível. */}
        <button style={BOTAO} onClick={() => registrar({ medicao: false, marketing: false })}>
          Recusar não necessários
        </button>
        {detalhado ? (
          <button style={BOTAO} onClick={() => registrar({ medicao, marketing })}>
            Salvar preferências
          </button>
        ) : (
          <button style={BOTAO} onClick={() => setDetalhado(true)}>
            Gerenciar preferências
          </button>
        )}
      </div>
    </div>
  );
}

function Categoria({
  titulo,
  descricao,
  marcado,
  travado,
  onChange,
}: {
  titulo: string;
  descricao: string;
  marcado: boolean;
  travado?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 12px",
        border: "1px solid #E4E0D8",
        borderRadius: 4,
        cursor: travado ? "default" : "pointer",
        opacity: travado ? 0.75 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={marcado}
        disabled={travado}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
        style={{ marginTop: 3, accentColor: TERRA }}
      />
      <span>
        <strong style={{ display: "block", fontSize: 14.5, color: AZUL }}>
          {titulo}
          {travado && <span style={{ fontWeight: 400, color: "#5B6B7B" }}> · sempre ativos</span>}
        </strong>
        <span style={{ fontSize: 13.5, color: "#5B6B7B" }}>{descricao}</span>
      </span>
    </label>
  );
}

/** Link "Gerenciar cookies" — reabre o painel de qualquer lugar do site. */
export function GerenciarCookiesLink({ children }: { children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={abrirPreferenciasDeCookies}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        textDecoration: "underline",
      }}
    >
      {children ?? "Gerenciar Cookies"}
    </button>
  );
}
