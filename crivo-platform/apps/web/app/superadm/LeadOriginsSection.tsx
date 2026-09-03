"use client";

import { useEffect, useState } from "react";
import type { PlatformLeadOriginOption } from "@crivo/types";
import { listLeadOrigins, removeLeadOrigin, upsertLeadOrigin } from "@/lib/admin-api";

/**
 * "Google Ads" → "GOOGLE_ADS". É a MESMA normalização do backend
 * (`LeadOriginsService.normalize`), repetida aqui só para PREVISUALIZAR o código
 * enquanto se digita o nome. Quem decide continua sendo o servidor — se as duas
 * divergirem, vale a do servidor, que é a que grava.
 */
function toCode(nome: string): string {
  return nome
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * Governança · Origens e Canais — cadastro das origens do lead.
 *
 * A lista tem dois tipos de linha, e a diferença importa:
 *  • EMBUTIDA — vem do código (`PLATFORM_LEAD_ORIGINS`). Pode ser renomeada e
 *    desativada, nunca excluída: ela não teria como voltar pela tela.
 *  • CADASTRADA — criada aqui. Pode tudo, inclusive excluir — desde que nenhum
 *    lead a esteja usando (aí o servidor recusa e manda desativar).
 *
 * Desativar é a saída segura em ambos os casos: tira do seletor do CRM e mantém o
 * nome de quem já veio por aquele canal.
 */
export function LeadOriginsSection() {
  const [origins, setOrigins] = useState<PlatformLeadOriginOption[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [editing, setEditing] = useState<PlatformLeadOriginOption | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try {
      setOrigins(await listLeadOrigins());
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void refresh(); }, []);

  const rows = origins ?? [];

  /** Liga/desliga a origem no seletor do CRM sem abrir o formulário. */
  async function toggleActive(o: PlatformLeadOriginOption) {
    setBusy(o.value);
    try {
      await upsertLeadOrigin(o.value, { label: o.label, active: !o.active });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao alterar a origem");
    } finally {
      setBusy(null);
    }
  }

  async function remove(o: PlatformLeadOriginOption) {
    if (!confirm(`Excluir a origem "${o.label}" do cadastro?`)) return;
    setBusy(o.value);
    try {
      await removeLeadOrigin(o.value);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="route__head">
        <div>
          <h1 className="page-title">Origens e Canais</h1>
          <p className="page-sub">
            De onde vêm os leads. O que estiver ativo aqui aparece no seletor
            “Origem / canal” do CRM — Funil e nos painéis de conversão por origem.
          </p>
        </div>
        <button className="btn btn--sm sol-newbtn" onClick={() => setEditing("new")}>
          Nova origem
        </button>
      </div>

      {status === "loading" && <p className="dash-state">Carregando origens…</p>}
      {status === "error" && (
        <div className="dash-state dash-state--error">Não foi possível carregar as origens.</div>
      )}

      {status === "ok" && (
        <>
          <div className="addx-wrap">
            {/* min-width zerado: a tabela de Adicionais tem 11 colunas e reserva
                1240px; esta tem 5 e não precisa de rolagem lateral. */}
            <table className="addx-table" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Origem / canal</th>
                  <th>Código gravado no lead</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.value}>
                    <td className="addx-name"><strong>{o.label}</strong></td>
                    <td><span className="addx-code">{o.value}</span></td>
                    <td>{o.builtin ? "Embutida" : "Cadastrada"}</td>
                    <td>
                      {o.active ? (
                        <span className="addx-status addx-status--ATIVO">Ativa</span>
                      ) : (
                        <span
                          className="addx-status"
                          style={{ background: "rgba(13,31,60,0.06)", color: "var(--text-sec)" }}
                        >
                          Inativa
                        </span>
                      )}
                    </td>
                    <td className="addx-actions">
                      <button type="button" disabled={busy === o.value} onClick={() => setEditing(o)}>
                        Editar
                      </button>
                      <button type="button" disabled={busy === o.value} onClick={() => toggleActive(o)}>
                        {o.active ? "Desativar" : "Ativar"}
                      </button>
                      {/* Embutida não sai: ela vem do código e não teria como voltar
                          pela tela. Para tirá-la do seletor, use Desativar. */}
                      {!o.builtin && (
                        <button
                          type="button"
                          className="is-danger"
                          disabled={busy === o.value}
                          onClick={() => remove(o)}
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="addx-empty">
                      Nenhuma origem cadastrada. Crie a primeira em “Nova origem”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="crm-rules">
            <span className="crm-panel__title">Regras desta tela</span>
            <p>
              O lead guarda o <strong>código</strong>, não o nome. Por isso renomear uma origem
              muda o rótulo em todos os leads que já vieram por ela — e excluir uma origem em uso
              faria o funil voltar a exibir o código cru. É por isso que o sistema{" "}
              <strong>recusa a exclusão de origem em uso</strong> e oferece{" "}
              <strong>desativar</strong>: some do seletor, o histórico continua com nome.
            </p>
            <p>
              Origens <strong>embutidas</strong> vêm do código da plataforma e não podem ser
              excluídas — só renomeadas ou desativadas. Leads antigos com origens legadas
              (“lp-diagnostico”, “qrcode”) continuam válidos mesmo sem cadastro aqui: este é o
              catálogo do seletor, não uma restrição do banco.
            </p>
          </div>
        </>
      )}

      {editing && (
        <OriginModal
          origin={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh(); }}
        />
      )}
    </>
  );
}

/** Cadastro/edição de uma origem. No cadastro o código é derivado do nome; na
 *  edição ele fica travado, porque é o que já está gravado nos leads. */
function OriginModal({
  origin,
  onClose,
  onSaved,
}: {
  origin: PlatformLeadOriginOption | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(origin?.label ?? "");
  const [active, setActive] = useState(origin?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const novo = origin === null;
  const code = novo ? toCode(label) : origin.value;
  const podeSalvar = label.trim().length > 0 && code.length >= 2;

  async function salvar() {
    if (!podeSalvar) return;
    setSaving(true);
    setError(null);
    try {
      await upsertLeadOrigin(code, { label: label.trim(), active });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar a origem");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
    {/* Clique fora NAO fecha: modal com formulario — fechar por engano apagava o que ja tinha sido digitado. Sai pelo X ou pelo Cancelar. */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h2>{novo ? "Nova origem" : "Editar origem"}</h2>
          <button className="icon-btn" onClick={onClose} title="Fechar">✕</button>
        </header>

        <div className="modal__body">
          <label className="prod-field prod-field--full">
            <span>Nome da origem / canal</span>
            <input
              type="text"
              value={label}
              maxLength={80}
              autoFocus
              placeholder="Ex.: Instagram, Google Ads, Feira do Setor"
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>

          <label className="prod-field prod-field--full" style={{ marginTop: 12 }}>
            <span>Código gravado no lead</span>
            {/* Só leitura nos dois casos: no cadastro ele é derivado do nome; na
                edição é o que já está nos leads e mudá-lo os deixaria órfãos. */}
            <input type="text" value={code} readOnly disabled />
          </label>
          <p className="prod-note">
            {novo
              ? "O código é gerado a partir do nome e é o que fica gravado em cada lead. Depois de criado, ele não muda — o nome, sim."
              : "O código não muda: ele já está gravado nos leads que vieram por esta origem. Renomear altera só o rótulo exibido."}
          </p>

          <label
            className="prod-field prod-field--full"
            style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span style={{ textTransform: "none", letterSpacing: 0 }}>
              Ativa — aparece no seletor “Origem / canal” do CRM
            </span>
          </label>

          {error && <p className="convert-warn">{error}</p>}
        </div>

        <div className="modal__foot">
          <button className="btn btn--outline-dark btn--sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn--terra btn--sm" disabled={saving || !podeSalvar} onClick={salvar}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
