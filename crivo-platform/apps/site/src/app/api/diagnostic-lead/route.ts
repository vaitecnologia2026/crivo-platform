import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { makeLogger, maskEmail, maskPhone, reasonOf, safeReqId, type SiteLogger } from "@/lib/log";

import { leadEmailSubject, renderLeadEmailHtml } from "@crivo/types";

export const runtime = "nodejs";

// Diagnóstico Inicial da LP. Faz 3 coisas, todas best-effort (nunca trava o lead):
//   1. encaminha o formulário ao endpoint público da plataforma (cria o lead no
//      CRM + calcula o pré-diagnóstico, devolvido aqui);
//   2. envia ao PRÓPRIO LEAD um e-mail profissional com o diagnóstico + o e-book
//      em anexo (SMTP, ou Resend se configurado);
//   3. envia ao lead um WhatsApp (via API da VAI) com o diagnóstico + o e-book.
// Os envios saem DAQUI (Vercel) para não depender de variáveis no backend.

type Answer = { questionId: number; value: number };
type Payload = {
  name?: string;
  cnpj?: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  segment?: string;
  employeesCount?: string;
  challenges?: string[];
  challengeOther?: string;
  origin?: string;
  /** §11/§15 — de onde o visitante veio e qual campanha gerou este lead. */
  atribuicao?: {
    utm_source?: string; utm_medium?: string; utm_campaign?: string;
    utm_content?: string; utm_term?: string; referrer?: string; landing?: string;
  };
  answers?: Answer[];
};
type DiagResult = {
  score: number;
  level: string;
  levelLabel?: string;
  byDimension?: Record<string, number>;
  // Rótulos da metodologia ATIVA (slug → nome exibível). A plataforma devolve
  // isto no intake; sem ele, dimensões criadas pelo cliente (ex.: "dim-1")
  // apareceriam como slug cru no e-mail.
  dimensionLabels?: Record<string, string>;
  topAttention?: string;
  topAttentions?: string[];
};

const EBOOK_URL = process.env.EBOOK_URL ?? "https://crivolegacy.com.br/ebook-crivo.pdf";
const SITE_URL = process.env.SITE_URL ?? "https://crivolegacy.com.br";
/** Mesma ressalva do e-mail da API (lá o texto é editável no super admin). */
const NOTA_TECNICA =
  "O MAPA Executivo CRIVO™ oferece uma leitura preliminar a partir das informações fornecidas " +
  "e não substitui diagnóstico técnico ou avaliação especializada.";

const LEVEL_LABEL: Record<string, string> = {
  CRITICO: "Crítico",
  EM_ESTRUTURACAO: "Em estruturação",
  EM_DESENVOLVIMENTO: "Em desenvolvimento",
  ESTRUTURADO: "Estruturado",
  CONSOLIDADO: "Consolidado",
  REFERENCIA: "Referência",
};
const DIM_LABEL: Record<string, string> = {
  pressao_rotina: "Pressão & Rotina",
  lideranca_sustentacao: "Liderança & Sustentação",
  cultura_comunicacao: "Cultura & Comunicação",
  fatores_psicossociais: "Fatores Psicossociais",
  governanca_plano: "Governança & Plano de Ação",
};

const NAVY = "#1b2a4a";
const TERRA = "#c4894a";

function firstName(name?: string): string {
  return (name ?? "").trim().split(/\s+/)[0] || "tudo bem";
}
function levelLabel(result?: DiagResult): string {
  // Faixa da metodologia ATIVA primeiro (o nome da faixa é configurável no motor,
  // ex.: "Vulnerável"); só depois o mapa fixo dos níveis legados.
  if (result?.levelLabel?.trim()) return result.levelLabel.trim();
  return result?.level ? LEVEL_LABEL[result.level] ?? result.level : "—";
}
/**
 * Rótulo exibível de uma dimensão: metodologia ATIVA → mapa fixo → nada.
 * NUNCA cai no slug cru ("dim-1" no e-mail confundia quem recebia).
 */
function dimLabel(result: DiagResult | undefined, slug: string): string | null {
  const fromMethodology = result?.dimensionLabels?.[slug];
  if (fromMethodology?.trim()) return fromMethodology.trim();
  return DIM_LABEL[slug] ?? null;
}
function attentionLabels(result?: DiagResult): string[] {
  const keys = result?.topAttentions?.length
    ? result.topAttentions
    : result?.topAttention
      ? [result.topAttention]
      : [];
  // Sem rótulo conhecido a dimensão é OMITIDA — melhor uma lista menor do que
  // um item ilegível no e-mail do lead.
  return keys.map((k) => dimLabel(result, k)).filter((l): l is string => !!l);
}

// ── 1. Encaminha à plataforma e devolve o pré-diagnóstico ────────────────────
async function sendToPlatform(
  apiUrl: string,
  data: Payload,
  log: SiteLogger,
  reqId: string,
): Promise<{ ok: boolean; result?: DiagResult }> {
  try {
    const r = await fetch(`${apiUrl}/public/diagnostic-lead`, {
      method: "POST",
      // O mesmo id segue para a API: e o que costura esta linha de log com
      // as do `crivo-api`, inclusive as do relatorio que sai minutos depois.
      headers: { "Content-Type": "application/json", "x-request-id": reqId },
      body: JSON.stringify({
        name: data.name,
        cnpj: data.cnpj || undefined,
        role: data.role || undefined,
        company: data.company || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        segment: data.segment || undefined,
        employeesCount: data.employeesCount || undefined,
        challenges: data.challenges?.length ? data.challenges : undefined,
        challengeOther: data.challengeOther || undefined,
        origin: data.origin || "lp-diagnostico",
        // §11/§15 — a campanha que gerou o lead vai junto ate o CRM. O campo
        // existe no DTO (LeadAtribuicaoDto) e nas colunas utm_* do PlatformLead;
        // sem isso o ValidationPipe (forbidNonWhitelisted) devolveria 400 e o
        // lead se perderia.
        atribuicao: data.atribuicao && Object.keys(data.atribuicao).length ? data.atribuicao : undefined,
        answers: data.answers ?? [],
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) {
      // O corpo do erro era descartado: um 400 do ValidationPipe, um 500 ou
      // uma URL errada chegavam ao resto do fluxo como o mesmo
      // `platformOk=false`, sem causa nenhuma.
      const body = await r.text().catch(() => "");
      log.error(`platform.rejected status=${r.status} body="${body.slice(0, 500)}"`);
      return { ok: false };
    }
    const d = (await r.json()) as { result?: DiagResult };
    return { ok: true, result: d?.result };
  } catch (e) {
    // O `name` distingue o timeout de 9 s (TimeoutError) de recusa de conexao.
    log.error(`platform.unreachable ${reasonOf(e)}`);
    return { ok: false };
  }
}


async function fetchEbook(log: SiteLogger): Promise<Buffer | null> {
  try {
    const r = await fetch(EBOOK_URL, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) {
      log.warn(`ebook.http_error url=${EBOOK_URL} status=${r.status}`);
      return null;
    }
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    log.warn(`ebook.fetch_failed url=${EBOOK_URL} ${reasonOf(e)}`);
    return null;
  }
}

async function sendLeadEmail(
  data: Payload,
  result: DiagResult | undefined,
  pdf: Buffer | null,
  log: SiteLogger,
): Promise<boolean> {
  const to = data.email?.trim();
  if (!to) {
    log.warn("mail.skipped motivo=lead_sem_email");
    return false;
  }
  // Mesmo layout do e-mail que a API envia: o lead nunca pode receber duas
  // identidades visuais diferentes da CRIVO por causa de qual caminho atendeu.
  const corpo = {
    firstName: firstName(data.name),
    company: data.company ?? null,
    score: result?.score ?? null,
    bandLabel: result ? levelLabel(result) : null,
    attachments: pdf
      ? [
          {
            label: "o e-book complementar CRIVO",
            detail:
              "com uma leitura ampliada sobre os temas que estão transformando a gestão das organizações",
          },
        ]
      : [],
    note: NOTA_TECNICA,
    siteUrl: SITE_URL,
  };
  const html = renderLeadEmailHtml(corpo);
  const subject = leadEmailSubject(data.company);
  const resendKey = process.env.RESEND_API_KEY;

  // Preferência: Resend (HTTP, ideal em serverless) se houver chave.
  if (resendKey) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.SMTP_FROM ?? "CRIVO <onboarding@resend.dev>",
          to: [to],
          subject,
          html,
          attachments: pdf ? [{ filename: "CRIVO-ebook.pdf", content: pdf.toString("base64") }] : undefined,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (r.ok) return true;
      const detail = await r.text().catch(() => "");
      log.error(`mail.resend_rejected status=${r.status} body="${detail.slice(0, 300)}" - tentando SMTP`);
    } catch (e) {
      log.error(`mail.resend_failed ${reasonOf(e)} - tentando SMTP`);
    }
  }

  // SMTP (Zoho/Hostinger). Vercel/Lambda permite 587 de saída.
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    log.error(`mail.no_provider to=${maskEmail(to)} - SMTP_HOST/USER/PASS ausentes no ambiente do site`);
    return false;
  }
  try {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `CRIVO <${user}>`,
      to,
      subject,
      html,
      attachments: pdf ? [{ filename: "CRIVO-ebook.pdf", content: pdf }] : undefined,
    });
    return true;
  } catch (e) {
    console.error("[lead-email] SMTP falhou:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Rede de segurança: quando o registro no CRM FALHA, o visitante ainda vê
 * sucesso (recebeu o diagnóstico por e-mail/WhatsApp) — mas a CRIVO perderia o
 * contato para sempre, pois o e-mail vai PARA o lead, não para a equipe.
 * Este alerta interno envia os dados completos do lead para recuperação manual.
 */
async function sendInternalRescueEmail(data: Payload): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;
  const to = process.env.LEAD_ALERT_EMAIL ?? user;
  const linha = (rotulo: string, valor?: string | null) =>
    valor
      ? `<tr><td style="padding:4px 12px 4px 0;color:#5C6470"><strong>${rotulo}</strong></td><td style="padding:4px 0">${valor}</td></tr>`
      : "";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:${NAVY}">Lead da LP NÃO registrado no CRM — recuperação manual</h2>
      <p>O site recebeu um lead e entregou o diagnóstico ao contato, mas o registro no CRM falhou.
      Cadastre manualmente no funil:</p>
      <table style="border-collapse:collapse;font-size:14px">
        ${linha("Nome", data.name)}
        ${linha("Empresa", data.company)}
        ${linha("E-mail", data.email)}
        ${linha("Telefone", data.phone)}
        ${linha("Cargo", data.role)}
        ${linha("Funcionários", data.employeesCount)}
        ${linha("Segmento", data.segment)}
        ${linha("CNPJ", data.cnpj)}
        ${linha("Desafios", Array.isArray(data.challenges) ? data.challenges.join(", ") : undefined)}
      </table>
    </div>`;
  try {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `CRIVO <${user}>`,
      to,
      subject: `[CRIVO][RESGATE] Lead fora do CRM: ${data.name ?? "sem nome"} — ${data.company ?? ""}`,
      html,
    });
    return true;
  } catch (e) {
    console.error("[diagnostic-lead][RESGATE] alerta interno falhou:", e instanceof Error ? e.message : e);
    return false;
  }
}

// ── WhatsApp ao LEAD (API da VAI: login → canal → contato → chat → mensagem) ──
async function vaiFetch(base: string, path: string, init: RequestInit, token: string): Promise<Response> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
}

async function sendLeadWhatsapp(
  data: Payload,
  result: DiagResult | undefined,
  pdf: Buffer | null,
  log: SiteLogger,
): Promise<boolean> {
  const to = (data.phone ?? "").replace(/\D/g, "");
  if (!to) {
    log.info("wa.skipped motivo=lead_sem_telefone");
    return false;
  }
  const base = process.env.VAI_API_URL ?? "https://api.vaicrm.com.br";
  const email = process.env.VAI_API_EMAIL;
  const password = process.env.VAI_API_PASSWORD;
  if (!email || !password) {
    log.warn("wa.not_configured - VAI_API_EMAIL/VAI_API_PASSWORD ausentes");
    return false;
  }

  try {
    const lr = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(12000),
    });
    if (!lr.ok) {
      log.warn(`wa.login_failed status=${lr.status}`);
      return false;
    }
    const token = ((await lr.json()) as { access_token?: string }).access_token;
    if (!token) {
      log.warn("wa.no_token - login respondeu sem access_token");
      return false;
    }

    let channelId = process.env.VAI_WA_CHANNEL_ID;
    if (!channelId) {
      const cr = await vaiFetch(base, "/channels/type/whatsapp", { method: "GET" }, token);
      if (cr.ok) {
        const list = (await cr.json()) as { id: string; status?: string }[];
        channelId = (list.find((c) => c.status === "connected") ?? list[0])?.id;
      }
    }
    if (!channelId) {
      log.warn("wa.no_channel - nenhum canal de WhatsApp conectado na VAI");
      return false;
    }

    // contato (acha ou cria)
    let contactId: string | undefined;
    const f = await vaiFetch(base, `/contacts?phone=${encodeURIComponent(to)}&limit=1`, { method: "GET" }, token);
    if (f.ok) contactId = ((await f.json()) as { data?: { id?: string }[] })?.data?.[0]?.id;
    if (!contactId) {
      const c = await vaiFetch(
        base,
        "/contacts",
        { method: "POST", body: JSON.stringify({ channel: "whatsapp", identifier: to, phone: to, name: data.name || to }) },
        token,
      );
      if (c.ok) contactId = ((await c.json()) as { id?: string }).id;
    }
    if (!contactId) {
      log.warn(`wa.no_contact phone=${maskPhone(to)} - nao foi possivel achar nem criar o contato`);
      return false;
    }

    // chat (cria; reusa no 409)
    let chatId: string | undefined;
    const ch = await vaiFetch(base, "/chats", { method: "POST", body: JSON.stringify({ contactId, channelId }) }, token);
    if (ch.ok) chatId = ((await ch.json()) as { id?: string }).id;
    else if (ch.status === 409) {
      const gx = await vaiFetch(base, `/chats?contactId=${encodeURIComponent(contactId)}&limit=1`, { method: "GET" }, token);
      if (gx.ok) chatId = ((await gx.json()) as { data?: { id?: string }[] })?.data?.[0]?.id;
    }
    if (!chatId) {
      log.warn(`wa.no_chat phone=${maskPhone(to)} - nao foi possivel abrir a conversa`);
      return false;
    }

    const nivel = levelLabel(result);
    const score = result?.score != null ? `${result.score}/100` : "";
    const atencao = attentionLabels(result);
    const msg =
      `✅ *Diagnóstico Inicial CRIVO™ recebido*\n\n` +
      `Olá, ${firstName(data.name)}! Aqui está sua leitura preliminar:\n` +
      (score ? `• Índice preliminar: *${score}*\n` : "") +
      `• Nível de maturidade: *${nivel}*\n` +
      (atencao.length ? `• Pontos de atenção: ${atencao.join(", ")}\n` : "") +
      `\nSeu e-book complementar: ${EBOOK_URL}\n\n` +
      `_Leitura preliminar com base nas respostas — a equipe CRIVO entra em contato para os próximos passos._`;

    const sent = await vaiFetch(
      base,
      `/chats/${chatId}/messages`,
      { method: "POST", body: JSON.stringify({ content: msg, type: "text" }) },
      token,
    );
    if (!sent.ok) {
      log.error(`wa.send_failed phone=${maskPhone(to)} status=${sent.status}`);
      return false;
    }

    // E-book como DOCUMENTO real (best-effort). A VAI exige o arquivo no storage
    // dela: upload (multipart) → devolve a URL S3 → envia o documento com ela.
    // Mandar a URL externa direto gera "arquivo vazio". O link no texto é o backup.
    if (pdf) {
      try {
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), "CRIVO-ebook.pdf");
        form.append("type", "document");
        const up = await fetch(`${base}/chats/${chatId}/messages/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
          signal: AbortSignal.timeout(15000),
        });
        if (up.ok) {
          const media = (await up.json()) as { url?: string };
          if (media.url) {
            await vaiFetch(
              base,
              `/chats/${chatId}/messages`,
              { method: "POST", body: JSON.stringify({ type: "document", fileUrl: media.url, content: "E-book CRIVO™" }) },
              token,
            );
          }
        }
      } catch (e) {
        log.warn(`wa.ebook_upload_failed ${reasonOf(e)} - o link no texto segue como alternativa`);
      }
    }

    return true;
  } catch (e) {
    log.error(`wa.failed phone=${maskPhone(to)} ${reasonOf(e)}`);
    return false;
  }
}

// Consulta o painel de Notificações (backend) e dispara o push da equipe CRIVO.
// Fail-open: gate indisponível → o e-mail de aviso continua saindo.
async function notifyGate(key: string, title: string, body: string): Promise<{ emailEnabled: boolean }> {
  const api = process.env.PLATFORM_API_URL;
  if (!api) return { emailEnabled: true };
  try {
    const r = await fetch(`${api}/notifications/site-event/${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-secret": process.env.SITE_NOTIFY_SECRET ?? "",
      },
      body: JSON.stringify({ title, body }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { emailEnabled: true };
    const j = (await r.json()) as { emailEnabled?: boolean };
    return { emailEnabled: j.emailEnabled !== false };
  } catch {
    return { emailEnabled: true };
  }
}

export async function POST(req: Request) {
  // Id de correlacao da jornada inteira: acompanha o lead deste log ate as
  // linhas da API, inclusive as do relatorio que sai minutos depois.
  const reqId = safeReqId(req.headers.get("x-request-id")) ?? randomUUID().slice(0, 8);
  const log = makeLogger("diagnostic-lead", reqId);
  let data: Payload;
  try {
    data = (await req.json()) as Payload;
  } catch {
    log.warn("payload.invalido - corpo nao e JSON");
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  if (!data.name || !data.name.trim()) {
    log.warn("payload.sem_nome");
    return NextResponse.json({ ok: false, error: "Nome é obrigatório." }, { status: 400 });
  }

  const platformApi = process.env.PLATFORM_API_URL;

  // Dispara o push da equipe CRIVO (novo diagnóstico) — fire-and-forget. As
  // entregas ao LEAD (e-mail + WhatsApp abaixo) são do cliente, não passam pelo
  // toggle do painel; o push interno respeita o pushEnabled no backend.
  void notifyGate(
    "site.diagnostico_lead",
    "Novo diagnóstico inicial",
    String(data.company ?? data.name ?? data.email ?? "lead"),
  );

  // 1. Cria o lead no CRM e recupera o pré-diagnóstico.
  let result: DiagResult | undefined;
  let platformOk = false;
  if (platformApi) {
    const r = await sendToPlatform(platformApi, data, log, reqId);
    platformOk = r.ok;
    result = r.result;
  }

  // 2/3. WhatsApp sempre; e-mail SÓ como rede de segurança.
  //
  // A entrega por e-mail ao lead passou a ser da PLATAFORMA: ela manda UM
  // e-mail com a leitura do MAPA Executivo e o e-book anexado. Enquanto o site
  // também mandava o dele, o lead recebia duas mensagens com o mesmo e-book.
  // Resta aqui o caso em que o intake falhou: ninguém mais enviaria, e este
  // e-mail curto é o que salva a entrega.
  const ebook = await fetchEbook(log);
  const [emailed, whatsapped] = await Promise.all([
    platformOk
      ? Promise.resolve(false)
      : sendLeadEmail(data, result, ebook, log).catch((e) => {
          log.error(`mail.failed ${reasonOf(e)}`);
          return false;
        }),
    sendLeadWhatsapp(data, result, ebook, log).catch((e) => {
      log.error(`wa.failed ${reasonOf(e)}`);
      return false;
    }),
  ]);

  if (!platformApi) {
    console.warn("[diagnostic-lead] PLATFORM_API_URL ausente — lead não registrado no CRM.");
  }

  // CRM não registrou (env ausente OU intake falhou): alerta interno com os
  // dados completos, senão o lead some do funil com cara de sucesso.
  if (!platformOk) {
    const rescued = await sendInternalRescueEmail(data).catch(() => false);
    console.warn(`[diagnostic-lead] lead NÃO registrado no CRM — alerta interno ${rescued ? "enviado" : "FALHOU"}.`);
  }

  // `platformOk` conta como entrega: a plataforma assumiu o e-mail do lead
  // (Relatório Preliminar + e-book). Sem isso, um lead SEM telefone cairia em
  // `delivered: false` e a LP mostraria a mensagem pior — com o e-mail a caminho.
  const delivered = platformOk || emailed || whatsapped;
  // `ok` = o lead foi RETIDO (persistido no CRM) OU entregue por algum canal.
  const ok = platformOk || delivered;

  if (!ok) {
    // RESGATE: falha TOTAL — nenhum canal reteve o lead. Registra o contato para
    // recuperação manual: um lead NUNCA pode sumir com mensagem de sucesso.
    const rescueEmail = data.email ? data.email.replace(/^(.).*(@.*)$/, "$1***$2") : undefined;
    const rescuePhone = data.phone ? "***" + String(data.phone).slice(-4) : undefined;
    console.error(
      "[diagnostic-lead][RESGATE] lead não retido em nenhum canal:",
      JSON.stringify({
        name: data.name,
        email: rescueEmail,
        phone: rescuePhone,
        company: data.company,
        cnpj: data.cnpj,
      }),
    );
  } else if (!delivered) {
    console.warn(
      "[diagnostic-lead] lead salvo no CRM, mas nenhum canal (e-mail/WhatsApp) entregou ao lead.",
    );
  }

  // Status HTTP reflete o resultado real (defesa extra); `delivered` distingue
  // "retido no CRM" de "entregue ao lead" para a UI mostrar a mensagem certa.
  // UMA linha de resumo por lead, inclusive no sucesso. E o primeiro lugar
  // onde olhar: diz se o CRM recebeu, se o e-book foi baixado e por qual
  // canal o lead foi atendido. `platformOk=true` significa que a plataforma
  // assumiu o e-mail - ele sai LA, em background, e aparece no log da API.
  log.info(
    `delivery.summary lead=${maskEmail(data.email)} platformOk=${platformOk} ` +
      `emailed=${emailed} whatsapped=${whatsapped} ebookBytes=${ebook?.length ?? 0}`,
  );

  return NextResponse.json(
    { ok, delivered, emailed, whatsapped, reqId },
    { status: ok ? 200 : 502, headers: { "x-request-id": reqId } },
  );
}
