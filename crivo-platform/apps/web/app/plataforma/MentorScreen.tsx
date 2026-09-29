"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { canSeeRoute, usePortal } from "@/lib/portal-shell";
import { EIXO_CURTO } from "@/lib/jornada-hoje";
import { eixoMaisFraco, type MeuIcdData } from "@crivo/types";
import { CopilotoChat } from "./CopilotoChat";

/**
 * Minha Jornada › Decidir › Mentor CRIVO (rota `mentor`). A conversa com o
 * Copiloto em destaque. O ICD do próprio líder (GET /icd-cycles/me, a mesma
 * chamada do "Meu ICD") entra só como CONTEXTO da conversa: se não houver ICD,
 * ou a chamada falhar (módulo icd fora do contrato), o Mentor conversa sem ele.
 *
 * A ilha fica montada entre um login e outro na mesma aba; a `key` pela sessão
 * do portal recomeça a tela a cada login — a conversa de uma pessoa nunca
 * aparece para a próxima que entrar no mesmo aparelho.
 */
export function MentorScreen() {
  const { session, sessionSeq } = usePortal();
  if (!session) return null;
  return <Mentor key={sessionSeq} />;
}

/** "sem-icd" = a API respondeu que não há ICD no ciclo; "indisponivel" = não
 *  deu para saber (módulo fora do menu ou chamada falhou) — a tela não afirma nada. */
type Contexto = "carregando" | "com-icd" | "sem-icd" | "indisponivel";

function Mentor() {
  // Sem o "Meu ICD" no menu do contexto (módulo icd fora do contrato), nem
  // pede: seria um 403 no log da API a cada abertura, sem nada a ganhar.
  const portal = usePortal();
  const quer = canSeeRoute("lider", portal);
  const [carga, setCarga] = useState<{ icd: MeuIcdData | null; contexto: Contexto }>({ icd: null, contexto: "carregando" });

  useEffect(() => {
    if (!quer) return;
    let alive = true;
    apiFetch<MeuIcdData | null>("/icd-cycles/me")
      .then((d) => { if (alive) setCarga({ icd: d, contexto: d ? "com-icd" : "sem-icd" }); })
      .catch(() => { if (alive) setCarga({ icd: null, contexto: "indisponivel" }); }); // conversa sem contexto
    return () => { alive = false; };
  }, [quer]);

  const icd = quer ? carga.icd : null;
  const contexto: Contexto = quer ? carga.contexto : "indisponivel";

  const foco = icd ? eixoMaisFraco(icd.icd.axesAverage) : null;

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Mentor CRIVO</h1>
          <p className="page-sub">
            Um espaço para pensar em voz alta antes, durante ou depois de uma decisão difícil.
          </p>
        </div>
      </div>

      {contexto !== "carregando" && (
        <p className="card__sub" style={{ margin: "0 0 4px" }}>
          {contexto === "com-icd"
            ? `O Mentor considera o seu ICD atual (nota, faixa e eixos)${foco ? ` — foco do ciclo em ${EIXO_CURTO[foco]}` : ""}.`
            : contexto === "sem-icd"
              ? "Você ainda não tem ICD no ciclo: o Mentor conversa sem esse contexto."
              : "O Mentor conversa sem o contexto do seu ICD."}
        </p>
      )}

      <CopilotoChat
        icd={icd}
        titulo="Converse com o Mentor"
        subtitulo="Apoio reflexivo de coerência decisória — não é diagnóstico clínico."
      />

      <p className="dash-privacy" role="note">
        <strong>Privacidade — </strong>
        Esta conversa não é gravada e não aparece para a empresa: fica só nesta tela e se apaga quando você sai
        do CRIVO ou recarrega a página. O Mentor apoia e questiona o seu raciocínio; ele não decide por você.
      </p>
    </>
  );
}
