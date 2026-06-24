import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

// Relay de e-mail do "Relatório Preliminar" (IA) — chamado pelo Super Admin.
// O backend (Railway) gera o relatório com a IA mas NÃO consegue enviar e-mail
// (egress SMTP bloqueado → ENETUNREACH). Aqui, no Vercel, o SMTP funciona.
// Auth: valida o token de super admin contra a própria API antes de enviar.

const NAVY = "#1b2a4a";
const TERRA = "#c4894a";

type Body = {
  to?: string;
  leadName?: string;
  company?: string | null;
  markdown?: string;
  footer?: string;
};

// Markdown → HTML (subconjunto suficiente p/ o relatório: #/##/###, listas, **bold**, parágrafos).
function mdToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (/^###\s+/.test(line)) {
      closeList();
      out.push(`<h3 style="margin:18px 0 6px;font:700 15px Arial,sans-serif;color:${NAVY}">${inline(line.replace(/^###\s+/, ""))}</h3>`);
    } else if (/^##\s+/.test(line)) {
      closeList();
      out.push(`<h2 style="margin:22px 0 8px;font:700 17px Georgia,serif;color:${NAVY};border-bottom:2px solid ${TERRA};padding-bottom:4px">${inline(line.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^#\s+/.test(line)) {
      closeList();
      out.push(`<h1 style="margin:0 0 10px;font:700 22px Georgia,serif;color:${NAVY}">${inline(line.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push(`<ul style="margin:6px 0;padding-left:20px;font:14px/1.7 Arial,sans-serif;color:#333">`);
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else {
      closeList();
      out.push(`<p style="margin:0 0 12px;font:14px/1.7 Arial,sans-serif;color:#333">${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

function reportEmailHtml(leadName: string | undefined, company: string | null | undefined, bodyHtml: string, footer?: string): string {
  const empresa = company || "sua empresa";
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f1ec;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(27,42,74,.08)">
      <tr><td style="background:${NAVY};padding:26px 36px">
        <div style="font:700 22px Georgia,serif;color:#fff;letter-spacing:.04em">CRIVO<span style="color:${TERRA}">™</span></div>
        <div style="font:13px Arial,sans-serif;color:#c9d2e6;margin-top:2px">Relatório Preliminar · Inteligência decisória</div>
      </td></tr>
      <tr><td style="padding:30px 36px 6px">
        <p style="margin:0 0 18px;font:14px/1.7 Arial,sans-serif;color:#444">
          Olá${leadName ? `, ${leadName.split(/\s+/)[0]}` : ""}. Segue a leitura preliminar de <strong>${empresa}</strong>,
          gerada a partir do Diagnóstico Inicial CRIVO.</p>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:14px 36px 30px">
        <p style="margin:0;font:11px/1.6 Arial,sans-serif;color:#8a8a8a;border-top:1px solid #eee;padding-top:14px">
          ${footer ? footer.replace(/</g, "&lt;") : "Relatório preliminar gerado por IA a partir do Diagnóstico Inicial CRIVO. Não substitui o CRIVO Diagnóstico™ Essencial ou Organizacional, nem é avaliação individual de performance ou diagnóstico clínico."}</p>
        <p style="margin:10px 0 0;font:11px Arial,sans-serif;color:${TERRA};font-weight:700">CRIVO™ · O2 Legacy</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// Valida o token de super admin contra a API (evita relay aberto).
async function isSuperAdmin(authHeader: string | null): Promise<boolean> {
  const api = process.env.PLATFORM_API_URL;
  if (!api || !authHeader) return false;
  try {
    const r = await fetch(`${api}/admin/ai-settings`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!(await isSuperAdmin(req.headers.get("authorization")))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }
  const to = body.to?.trim();
  if (!to || !body.markdown) {
    return NextResponse.json({ ok: false, error: "Destinatário e conteúdo são obrigatórios." }, { status: 400 });
  }

  const html = reportEmailHtml(body.leadName, body.company, mdToHtml(body.markdown), body.footer);
  const subject = `Relatório Preliminar CRIVO™${body.company ? ` · ${body.company}` : ""}`;

  // Resend (se houver) → senão SMTP (Vercel/Lambda permite 587).
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.SMTP_FROM ?? "CRIVO <onboarding@resend.dev>", to: [to], subject, html }),
        signal: AbortSignal.timeout(12000),
      });
      if (r.ok) return NextResponse.json({ ok: true, provider: "resend" });
    } catch {
      /* tenta SMTP */
    }
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return NextResponse.json({ ok: false, error: "E-mail não configurado." }, { status: 500 });
  }
  try {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({ from: process.env.SMTP_FROM ?? `CRIVO <${user}>`, to, subject, html });
    return NextResponse.json({ ok: true, provider: "smtp" });
  } catch (e) {
    console.error("[send-report] SMTP falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Falha ao enviar o e-mail." }, { status: 502 });
  }
}
