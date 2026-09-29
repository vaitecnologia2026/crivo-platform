"use client";

import type { ReactNode } from "react";
import { CLIENT_CONTEXT_LABEL, ROLE_LABELS } from "@crivo/types";
import { portalNavigate, portalSwitchContext, usePortal } from "@/lib/portal-shell";
import { IconChevronRight } from "./Icons";

/**
 * Faixa de contexto da barra superior — a linha EMPRESA · UNIDADE · CICLO ·
 * PERFIL · CONTRATAÇÃO do protótipo Lovable, só com o que é REAL hoje:
 *
 * - Contexto (Spec V1 v1.2 §3): em qual dos dois contextos a pessoa está —
 *   Minha Jornada ou Área da Organização. Quem tem os dois ganha o seletor
 *   explícito "Minha Jornada | Área da Organização" (troca o menu, a home e a
 *   identificação; não troca o login). Não é opcional: aparece no celular.
 * - Empresa: a da sessão. Trocar de empresa exige outro login (a senha escolhe
 *   a conta), então não é um seletor; quem tem o Consolidado do Grupo ganha o
 *   atalho para ele (só na Área da Organização).
 * - Perfil: o papel de quem está logado — em Minha Jornada, "Líder". No
 *   protótipo era um simulador de perfil para demonstração — aqui não existe
 *   "ver como outro papel".
 * - Contratação: as soluções do contrato ativo, com atalho para Minha
 *   Contratação. É da Área da Organização: some em Minha Jornada.
 *
 * Unidade e Ciclo entram na 2ª etapa, já filtrando os resultados de verdade
 * (hoje nenhum endpoint de resultado aceita esses filtros).
 */
export function TopbarContext() {
  const { session } = usePortal();
  if (!session) return null;
  const naJornada = session.context === "JORNADA";
  // null = a consulta do contrato falhou: "—", e não uma afirmação falsa.
  const contratos =
    session.contracted === null
      ? "—"
      : session.contracted.length
        ? session.contracted.join(" + ")
        : "Sem contrato ativo";
  const perfil = naJornada ? ROLE_LABELS.LIDER : session.roleLabel;
  const doisContextos = session.contexts.length > 1;
  return (
    <div className="topbar-context" role="group" aria-label="Contexto do portal">
      <Field label="Contexto" extra={`ctx-field--context${doisContextos ? " ctx-field--switch" : ""}`}>
        {doisContextos ? (
          <div className="ctx-switch" role="group" aria-label="Trocar de contexto">
            {session.contexts.map((c) => {
              const ativo = c === session.context;
              return (
                <button
                  key={c}
                  type="button"
                  className={`ctx-switch__opt${ativo ? " is-active" : ""}`}
                  aria-pressed={ativo}
                  title={CLIENT_CONTEXT_LABEL[c]}
                  onClick={() => {
                    if (!ativo) portalSwitchContext(c);
                  }}
                >
                  {CLIENT_CONTEXT_LABEL[c]}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="ctx-value ctx-value--context">{CLIENT_CONTEXT_LABEL[session.context]}</span>
        )}
      </Field>
      <Field label="Empresa" wide>
        <span className="ctx-value" title={session.orgName ?? undefined}>
          {session.orgName ?? "—"}
        </span>
        {!naJornada && session.hasGroup && (
          <button type="button" className="ctx-link" onClick={() => portalNavigate("grupo")}>
            Consolidado do grupo <IconChevronRight size={12} />
          </button>
        )}
      </Field>
      <Field label="Perfil" optional>
        <span className="ctx-value">{perfil ?? "—"}</span>
      </Field>
      {!naJornada && (
        <Field label="Contratação" optional wide>
          <button
            type="button"
            className="ctx-value ctx-value--link"
            title={`${contratos} — ver minha contratação`}
            aria-label={`Contratação: ${contratos}. Ver minha contratação`}
            onClick={() => portalNavigate("contratacao")}
          >
            <span className="ctx-value__text">{contratos}</span>
            <IconChevronRight size={12} />
          </button>
        </Field>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  wide,
  optional,
  extra,
}: {
  label: string;
  children: ReactNode;
  /** Pode crescer mais (nome de empresa/solução). */
  wide?: boolean;
  /** Some em tela de celular — lá só o contexto e a empresa ficam. */
  optional?: boolean;
  /** Classes a mais do campo (ex.: o seletor de contexto). */
  extra?: string;
}) {
  return (
    <div className={`ctx-field${wide ? " ctx-field--wide" : ""}${optional ? " ctx-field--optional" : ""}${extra ? ` ${extra}` : ""}`}>
      <span className="ctx-label">{label}</span>
      {children}
    </div>
  );
}
