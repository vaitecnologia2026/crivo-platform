"use client";

import { useEffect, useState } from "react";
import {
  ACTION_RESPONSIBLE_TYPES,
  ACTION_RESPONSIBLE_TYPE_LABEL,
  responsavelVinculado,
  type ActionResponsibleOptions,
  type ActionResponsibleType,
} from "@crivo/types";
import { getActionResponsibleOptions } from "@/lib/api";

// H-008 (decisão CRIVO 28/09/2026): o responsável da ação formal é vinculado a
// um usuário da empresa, a um cargo ou a uma área do cadastro de colaboradores.
// Texto livre só para responsável externo ou exceção (esta com motivo). O
// servidor confere tudo de novo; aqui é só a escolha.

export interface ResponsavelValue {
  type: ActionResponsibleType | "";
  userId: string;
  /** Cargo, área ou nome (externo/exceção). Para USUARIO é preenchido pelo servidor. */
  text: string;
  reason: string;
}

export function responsavelInicial(item?: {
  responsible: string | null;
  responsibleType: ActionResponsibleType | null;
  responsibleUserId: string | null;
  responsibleReason: string | null;
}): ResponsavelValue {
  return {
    type: item?.responsibleType ?? "",
    userId: item?.responsibleUserId ?? "",
    text: item?.responsible ?? "",
    reason: item?.responsibleReason ?? "",
  };
}

/** Campos para a API. Sem tipo: só o texto (legado/sugestão, não aprova). */
export function responsavelPayload(v: ResponsavelValue) {
  if (!v.type) return { responsible: v.text.trim() || undefined };
  return {
    responsibleType: v.type,
    responsibleUserId: v.type === "USUARIO" ? v.userId || null : null,
    responsible: v.type === "USUARIO" ? undefined : v.text.trim() || undefined,
    responsibleReason: v.type === "EXCECAO" ? v.reason.trim() || null : null,
  };
}

/** Mesma regra do servidor para aprovar (USUARIO conta pelo id escolhido). */
export function responsavelProntoParaAprovar(v: ResponsavelValue): boolean {
  return responsavelVinculado({
    responsibleType: v.type || null,
    responsibleUserId: v.userId || null,
    responsible: v.type === "USUARIO" ? (v.userId ? "usuário" : "") : v.text,
    responsibleReason: v.reason,
  });
}

/** Troca de tipo: o cargo/área/usuário do tipo anterior não vale no novo.
 *  Só o texto livre passa adiante entre "sem vínculo", externo e exceção. */
function trocarTipo(v: ResponsavelValue, type: ResponsavelValue["type"]): ResponsavelValue {
  const livre = (t: ResponsavelValue["type"]) => t === "" || t === "EXTERNO" || t === "EXCECAO";
  return {
    type,
    userId: type === "USUARIO" ? v.userId : "",
    text: livre(type) && livre(v.type) ? v.text : "",
    reason: type === "EXCECAO" ? v.reason : "",
  };
}

let cache: Promise<ActionResponsibleOptions> | null = null;
function carregarOpcoes(): Promise<ActionResponsibleOptions> {
  if (!cache) cache = getActionResponsibleOptions().catch((e) => { cache = null; throw e; });
  return cache;
}

export function ResponsavelField({
  value,
  onChange,
  obrigatorio = false,
}: {
  value: ResponsavelValue;
  onChange: (v: ResponsavelValue) => void;
  obrigatorio?: boolean;
}) {
  const [opts, setOpts] = useState<ActionResponsibleOptions | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    carregarOpcoes().then((o) => { if (vivo) setOpts(o); }).catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, []);
  const set = (patch: Partial<ResponsavelValue>) => onChange({ ...value, ...patch });
  const lista = value.type === "CARGO" ? opts?.cargos ?? [] : value.type === "AREA" ? opts?.areas ?? [] : [];
  // Valor legado (texto) que não bate com o cadastro continua visível na lista.
  const listaComAtual = value.text && !lista.includes(value.text) ? [value.text, ...lista] : lista;

  return (
    <>
      <label className="prod-field"><span>Responsável{obrigatorio ? " (obrigatório para aprovar)" : ""}</span>
        <select
          value={value.type}
          onChange={(e) => onChange(trocarTipo(value, e.target.value as ResponsavelValue["type"]))}
        >
          <option value="">{value.text && !value.type ? "Sem vínculo (texto antigo)" : "Escolha o tipo…"}</option>
          {ACTION_RESPONSIBLE_TYPES.map((t) => <option key={t} value={t}>{ACTION_RESPONSIBLE_TYPE_LABEL[t]}</option>)}
        </select>
        {!value.type && value.text && (
          <small className="card__sub">Hoje: “{value.text}”. Para aprovar, vincule a um usuário, cargo ou área.</small>
        )}
      </label>
      {value.type === "USUARIO" && (
        <label className="prod-field"><span>Usuário</span>
          <select value={value.userId} onChange={(e) => set({ userId: e.target.value })}>
            <option value="">{opts ? "Escolha…" : erro ? "Não foi possível carregar" : "Carregando…"}</option>
            {opts?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      )}
      {(value.type === "CARGO" || value.type === "AREA") && (
        <label className="prod-field"><span>{value.type === "CARGO" ? "Cargo" : "Área"} (cadastro de colaboradores)</span>
          <select value={value.text} onChange={(e) => set({ text: e.target.value })}>
            <option value="">{opts ? (lista.length ? "Escolha…" : "Nenhum no cadastro de colaboradores") : erro ? "Não foi possível carregar" : "Carregando…"}</option>
            {listaComAtual.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {(value.type === "EXTERNO" || value.type === "EXCECAO") && (
        <label className="prod-field"><span>{value.type === "EXTERNO" ? "Nome do responsável externo" : "Responsável (exceção)"}</span>
          <input value={value.text} maxLength={160} onChange={(e) => set({ text: e.target.value })} placeholder={value.type === "EXTERNO" ? "Ex.: Consultoria de SST contratada" : "Ex.: Comitê de ergonomia"} />
        </label>
      )}
      {value.type === "EXCECAO" && (
        <label className="prod-field"><span>Motivo da exceção</span>
          <input value={value.reason} maxLength={300} onChange={(e) => set({ reason: e.target.value })} placeholder="Por que não há usuário, cargo ou área do cadastro" />
        </label>
      )}
    </>
  );
}
