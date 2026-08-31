import type { PrismaService } from '../prisma/prisma.service';

/**
 * O e-mail identifica a PESSOA no login: quem entra digita e-mail e senha, sem
 * informar a empresa. Se o mesmo e-mail existir em duas empresas, a SENHA vira
 * o desempate (iam/auth.service.ts) — a pessoa entra sem saber em qual empresa
 * caiu. E se as duas contas ficarem com a mesma senha, o login recusa as duas
 * com "Conta duplicada". Por isso o e-mail é único na plataforma inteira, e não
 * por empresa (o banco só garante @@unique([tenantId, email])).
 *
 * Devolve a empresa que já usa o e-mail, ou null quando está livre.
 */
export async function findEmailOwner(
  prisma: PrismaService,
  email: string,
): Promise<{ tenantId: string; company: string } | null> {
  const normalized = email.toLowerCase().trim();
  // Inclui usuário inativo de propósito: reativar recriaria a ambiguidade.
  // `orderBy` importa por causa das duplicatas que já existem no banco (criadas
  // antes desta regra): sem ele o findFirst devolveria uma empresa arbitrária e
  // a mensagem apontaria para um lugar diferente a cada tentativa. A mais
  // recente é a que o operador acabou de mexer.
  const user = await prisma.admin.user.findFirst({
    where: { email: normalized },
    select: { tenantId: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!user) return null;
  const org = await prisma.admin.organization.findUnique({
    where: { id: user.tenantId },
    select: { name: true },
  });
  return { tenantId: user.tenantId, company: org?.name ?? 'outra empresa' };
}

/**
 * Mensagem dos fluxos de SUPER ADMIN, que nomeia a empresa: sem isso o operador
 * fica sem saber onde o e-mail já está e não tem como resolver. No portal do
 * cliente a mensagem segue genérica — lá, nomear outra empresa vazaria dado
 * entre tenants.
 */
export function emailTakenMessage(email: string, company: string): string {
  return (
    `O e-mail ${email} já tem acesso à empresa "${company}". ` +
    `Cada e-mail pertence a uma única empresa — informe outro e-mail para esta.`
  );
}
