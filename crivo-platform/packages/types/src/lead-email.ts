// ── E-mail de retorno do MAPA Executivo ─────────────────────────────────────

/**
 * Layout único do e-mail que o lead recebe depois de responder o MAPA
 * Executivo na landing page.
 *
 * Vive aqui porque DOIS remetentes o usam: a API (envio principal, com o MAPA
 * em PDF e o e-book anexados) e o site (rede de segurança, quando a plataforma
 * está fora do ar). Antes eram dois HTML diferentes — o mesmo lead podia
 * receber duas identidades visuais distintas.
 *
 * Regras fechadas pelo cliente no comparativo "antes/depois" (2026-09-04):
 * 1. logo oficial CRIVO no cabeçalho;
 * 2. título "MAPA Executivo CRIVO™ | Sua leitura preliminar";
 * 3. corpo enxuto — índice + leitura + anexos (a leitura escrita vai no PDF);
 * 4. CTA principal "CONHECER A CRIVO", para o site institucional;
 * 5. nota técnica curta no rodapé, com os contatos institucionais.
 */
export interface LeadEmailAttachmentLine {
  /** Nome do anexo, em destaque. */
  label: string;
  /** Complemento na mesma linha (opcional). */
  detail?: string;
}

export interface LeadEmailOptions {
  firstName: string;
  company?: string | null;
  /** Índice preliminar 0–100. Ausente = o bloco do índice não sai. */
  score?: number | null;
  /** Rótulo da faixa em que o índice caiu (vem do Motor de Diagnósticos). */
  bandLabel?: string | null;
  /** Anexos realmente presentes. Nunca prometer arquivo que não foi junto. */
  attachments?: LeadEmailAttachmentLine[];
  /** Nota técnica do rodapé — texto editável no super admin. */
  note?: string | null;
  siteUrl?: string;
  logoUrl?: string;
}

const NAVY = '#0d1f3c';
const TERRA = '#a8693d';
const AREIA = '#f4f1ec';
const LINHA = '#e3ded4';

/** Acima disso o índice indica sustentação, não ponto de atenção. */
const SCORE_BOM = 70;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 51 vira "51"; 51,3 vira "51,3". O lead não precisa ver "51.30". */
const num = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');

/**
 * A frase de leitura acompanha a faixa.
 *
 * O texto fixo "sua leitura indica pontos de atenção" era o defeito que o
 * cliente marcou como "resultado contraditório": saía igual para quem tirou
 * 100/100.
 */
export function leituraDoIndice(score: number): string {
  return score >= SCORE_BOM
    ? 'Sua leitura indica boa consistência na maior parte das dimensões avaliadas. ' +
        'O relatório anexo mostra onde a estrutura já sustenta a operação e quais temas ' +
        'ainda merecem ser aprofundados.'
    : 'Sua leitura indica pontos de atenção relevantes em algumas das dimensões avaliadas. ' +
        'O relatório anexo mostra onde esses sinais aparecem com maior intensidade e quais ' +
        'temas merecem ser aprofundados.';
}

export const LEAD_EMAIL_SITE_URL = 'https://crivolegacy.com.br';
export const LEAD_EMAIL_LOGO_URL = 'https://crivolegacy.com.br/imagens/crivo-marca-email.png';
export const LEAD_EMAIL_CONTATO = 'contato@crivolegacy.com.br';

/** Assunto único dos dois remetentes. */
export function leadEmailSubject(company?: string | null): string {
  const empresa = (company ?? '').trim();
  return empresa ? `Seu MAPA Executivo CRIVO — ${empresa}` : 'Seu MAPA Executivo CRIVO';
}

/** Versão texto puro — alternativa do multipart, para cliente sem HTML. */
export function renderLeadEmailText(o: LeadEmailOptions): string {
  const empresa = (o.company ?? '').trim();
  const linhas = [
    `Olá, ${o.firstName}.`,
    '',
    'Seu MAPA Executivo CRIVO foi concluído.',
    'A partir das respostas sobre gestão, liderança, cultura, execução, riscos e governança, ' +
      `organizamos uma primeira leitura dos sinais da ${empresa || 'sua empresa'}.`,
  ];
  const anexos = o.attachments ?? [];
  if (anexos.length) {
    linhas.push('', 'Em anexo, você recebe:');
    for (const a of anexos) linhas.push(`- ${a.label}${a.detail ? `, ${a.detail}` : ''}`);
  }
  if (o.score != null) {
    linhas.push(
      '',
      `Seu índice preliminar: ${num(o.score)}/100` +
        (o.bandLabel ? ` — Leitura: ${o.bandLabel}` : ''),
      leituraDoIndice(o.score),
    );
  }
  linhas.push('', `Conheça a CRIVO: ${o.siteUrl ?? LEAD_EMAIL_SITE_URL}`);
  if (o.note) linhas.push('', o.note);
  linhas.push('', `CRIVO — ${LEAD_EMAIL_SITE_URL} · ${LEAD_EMAIL_CONTATO}`);
  return linhas.join('\n');
}

export function renderLeadEmailHtml(o: LeadEmailOptions): string {
  const site = o.siteUrl ?? LEAD_EMAIL_SITE_URL;
  const logo = o.logoUrl ?? LEAD_EMAIL_LOGO_URL;
  const empresa = esc((o.company ?? '').trim());
  const anexos = o.attachments ?? [];

  const listaAnexos = anexos.length
    ? `<p style="margin:22px 0 8px;font:14px/1.7 Arial,sans-serif;color:#3c4356">Em anexo, você recebe:</p>
        <ul style="margin:0;padding-left:20px;font:14px/1.75 Arial,sans-serif;color:#3c4356">${anexos
          .map(
            (a) =>
              `<li style="margin-bottom:4px"><strong style="color:${NAVY}">${esc(a.label)}</strong>${
                a.detail ? `, ${esc(a.detail)}` : ''
              }</li>`,
          )
          .join('')}</ul>`
    : '';

  const blocoIndice =
    o.score != null
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 4px">
          <tr><td style="background:${AREIA};border-radius:14px;padding:22px 26px;text-align:center">
            <div style="font:600 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b7488">Seu índice preliminar</div>
            <div style="margin-top:6px;font:700 42px/1 Georgia,serif;color:${NAVY}">${num(
              o.score,
            )}<span style="font:400 22px Georgia,serif;color:#8a92a6"> / 100</span></div>
            ${
              o.bandLabel
                ? `<div style="margin-top:8px;font:14px Arial,sans-serif;color:${NAVY}">Leitura: <strong>${esc(
                    o.bandLabel,
                  )}</strong></div>`
                : ''
            }
            <p style="margin:12px 0 0;font:13px/1.65 Arial,sans-serif;color:#5a6172">${leituraDoIndice(
              o.score,
            )}</p>
          </td></tr></table>`
      : '';

  const notaTecnica = o.note
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0">
        <tr><td style="background:#f7f8fa;border:1px solid ${LINHA};border-radius:12px;padding:16px 18px">
          <div style="font:700 13px Arial,sans-serif;color:${NAVY};margin-bottom:5px">Sobre esta leitura</div>
          <p style="margin:0;font:12px/1.65 Arial,sans-serif;color:#5a6172">${esc(o.note)}</p>
        </td></tr></table>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>MAPA Executivo CRIVO</title></head>
<body style="margin:0;background:${AREIA};padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(13,31,60,.08)">

      <tr><td style="background:${NAVY};padding:22px 30px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
          <td width="52" valign="middle"><img src="${logo}" width="44" height="40" alt="CRIVO" style="display:block;border:0;outline:none"/></td>
          <td valign="middle" style="padding-right:16px;border-right:1px solid rgba(255,255,255,.22)">
            <div style="font:700 20px/1 Georgia,serif;color:#fff;letter-spacing:.06em">CRIVO</div>
            <div style="margin-top:3px;font:600 8px Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#9fb0cd">Decision Intelligence</div>
          </td>
          <td valign="middle" style="padding-left:16px">
            <div style="font:600 15px Arial,sans-serif;color:#fff">MAPA Executivo CRIVO&#8482;</div>
            <div style="margin-top:2px;font:13px Arial,sans-serif;color:#9fb0cd">Sua leitura preliminar</div>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:28px 30px 0">
        <p style="margin:0 0 14px;font:700 16px Arial,sans-serif;color:${NAVY}">Olá, ${esc(
          o.firstName,
        )}.</p>
        <p style="margin:0 0 10px;font:14px/1.7 Arial,sans-serif;color:#3c4356">Seu <strong>MAPA Executivo CRIVO&#8482;</strong> foi concluído.</p>
        <p style="margin:0;font:14px/1.7 Arial,sans-serif;color:#3c4356">A partir das respostas sobre gestão, liderança, cultura, execução, riscos e governança, organizamos uma primeira leitura dos sinais da <strong>${
          empresa || 'sua empresa'
        }</strong>.</p>
        ${listaAnexos}
        ${blocoIndice}
      </td></tr>

      <tr><td align="center" style="padding:18px 30px 4px">
        <a href="${site}" style="display:inline-block;background:${TERRA};color:#fff;text-decoration:none;font:700 14px Arial,sans-serif;letter-spacing:.06em;padding:14px 34px;border-radius:8px">CONHECER A CRIVO</a>
        <p style="margin:12px 0 0;font:13px/1.6 Arial,sans-serif;color:#6b7488">Veja como a CRIVO atua em liderança, gestão, diagnóstico,<br/>execução e evolução organizacional.</p>
      </td></tr>

      <tr><td style="padding:6px 30px 0">${notaTecnica}</td></tr>

      <tr><td style="padding:22px 30px 28px">
        <div style="border-top:1px solid ${LINHA};padding-top:16px">
          <div style="font:700 14px Georgia,serif;color:${NAVY};letter-spacing:.04em">CRIVO&#8482;</div>
          <p style="margin:4px 0 0;font:12px/1.6 Arial,sans-serif;color:#6b7488">Clareza para decidir. Estrutura para agir. Evidência para evoluir.</p>
          <p style="margin:6px 0 0;font:12px Arial,sans-serif;color:${TERRA}">
            <a href="${site}" style="color:${TERRA};text-decoration:none">crivolegacy.com.br</a>
            &nbsp;·&nbsp;
            <a href="mailto:${LEAD_EMAIL_CONTATO}" style="color:${TERRA};text-decoration:none">${LEAD_EMAIL_CONTATO}</a>
          </p>
        </div>
      </td></tr>

    </table>
  </td></tr></table>
</body></html>`;
}
