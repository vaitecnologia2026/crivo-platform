import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A entrega do MAPA Executivo ao lead é UM e-mail só: o MAPA em PDF (layout do
 * modelo aprovado pelo cliente) mais o e-book, ambos anexados. Estes testes
 * protegem o que, se quebrar, reproduz o que o cliente relatou — o diagnóstico
 * chegando sem anexo, ou o texto prometendo arquivo que não foi:
 *   1. o MAPA sai SEMPRE em PDF, com nome no padrão, junto do e-book do painel;
 *   2. sem o e-book importado, o PDF publicado (EBOOK_URL) assume;
 *   3. sem e-book nenhum, o e-mail sai com o MAPA e não promete e-book.
 */

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));
vi.mock('../common/mailer', () => ({ sendMail: sendMailMock }));

import { PreliminaryReportsService } from './preliminary-reports.service';

const LEAD = {
  id: 'lead-1',
  name: 'Fulano de Tal',
  company: 'Empresa Exemplo Ltda.',
  email: 'lead@exemplo.com',
  diagnosticResult: {
    score: 72,
    level: 'EM_ESTRUTURACAO',
    byDimension: { pressao_rotina: 80, governanca_plano: 55 },
    topAttention: 'governanca_plano',
  },
};

const EBOOK_ROW = {
  fileName: 'E-book CRIVO — Liderança.pdf',
  // Precisa parecer um PDF de verdade: o servico recusa base64 que nao comece
  // com %PDF- ou que seja pequeno demais para ser um arquivo (guard contra
  // anexo corrompido sair como se estivesse tudo certo).
  data: Buffer.from('%PDF-1.4 ' + 'x'.repeat(500)).toString('base64'),
  updatedAt: new Date('2026-08-24T15:12:00.000Z'),
};

type MailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
};

function build(over: { lead?: unknown; ebookRow?: unknown } = {}) {
  const prisma = {
    admin: {
      platformLead: { findUnique: vi.fn(async () => ('lead' in over ? over.lead : LEAD)) },
      ebookAsset: { findFirst: vi.fn(async () => over.ebookRow ?? null) },
    },
  };
  const texts = { render: vi.fn(async (_key: string, fallback: string) => fallback) };
  const notifications = {
    dispatchPush: vi.fn(async () => undefined),
    isEnabled: vi.fn(async () => true),
  };
  const svc = new PreliminaryReportsService(
    prisma as never,
    {} as never,
    {} as never,
    texts as never,
    notifications as never,
  );
  return { svc, prisma, notifications };
}

/** O `sendMail` do envio (só existe um por teste). */
function mailSent(): MailArgs {
  return sendMailMock.mock.calls[0][0] as MailArgs;
}

beforeEach(() => {
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ ok: true, provider: 'smtp' });
  process.env.EBOOK_URL = 'https://exemplo.test/ebook.pdf';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EBOOK_URL;
});

describe('sendDiagnosticEmail — a leitura do MAPA com o e-book, num e-mail só', () => {
  it('anexa o MAPA em PDF e o e-book importado, e avisa disso no texto', async () => {
    const { svc } = build({ ebookRow: EBOOK_ROW });
    const r = await svc.sendDiagnosticEmail('lead-1');

    expect(r.ok).toBe(true);
    const mail = mailSent();
    expect(mail.to).toBe('lead@exemplo.com');
    expect(mail.attachments).toHaveLength(2);

    // O MAPA vem primeiro: é o documento que o lead pediu.
    const mapa = mail.attachments?.[0];
    expect(mapa?.filename).toMatch(
      /^MAPA_Executivo_CRIVO_Empresa_Exemplo_Ltda_[0-9]{4}-[0-9]{2}-[0-9]{2}\.pdf$/,
    );
    expect(mapa?.content.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    expect(mail.attachments?.[1].filename).toBe(EBOOK_ROW.fileName);
    expect(mail.attachments?.[1].content.toString()).toContain('%PDF');
    expect(mail.html).toContain('MAPA Executivo');
    expect(mail.html).toContain('e-book');
  });

  it('sem e-book importado, busca o PDF publicado (EBOOK_URL)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => Buffer.from('%PDF-x') })),
    );
    const { svc } = build();
    await svc.sendDiagnosticEmail('lead-1');

    // MAPA + e-book da URL.
    expect(mailSent().attachments).toHaveLength(2);
  });

  it('sem e-book nenhum: o e-mail SAI com o MAPA e NÃO promete e-book', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede fora'); }));
    const { svc } = build();
    const r = await svc.sendDiagnosticEmail('lead-1');

    expect(r.ok).toBe(true);
    const mail = mailSent();
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments?.[0].filename).toContain('MAPA_Executivo_CRIVO_');
    expect(mail.html).toContain('MAPA Executivo');
    expect(mail.html).not.toContain('e-book');
  });

  it('leva o diagnóstico: índice, nível, dimensões e ponto de atenção', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede fora'); }));
    const { svc } = build();
    await svc.sendDiagnosticEmail('lead-1');

    const { html, subject } = mailSent();
    expect(subject).toContain('MAPA Executivo');
    expect(html).toContain('72/100');
    expect(html).toContain('Governança, Evidências e Plano de Ação');
  });

  it('não depende da IA — nenhum serviço de IA é tocado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede fora'); }));
    // `ai` e `prompts` entram como {} no build: se o envio dependesse deles,
    // este teste quebraria com TypeError em vez de passar.
    const { svc } = build();
    await expect(svc.sendDiagnosticEmail('lead-1')).resolves.toMatchObject({ ok: true });
  });

  it('lead sem e-mail não dispara envio nenhum', async () => {
    const { svc } = build({ lead: { ...LEAD, email: null } });
    const r = await svc.sendDiagnosticEmail('lead-1');

    expect(r.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('lead sem diagnóstico não manda e-mail vazio', async () => {
    const { svc } = build({ lead: { ...LEAD, diagnosticResult: null } });
    const r = await svc.sendDiagnosticEmail('lead-1');

    expect(r.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('respeita o gate de e-mail do painel de Notificações', async () => {
    const { svc, notifications } = build({ ebookRow: EBOOK_ROW });
    notifications.isEnabled.mockResolvedValueOnce(false);
    const r = await svc.sendDiagnosticEmail('lead-1');

    expect(r.ok).toBe(false);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('falha no envio não derruba o intake — devolve ok:false', async () => {
    sendMailMock.mockResolvedValueOnce({ ok: false, provider: 'smtp', reason: 'caixa cheia' });
    const { svc } = build({ ebookRow: EBOOK_ROW });
    const r = await svc.sendDiagnosticEmail('lead-1');

    expect(r).toMatchObject({ ok: false, reason: 'caixa cheia' });
  });
});
