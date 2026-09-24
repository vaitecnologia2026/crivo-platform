"use client";

import type { ReactNode } from "react";
import { portalNavigate, usePortal } from "@/lib/portal-shell";
import { IconChevronRight } from "./Icons";

/**
 * Faixa de contexto da barra superior — a linha EMPRESA · UNIDADE · CICLO ·
 * PERFIL · CONTRATAÇÃO do protótipo Lovable, só com o que é REAL hoje:
 *
 * - Empresa: a da sessão. Trocar de empresa exige outro login (a senha escolhe
 *   a conta), então não é um seletor; quem tem o Consolidado do Grupo ganha o
 *   atalho para ele.
 * - Perfil: o papel de quem está logado. No protótipo era um simulador de
 *   perfil para demonstração — aqui não existe "ver como outro papel".
 * - Contratação: as soluções do contrato ativo, com atalho para Minha
 *   Contratação. Também era simulador no protótipo.
 *
 * Unidade e Ciclo entram na 2ª etapa, já filtrando os resultados de verdade
 * (hoje nenhum endpoint de resultado aceita esses filtros).
 */
export function TopbarContext() {
  const { session } = usePortal();
  if (!session) return null;
  // null = a consulta do contrato falhou: "—", e não uma afirmação falsa.
  const contratos =
    session.contracted === null
      ? "—"
      : session.contracted.length
        ? session.contracted.join(" + ")
        : "Sem contrato ativo";
  return (
    <div className="topbar-context" role="group" aria-label="Contexto do portal">
      <Field label="Empresa" wide>
        <span className="ctx-value" title={session.orgName ?? undefined}>
          {session.orgName ?? "—"}
        </span>
        {session.hasGroup && (
          <button type="button" className="ctx-link" onClick={() => portalNavigate("grupo")}>
            Consolidado do grupo <IconChevronRight size={12} />
          </button>
        )}
      </Field>
      <Field label="Perfil" optional>
        <span className="ctx-value">{session.roleLabel ?? "—"}</span>
      </Field>
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
    </div>
  );
}

function Field({
  label,
  children,
  wide,
  optional,
}: {
  label: string;
  children: ReactNode;
  /** Pode crescer mais (nome de empresa/solução). */
  wide?: boolean;
  /** Some em tela de celular — lá só a empresa fica. */
  optional?: boolean;
}) {
  return (
    <div className={`ctx-field${wide ? " ctx-field--wide" : ""}${optional ? " ctx-field--optional" : ""}`}>
      <span className="ctx-label">{label}</span>
      {children}
    </div>
  );
}
