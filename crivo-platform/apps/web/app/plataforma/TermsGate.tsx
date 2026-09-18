"use client";

import { useEffect, useState } from "react";
import { acceptTerms, getTerms } from "@/lib/api";

/**
 * Gate de aceite de termos/LGPD no 1º acesso (Briefing · Matriz §Confidencialidade).
 * Após o login (token presente), bloqueia o portal até o usuário aceitar a versão
 * vigente dos termos. Registra o aceite + versão no backend.
 *
 * UNIVERSAL e VERSIONADO (homologação 17/09): o texto vale para qualquer
 * solução/papel — a versão anterior falava de ICD e AEP/PGR como se toda
 * empresa os tivesse — e aponta para os Termos de Uso e a Política de
 * Privacidade completos, com a versão vigente à vista. Quem já aceitou uma
 * versão antiga vê que os termos mudaram, em vez de um "primeiro acesso".
 */
export function TermsGate() {
  const [needsAccept, setNeedsAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const [versao, setVersao] = useState<{ atual: string; aceita: string | null }>({ atual: "", aceita: null });

  useEffect(() => {
    let alive = true;
    async function check() {
      const token = typeof window !== "undefined" ? localStorage.getItem("crivo_token") : null;
      if (!token) { if (alive) { setNeedsAccept(false); setCheckedFor(null); } return; }
      if (token === checkedFor) return; // já verificado p/ esta sessão
      try {
        const s = await getTerms();
        if (!alive) return;
        setCheckedFor(token);
        setNeedsAccept(!s.accepted);
        setVersao({ atual: s.currentVersion, aceita: s.acceptedVersion });
      } catch {
        /* silencioso: erro de rede não bloqueia */
      }
    }
    void check();
    const id = setInterval(check, 1500);
    return () => { alive = false; clearInterval(id); };
  }, [checkedFor]);

  if (!needsAccept) return null;

  async function accept() {
    setSaving(true);
    try {
      await acceptTerms();
      setNeedsAccept(false);
    } catch {
      alert("Não foi possível registrar o aceite. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const atualizado = !!versao.aceita && versao.aceita !== versao.atual;
  return (
    <div className="terms-gate">
      <div className="terms-card">
        <span className="eyebrow eyebrow--terra">
          {atualizado ? "Termos atualizados · LGPD" : "Primeiro acesso · LGPD"}
          {versao.atual ? ` · versão ${versao.atual}` : ""}
        </span>
        <h2>Termos de uso e proteção de dados</h2>
        <div className="terms-body">
          {atualizado && (
            <p>
              <strong>Os termos foram atualizados</strong> (você aceitou a versão {versao.aceita}). Leia a versão
              vigente e registre o novo aceite para continuar.
            </p>
          )}
          <p>
            Ao acessar a plataforma CRIVO™, você declara ter lido e aceito os{" "}
            <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e a{" "}
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>,
            e concorda com o tratamento de dados pessoais conforme a LGPD (Lei 13.709/2018).
          </p>
          <ul>
            <li>Respostas individuais a diagnósticos são anônimas: a empresa recebe apenas indicadores agregados,
              e recortes por área/grupo respeitam um volume mínimo de respondentes.</li>
            <li>Os dados são tratados com finalidade específica, confidencialidade e segurança; você pode exercer
              seus direitos de titular (acesso, correção, exclusão) a qualquer momento.</li>
            <li>Os documentos gerados pela plataforma têm caráter técnico e documental; a validação e o uso formal
              são de responsabilidade da empresa e do seu responsável técnico.</li>
          </ul>
          <p>
            Estes termos valem para todos os usuários da plataforma, independentemente da solução contratada ou
            do papel de acesso. O aceite fica registrado com data e versão.
          </p>
        </div>
        <button className="btn btn--terra btn--block" disabled={saving} onClick={accept}>
          {saving ? "Registrando…" : `Li e aceito os Termos de Uso e a Política de Privacidade${versao.atual ? ` (versão ${versao.atual})` : ""}`}
        </button>
      </div>
    </div>
  );
}
