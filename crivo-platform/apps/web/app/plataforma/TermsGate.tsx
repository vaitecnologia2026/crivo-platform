"use client";

import { useEffect, useState } from "react";
import { acceptTerms, getTerms } from "@/lib/api";

/**
 * Gate de aceite de termos/LGPD no 1º acesso (Briefing · Matriz §Confidencialidade).
 * Após o login (token presente), bloqueia o portal até o usuário aceitar a versão
 * vigente dos termos. Registra o aceite + versão no backend.
 */
export function TermsGate() {
  const [needsAccept, setNeedsAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

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

  return (
    <div className="terms-gate">
      <div className="terms-card">
        <span className="eyebrow eyebrow--terra">Primeiro acesso · LGPD</span>
        <h2>Termos de uso e proteção de dados</h2>
        <div className="terms-body">
          <p>
            Ao acessar a plataforma CRIVO™, você concorda com o tratamento de dados conforme a LGPD.
            A CRIVO atua como apoio técnico, gerencial e documental à gestão dos fatores psicossociais
            relacionados ao trabalho.
          </p>
          <ul>
            <li>Dados individuais sensíveis não são expostos à empresa — apenas indicadores agregados e elegíveis.</li>
            <li>O ICD / Radar da Decisão é ferramenta de desenvolvimento da liderança, não avaliação de performance.</li>
            <li>Recortes por área/grupo respeitam um volume mínimo de respondentes.</li>
            <li>A revisão, validação e integração formal de documentos (AEP/PGR) são de responsabilidade da empresa
              e/ou do responsável técnico.</li>
          </ul>
          <p>
            Seus dados são tratados com confidencialidade, finalidade específica e segurança, podendo você exercer
            seus direitos de titular a qualquer momento.
          </p>
        </div>
        <button className="btn btn--terra btn--block" disabled={saving} onClick={accept}>
          {saving ? "Registrando…" : "Li e aceito os termos e a política de privacidade"}
        </button>
      </div>
    </div>
  );
}
