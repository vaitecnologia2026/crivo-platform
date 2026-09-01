import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { BadRequestException } from '@nestjs/common';

// O mailer é módulo de funções soltas (common/mailer.ts), então é mockado no
// nível do módulo — mesmo padrão dos testes do relatório preliminar
// (vi.hoisted porque vi.mock sobe para antes dos imports).
const { sendMail, mailConfigured } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  mailConfigured: vi.fn(),
}));
vi.mock('../common/mailer', () => ({ sendMail, mailConfigured }));

import { PasswordResetService } from './password-reset.service';

/**
 * Recuperação de senha em autoatendimento. O que estes testes prendem:
 *  - o banco NUNCA guarda o token em claro (só o sha256);
 *  - a resposta é idêntica com e sem conta (anti-enumeração);
 *  - o link é de uso único e expira;
 *  - redefinir derruba as sessões abertas (tokenVersion);
 *  - e-mail em várias empresas gera UM link por empresa.
 */

const EMAIL = 'pessoa@exemplo.com';
const USER_A = { id: 'user-a', tenantId: 'org-a', name: 'Fulana de Tal' };
const USER_B = { id: 'user-b', tenantId: 'org-b', name: 'Fulana de Tal' };

function sha(t: string) {
  return createHash('sha256').update(t).digest('hex');
}

function build(users = [USER_A]) {
  const tokens: {
    tenantId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  }[] = [];
  const userRows = new Map(
    users.map((u) => [
      u.id,
      {
        ...u,
        email: EMAIL,
        active: true,
        passwordHash: bcrypt.hashSync('senha-antiga', 4),
        tokenVersion: 0,
      },
    ]),
  );

  const prisma = {
    admin: {
      user: {
        findMany: vi.fn(async ({ where }: { where: { email: string; active: boolean } }) =>
          where.email === EMAIL
            ? [...userRows.values()].filter((u) => u.active === where.active)
            : [],
        ),
        findUnique: vi.fn(
          async ({ where }: { where: { id: string } }) => userRows.get(where.id) ?? null,
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { passwordHash: string; tokenVersion: { increment: number } };
          }) => {
            const u = userRows.get(where.id)!;
            u.passwordHash = data.passwordHash;
            u.tokenVersion += data.tokenVersion.increment;
            return u;
          },
        ),
      },
      organization: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
          name: where.id === 'org-a' ? 'Empresa A' : 'Empresa B',
        })),
      },
      passwordResetToken: {
        create: vi.fn(async ({ data }: { data: (typeof tokens)[number] }) => {
          tokens.push({ ...data, usedAt: null });
          return data;
        }),
        findUnique: vi.fn(
          async ({ where }: { where: { tokenHash: string } }) =>
            tokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
        ),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { userId: string; usedAt: null };
            data: { usedAt: Date };
          }) => {
            let count = 0;
            for (const t of tokens) {
              if (t.userId === where.userId && t.usedAt === null) {
                t.usedAt = data.usedAt;
                count += 1;
              }
            }
            return { count };
          },
        ),
      },
    },
  };

  const service = new PasswordResetService(prisma as never);
  return { service, prisma, tokens, userRows };
}

/** Extrai os tokens em claro dos links do e-mail enviado. */
function linksDoEmail(): string[] {
  const arg = sendMail.mock.calls.at(-1)?.[0] as { text: string } | undefined;
  return [...(arg?.text ?? '').matchAll(/[?&]t=([0-9a-f]{64})/g)].map((m) => m[1]);
}

beforeEach(() => {
  sendMail.mockReset();
  sendMail.mockResolvedValue({ ok: true, provider: 'smtp' });
  mailConfigured.mockReturnValue(true);
});

describe('PasswordResetService', () => {
  it('grava só o HASH do token — o valor em claro fica fora do banco', async () => {
    const { service, tokens } = build();
    await service.request(EMAIL);
    const [claro] = linksDoEmail();
    expect(claro).toHaveLength(64);
    expect(tokens).toHaveLength(1);
    // O que está no banco não serve para abrir o link.
    expect(tokens[0].tokenHash).not.toBe(claro);
    expect(tokens[0].tokenHash).toBe(sha(claro));
  });

  it('e-mail sem conta: mesma resposta e nenhum e-mail enviado (anti-enumeração)', async () => {
    const { service } = build();
    const r = await service.request('ninguem@exemplo.com');
    // A resposta é idêntica à do caminho com conta — a tela não pode distinguir.
    expect(r).toEqual({ ok: true });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('e-mail em duas empresas gera um link POR conta', async () => {
    const { service, tokens } = build([USER_A, USER_B]);
    await service.request(EMAIL);
    expect(tokens).toHaveLength(2);
    expect(linksDoEmail()).toHaveLength(2);
    // A pessoa precisa saber qual senha está trocando.
    const arg = sendMail.mock.calls.at(-1)?.[0] as { html: string } | undefined;
    expect(arg?.html).toContain('Empresa A');
    expect(arg?.html).toContain('Empresa B');
  });

  it('pedir de novo invalida o link anterior', async () => {
    const { service, tokens } = build();
    await service.request(EMAIL);
    const primeiro = linksDoEmail()[0];
    await service.request(EMAIL);
    expect(tokens).toHaveLength(2);
    await expect(service.verify(primeiro)).rejects.toThrow(BadRequestException);
  });

  it('verify devolve a conta e a empresa do token', async () => {
    const { service } = build();
    await service.request(EMAIL);
    const r = await service.verify(linksDoEmail()[0]);
    expect(r).toEqual({ email: EMAIL, name: USER_A.name, company: 'Empresa A' });
  });

  it('confirm grava a senha nova e derruba as sessões abertas', async () => {
    const { service, userRows } = build();
    await service.request(EMAIL);
    await service.confirm(linksDoEmail()[0], 'senha-nova-123');
    const u = userRows.get(USER_A.id)!;
    expect(bcrypt.compareSync('senha-nova-123', u.passwordHash)).toBe(true);
    // Sem isto, quem estivesse logado com a senha antiga continuaria dentro.
    expect(u.tokenVersion).toBe(1);
  });

  it('o link é de uso único', async () => {
    const { service } = build();
    await service.request(EMAIL);
    const t = linksDoEmail()[0];
    await service.confirm(t, 'senha-nova-123');
    await expect(service.confirm(t, 'outra-senha-456')).rejects.toThrow(BadRequestException);
  });

  it('link expirado não vale', async () => {
    const { service, tokens } = build();
    await service.request(EMAIL);
    tokens[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.verify(linksDoEmail()[0])).rejects.toThrow(BadRequestException);
  });

  it('token inexistente e token vazio dão a MESMA mensagem do expirado', async () => {
    const { service } = build();
    const msg = 'Link inválido ou expirado. Peça um novo em "Esqueci minha senha".';
    await expect(service.verify('f'.repeat(64))).rejects.toThrow(msg);
    await expect(service.verify('')).rejects.toThrow(msg);
  });

  it('sem provedor de e-mail configurado, não cria token nem promete envio', async () => {
    mailConfigured.mockReturnValue(false);
    const { service, tokens } = build();
    const r = await service.request(EMAIL);
    expect(r).toEqual({ ok: true });
    expect(tokens).toHaveLength(0);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
