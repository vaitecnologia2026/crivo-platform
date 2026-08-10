/**
 * SEED DE BOOTSTRAP — o mínimo para um banco vazio virar utilizável:
 * super admin, catálogo RBAC, catálogo de módulos e catálogo de produtos.
 *
 * Regra desta seed: **nenhum `deleteMany`**. Tudo é `upsert` por chave natural,
 * então rodar duas vezes não muda nada e rodar contra base com dados reais é
 * seguro. É esta que entra no `setup:prod`.
 *
 * O seed de DEMONSTRAÇÃO (prisma/seed.ts) é outro arquivo: ele apaga a base
 * inteira antes de popular e só roda com CRIVO_SEED_DEMO=1.
 *
 * Contexto: até 08/2026 os dois viviam juntos e o `setup:prod` chamava o
 * conjunto — o manual de deploy mandava rodar isso contra produção, o que
 * apagaria a base do cliente.
 */
import { PrismaClient, Plan, Role } from '@prisma/client';
import {
  PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS, MODULES, modulesForPlan,
  PRE_DIAGNOSTIC_QUESTIONS, PRE_DIAGNOSTIC_DIMENSIONS, PRE_DIAGNOSTIC_DIMENSION_LABEL,
  PRE_DIAGNOSTIC_SCALE,
} from '@crivo/types';
import * as bcrypt from 'bcryptjs';

const hash = (s: string) => bcrypt.hashSync(s, 12);

/** Instrumento do PRÉ-DIAGNÓSTICO — reusa as 10 perguntas do Diagnóstico Inicial. */
const preDiagnosticInstrument = {
  dimensions: PRE_DIAGNOSTIC_DIMENSIONS.map((d) => ({ key: d, label: PRE_DIAGNOSTIC_DIMENSION_LABEL[d] })),
  scales: [
    { key: 'maturidade', label: 'Maturidade (1–5)', options: PRE_DIAGNOSTIC_SCALE.map((s) => ({ value: s.value, label: s.label })) },
  ],
  blocks: PRE_DIAGNOSTIC_DIMENSIONS.map((d) => ({ key: d, label: PRE_DIAGNOSTIC_DIMENSION_LABEL[d] })),
  questions: PRE_DIAGNOSTIC_QUESTIONS.map((q) => ({
    id: q.id, text: q.text, block: q.dimension, dimension: q.dimension, scale: 'maturidade', weight: 1, inverse: false,
  })),
};

const SALES_PRODUCTS: Array<{
  slug: string; name: string; plan: Plan; monthly: number; setup: number;
  maxUsers: number; maxLeaders: number; description: string;
}> = [
  { slug: 'crivo-lite', name: 'CRIVO Lite', plan: Plan.BASE, monthly: 99000, setup: 150000, maxUsers: 30, maxLeaders: 5, description: 'Diagnóstico e dashboard executivo para times enxutos.' },
  { slug: 'crivo-professional', name: 'CRIVO Professional', plan: Plan.EVOLUCAO, monthly: 249000, setup: 350000, maxUsers: 120, maxLeaders: 20, description: 'Diagnóstico, ICD/Radar da Decisão, plano de ação e Academia.' },
  { slug: 'crivo-enterprise', name: 'CRIVO Enterprise', plan: Plan.ENTERPRISE, monthly: 590000, setup: 900000, maxUsers: 0, maxLeaders: 0, description: 'Ecossistema completo: diagnóstico, ICD, IA dos líderes, parecer consultivo e governança.' },
];

/**
 * Popula o essencial. Idempotente: só cria o que falta.
 * A senha do super admin NUNCA é sobrescrita em re-run — trocar a senha em
 * produção e depois rodar o bootstrap não pode devolver a senha de fábrica.
 */
export async function bootstrap(prisma: PrismaClient) {
  const criados: string[] = [];

  // 1) Super admin — só se ainda não existir NENHUM. A senha inicial é
  //    provisória e precisa ser trocada no primeiro acesso.
  const jaTemAdmin = await prisma.superAdmin.count();
  if (jaTemAdmin === 0) {
    const senha = process.env.CRIVO_SUPERADMIN_PASSWORD || 'crivo-super-123';
    await prisma.superAdmin.create({
      data: {
        email: process.env.CRIVO_SUPERADMIN_EMAIL || 'super@crivo.platform',
        name: 'Super Admin CRIVO',
        passwordHash: hash(senha),
      },
    });
    criados.push('super admin');
    if (!process.env.CRIVO_SUPERADMIN_PASSWORD) {
      console.warn('  [ATENÇÃO] super admin criado com a senha padrão — troque no primeiro acesso.');
    }
  }

  // 2) Catálogo RBAC (permissões + papéis de sistema + vínculos).
  const permId = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, action: p.action, label: p.label },
      create: { code: p.code, module: p.module, action: p.action, label: p.label },
    });
    permId.set(p.code, perm.id);
  }
  for (const [roleCode, perms] of Object.entries(ROLE_PERMISSIONS) as [Role, readonly string[]][]) {
    const role = await prisma.roleDef.upsert({
      where: { code: roleCode },
      update: { name: ROLE_LABELS[roleCode], isSystem: true },
      create: { code: roleCode, name: ROLE_LABELS[roleCode], isSystem: true },
    });
    for (const code of perms) {
      const pid = permId.get(code);
      if (!pid) continue;
      // Sem unique composto garantido no schema: checa antes de criar.
      const existe = await prisma.rolePermission.findFirst({ where: { roleId: role.id, permId: pid } });
      if (!existe) await prisma.rolePermission.create({ data: { roleId: role.id, permId: pid } });
    }
  }

  // 3) Catálogo global de módulos (F4). Fonte única em @crivo/types.
  for (const m of MODULES) {
    await prisma.moduleCatalog.upsert({
      where: { code: m.code },
      update: { name: m.name, category: m.category, minPlan: m.minPlan as Plan },
      create: { code: m.code, name: m.name, category: m.category, minPlan: m.minPlan as Plan },
    });
  }

  // 4) Catálogo de produtos. O de captura é OBRIGATÓRIO (a LP depende dele).
  //    Preço e limites não são sobrescritos em re-run: quem manda no comercial
  //    é o Super Admin, não este arquivo.
  await prisma.product.upsert({
    where: { slug: 'pre-diagnostico-crivo' },
    // update VAZIO de propósito: se o produto já existe, quem manda nele é o
    // Super Admin. Reescrever `diagnostic` aqui apagaria perguntas editadas na
    // tela — exatamente o tipo de estrago que este arquivo existe para evitar.
    update: {},
    create: {
      slug: 'pre-diagnostico-crivo',
      name: 'PRÉ-DIAGNÓSTICO CRIVO',
      description: 'Captura de leads da Landing Page via Diagnóstico Inicial. Sem acesso ao portal, app ou IA — gera leitura preliminar e oportunidade comercial no CRM.',
      status: 'ACTIVE',
      plan: null,
      monthlyPriceCents: 0,
      setupPriceCents: 0,
      maxUsers: 0,
      maxLeaders: 0,
      companyType: 'Todas',
      modules: [],
      diagnostic: preDiagnosticInstrument,
      aiConfig: undefined,
      isLeadCapture: true,
    },
  });
  for (const p of SALES_PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        status: 'ACTIVE',
        plan: p.plan,
        monthlyPriceCents: p.monthly,
        setupPriceCents: p.setup,
        maxUsers: p.maxUsers,
        maxLeaders: p.maxLeaders,
        companyType: 'Empresas de médio e grande porte',
        modules: modulesForPlan(p.plan as unknown as Parameters<typeof modulesForPlan>[0]),
        diagnostic: preDiagnosticInstrument,
        isLeadCapture: false,
      },
    });
  }

  return { criados };
}

// Execução direta: `pnpm --filter @crivo/db seed:bootstrap`
if (require.main === module) {
  const prisma = new PrismaClient();
  bootstrap(prisma)
    .then(({ criados }) => {
      console.log('Bootstrap concluído (idempotente, nada foi apagado).');
      if (criados.length) console.log('  criados nesta execução:', criados.join(', '));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
