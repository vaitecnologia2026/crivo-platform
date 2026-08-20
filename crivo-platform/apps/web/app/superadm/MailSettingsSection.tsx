"use client";

import { useEffect, useState } from "react";
import type { MailSettingsData } from "@crivo/types";
import { getMailSettings, saveMailSettings } from "../../lib/admin-api";

/** Rótulo de quem está enviando agora — o operador não pode ficar na dúvida. */
const SOURCE_LABEL: Record<MailSettingsData["activeSource"], string> = {
  painel: "conta configurada aqui",
  ambiente: "variáveis do servidor (SMTP_*)",
  nenhum: "nenhum provedor configurado",
};

/**
 * Governança · E-mail de envio — conta que dispara as mensagens da plataforma:
 * a SENHA de acesso do cliente e o Relatório Preliminar com o E-BOOK em anexo
 * (mais o convite de campanha do ICD, que sai pelo mesmo transporte).
 *
 * A senha da conta nunca é exibida nem devolvida pelo servidor: o campo abre
 * vazio e, deixado em branco, mantém a senha já gravada.
 */
export function MailSettingsSection() {
  const [data, setData] = useState<MailSettingsData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(465);
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  function fill(d: MailSettingsData) {
    setData(d);
    setEnabled(d.enabled);
    setHost(d.host);
    setPort(d.port);
    setSecure(d.secure);
    setUsername(d.username);
    setFromName(d.fromName ?? "");
    setFromEmail(d.fromEmail);
    setPassword(""); // nunca preenchida de volta
  }

  async function refresh() {
    try {
      fill(await getMailSettings());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar a configuração.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save() {
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const saved = await saveMailSettings({
        enabled,
        host: host.trim(),
        port,
        secure,
        username: username.trim(),
        password: password.trim() || undefined,
        fromName: fromName.trim() || null,
        fromEmail: fromEmail.trim(),
      });
      fill(saved);
      setOkMsg(
        saved.enabled
          ? `Conta autenticada e salva. As mensagens passam a sair de ${saved.activeFrom}.`
          : "Conta salva, porém desligada — as mensagens continuam saindo pelas variáveis do servidor.",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar a configuração.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="route__head">
        <div>
          <h1 className="page-title">E-mail de envio</h1>
          <p className="page-sub">
            Conta que dispara as mensagens da plataforma: a <strong>senha de acesso</strong> enviada
            ao cliente e o <strong>Relatório Preliminar com o e-book</strong> em anexo.
          </p>
        </div>
      </div>

      <div className="adm-callout">
        <strong>Vale para todo e-mail que a plataforma envia.</strong> As três mensagens que saem
        por esta conta hoje são a senha de acesso do cliente, o Relatório Preliminar com o e-book e
        o convite de campanha do ICD — todas usam o mesmo transporte. Enquanto esta conta estiver{" "}
        <strong>desligada</strong>, o envio continua pelas variáveis do servidor, como antes.
      </div>

      {err && <div className="dash-state dash-state--error">{err}</div>}
      {okMsg && <div className="pu-temp">{okMsg}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__head">
          <div>
            <h3>Quem envia agora</h3>
            <span className="card__sub">Estado atual, antes de qualquer alteração.</span>
          </div>
        </div>

        {!loaded && <p className="dash-state">Carregando…</p>}

        {loaded && data && (
          <table className="data-table">
            <tbody>
              <tr>
                <th style={{ width: 220 }}>Origem</th>
                <td>
                  <span
                    className={`ct-pill ${data.activeSource === "nenhum" ? "ct-pill--suspenso" : "ct-pill--ativo"}`}
                  >
                    {SOURCE_LABEL[data.activeSource]}
                  </span>
                </td>
              </tr>
              <tr>
                <th>Remetente</th>
                <td className="cell-mute">{data.activeFrom ?? "—"}</td>
              </tr>
              <tr>
                <th>Senha gravada aqui</th>
                <td className="cell-mute">
                  {data.passwordHint ? `••••${data.passwordHint}` : "nenhuma"}
                </td>
              </tr>
              <tr>
                <th>Última alteração</th>
                <td className="cell-mute">
                  {data.updatedAt ? new Date(data.updatedAt).toLocaleString("pt-BR") : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h3>Configurar conta</h3>
            <span className="card__sub">
              Ao salvar, o servidor autentica no provedor antes de gravar — configuração que não
              conecta não é aceita.
            </span>
          </div>
        </div>

        <div className="ct-form">
          <label className="prod-field">
            <span>Servidor SMTP</span>
            <input
              value={host}
              placeholder="smtp.hostinger.com"
              onChange={(e) => setHost(e.target.value)}
            />
          </label>
          <label className="prod-field">
            <span>Porta</span>
            <input
              type="number"
              value={port}
              min={1}
              max={65535}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </label>
          <label className="prod-field">
            <span>Conexão</span>
            <select
              value={secure ? "ssl" : "starttls"}
              onChange={(e) => setSecure(e.target.value === "ssl")}
            >
              <option value="ssl">SSL/TLS (porta 465)</option>
              <option value="starttls">STARTTLS (porta 587)</option>
            </select>
          </label>
          <label className="prod-field">
            <span>Usuário</span>
            <input
              value={username}
              placeholder="contato@crivolegacy.com.br"
              autoComplete="off"
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="prod-field">
            <span>Senha {data?.configured ? "(em branco mantém a atual)" : ""}</span>
            <input
              type="password"
              value={password}
              placeholder={data?.configured ? "••••••••" : "senha da conta de e-mail"}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="prod-field">
            <span>Nome do remetente</span>
            <input
              value={fromName}
              placeholder="CRIVO"
              onChange={(e) => setFromName(e.target.value)}
            />
          </label>
          <label className="prod-field">
            <span>E-mail do remetente</span>
            <input
              type="email"
              value={fromEmail}
              placeholder="contato@crivolegacy.com.br"
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </label>
          <label className="prod-field">
            <span>Usar esta conta</span>
            <select
              value={enabled ? "sim" : "nao"}
              onChange={(e) => setEnabled(e.target.value === "sim")}
            >
              <option value="sim">Sim — enviar por esta conta</option>
              <option value="nao">Não — usar as variáveis do servidor</option>
            </select>
          </label>
          <button className="btn btn--terra btn--sm" disabled={busy} onClick={save}>
            {busy ? "Autenticando e salvando…" : "Salvar conta"}
          </button>
        </div>

        <p className="cnae-muted" style={{ marginTop: 12 }}>
          O e-mail do remetente normalmente precisa ser{" "}
          <strong>o mesmo do usuário autenticado</strong>: provedores como a Hostinger recusam
          mensagem cujo remetente seja de domínio não autenticado.
        </p>
      </div>
    </div>
  );
}
