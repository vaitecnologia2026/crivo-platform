import { PrismaClient, Role, Plan, DominantPattern, LeadStage } from '@prisma/client';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS, MODULES, modulesForPlan } from '@crivo/types';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (s: string) => bcrypt.hashSync(s, 10);

// Dimensões do ICD — os 4 Rs (0–100, coerência: maior = melhor). A tensão
// dominante é o R de menor coerência (ou EQUILIBRADO).
const dims = (reatividade: number, rigidez: number, repercussao: number, risco: number) =>
  ({ reatividade, rigidez, repercussao, risco });

// Respostas representativas (não recalculadas pelo dashboard; ilustram o payload).
const sampleAnswers = Array.from({ length: 8 }, (_, i) => ({ questionId: i + 1, value: 3 }));

// Líderes de demonstração com scores variados e tensões dominantes distintas.
const LEADERS: Array<{
  name: string; email: string; role: Role; score: number;
  pattern: DominantPattern; dimensions: ReturnType<typeof dims>;
}> = [
  { name: 'Ana Beatriz Carvalho', email: 'ana.carvalho@crivo.demo', role: Role.GESTOR, score: 91, pattern: DominantPattern.EQUILIBRADO, dimensions: dims(94, 90, 92, 88) },
  { name: 'Marina Souza',         email: 'marina.souza@crivo.demo',  role: Role.GESTOR, score: 86, pattern: DominantPattern.EQUILIBRADO, dimensions: dims(90, 84, 88, 82) },
  { name: 'Rafael Moreira',       email: 'rafael.moreira@crivo.demo', role: Role.LIDER,  score: 73, pattern: DominantPattern.REATIVIDADE, dimensions: dims(54, 80, 82, 76) },
  { name: 'Carla Mendes',         email: 'carla.mendes@crivo.demo',   role: Role.LIDER,  score: 65, pattern: DominantPattern.RIGIDEZ,     dimensions: dims(72, 49, 70, 69) },
  { name: 'João Pedro Lima',      email: 'joao.lima@crivo.demo',      role: Role.LIDER,  score: 58, pattern: DominantPattern.REPERCUSSAO, dimensions: dims(64, 60, 44, 64) },
  { name: 'Eduardo Ramos',        email: 'eduardo.ramos@crivo.demo',  role: Role.LIDER,  score: 49, pattern: DominantPattern.RISCO,       dimensions: dims(56, 52, 50, 38) },
];

async function main() {
  // Seed de DEMONSTRAÇÃO: reseta os dados para ser determinístico em re-runs.
  // NÃO rodar em produção com dados reais.
  await prisma.auditLog.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.roleDef.deleteMany();
  await prisma.libraryItem.deleteMany();
  await prisma.tenantDomain.deleteMany();
  await prisma.tenantBranding.deleteMany();
  await prisma.tenantModule.deleteMany();
  await prisma.moduleCatalog.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.superAdmin.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.icdScore.deleteMany();
  await prisma.response.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.assessmentCycle.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.company.deleteMany();
  await prisma.organization.deleteMany();

  // 0) Super Admin global (control plane). Acesso ao painel de plataforma.
  await prisma.superAdmin.create({
    data: {
      email: 'super@crivo.platform',
      name: 'Super Admin CRIVO',
      passwordHash: hash('crivo-super-123'),
    },
  });

  // 0.1) Catálogo RBAC global (F3): permissões + papéis de sistema + vínculos.
  const permId = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const created = await prisma.permission.create({
      data: { code: p.code, module: p.module, action: p.action, label: p.label },
    });
    permId.set(p.code, created.id);
  }
  for (const [roleCode, perms] of Object.entries(ROLE_PERMISSIONS) as [Role, readonly string[]][]) {
    const role = await prisma.roleDef.create({
      data: { code: roleCode, name: ROLE_LABELS[roleCode], isSystem: true },
    });
    for (const code of perms) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permId: permId.get(code)! } });
    }
  }

  // 0.2) Catálogo GLOBAL de módulos (F4). Fonte única em @crivo/types.
  for (const m of MODULES) {
    await prisma.moduleCatalog.create({
      data: { code: m.code, name: m.name, category: m.category, minPlan: m.minPlan as Plan },
    });
  }

  // 1) Tenant raiz + empresa
  const org = await prisma.organization.create({
    data: { name: 'CRIVO Demo — O2 Legacy', plan: Plan.ENTERPRISE },
  });
  // Registro no control plane (espelha a org; liga por organizationId).
  await prisma.tenant.create({
    data: {
      organizationId: org.id,
      slug: 'o2legacy',
      name: org.name,
      plan: Plan.ENTERPRISE,
      status: 'ACTIVE',
    },
  });
  await prisma.company.create({ data: { tenantId: org.id, name: 'O2 Legacy & Consulting' } });

  // 1.1) Módulos ativos da empresa, conforme o plano (ENTERPRISE → tudo até enterprise).
  for (const code of modulesForPlan('ENTERPRISE')) {
    await prisma.tenantModule.create({ data: { tenantId: org.id, moduleCode: code, enabled: true } });
  }

  // 1.2) White-label de exemplo (F5) — inerte até a injeção visual (próxima fatia).
  await prisma.tenantBranding.create({
    data: {
      tenantId: org.id,
      primaryColor: '#0d1f3c',
      accentColor: '#c4894a',
      whatsapp: '(11) 91853-1796',
      footerText: 'O2 Legacy & Consulting · powered by CRIVO',
    },
  });

  // 1.3) Domínio próprio de exemplo (F5) — alimenta a resolução pública por host.
  await prisma.tenantDomain.create({
    data: { organizationId: org.id, domain: 'o2legacy.crivolegacy.com.br', verified: true, primary: true },
  });

  // 1.4) Biblioteca de exemplo (conteúdo do tenant).
  await prisma.libraryItem.createMany({
    data: [
      { tenantId: org.id, title: 'Decisão sob pressão: o guia CRIVO', kind: 'artigo', description: 'Como manter coerência quando o relógio aperta.', url: 'https://crivolegacy.com.br/artigos/decisao-sob-pressao' },
      { tenantId: org.id, title: 'Podcast · Liderança e segunda opinião', kind: 'podcast', description: 'Conversa sobre o papel do copiloto decisório.', url: 'https://crivolegacy.com.br/podcast/01' },
      { tenantId: org.id, title: 'E-book · NR-1 na prática', kind: 'ebook', description: 'Riscos psicossociais e o que a norma exige.', url: 'https://crivolegacy.com.br/ebooks/nr1' },
      { tenantId: org.id, title: 'Framework de feedback em 3 atos', kind: 'framework', description: 'Estrutura para conversas difíceis.', url: null },
    ],
  });

  // 2) CEO (login de acesso ao painel executivo)
  await prisma.user.create({
    data: {
      tenantId: org.id, email: 'ceo@crivo.demo', name: 'CEO Demo',
      role: Role.CEO, passwordHash: hash('crivo123'),
    },
  });

  // 3) Ciclo de avaliação aberto
  const cycle = await prisma.assessmentCycle.create({
    data: { tenantId: org.id, name: 'Ciclo 2026.1', status: 'OPEN' },
  });

  // 4) Líderes + avaliação + resposta + score ICD
  for (const l of LEADERS) {
    const leader = await prisma.user.create({
      data: {
        tenantId: org.id, email: l.email, name: l.name,
        role: l.role, passwordHash: hash('crivo123'),
      },
    });
    const assessment = await prisma.assessment.create({
      data: { tenantId: org.id, leaderId: leader.id, cycleId: cycle.id, type: 'ICD' },
    });
    await prisma.response.create({
      data: { tenantId: org.id, assessmentId: assessment.id, answers: sampleAnswers },
    });
    await prisma.icdScore.create({
      data: {
        tenantId: org.id, assessmentId: assessment.id, leaderId: leader.id,
        score: l.score, dimensions: l.dimensions, dominantPattern: l.pattern,
      },
    });
  }

  // 5) Pipeline comercial de demonstração
  const LEADS = [
    { name: 'Patrícia Gomes', company: 'Indústrias Verana', email: 'patricia@verana.com.br', whatsapp: '(11) 98888-1010', segment: 'Indústria', origin: 'lp-diagnostico', stage: LeadStage.NOVO },
    { name: 'Marcos Tavares', company: 'Rede Sollar Varejo', email: 'marcos@sollar.com.br', whatsapp: '(21) 97777-2020', segment: 'Varejo', origin: 'lp-diagnostico', stage: LeadStage.CONTATO },
    { name: 'Beatriz Nunes', company: 'Clínica Vitalis', email: 'bia@vitalis.com.br', whatsapp: '(31) 96666-3030', segment: 'Saúde', origin: 'lp-ebook-nr1', stage: LeadStage.QUALIFICADO },
    { name: 'Henrique Sá', company: 'Banco Meridiano', email: 'henrique@meridiano.com.br', whatsapp: '(11) 95555-4040', segment: 'Serviços financeiros', origin: 'manual', stage: LeadStage.PROPOSTA },
    { name: 'Luiza Prado', company: 'TecNova Sistemas', email: 'luiza@tecnova.com.br', whatsapp: '(48) 94444-5050', segment: 'Tecnologia', origin: 'lp-diagnostico', stage: LeadStage.GANHO },
    { name: 'Roberto Dias', company: 'Construtora Âncora', email: 'roberto@ancora.com.br', whatsapp: '(81) 93333-6060', segment: 'Construção / Engenharia', origin: 'lp-ebook-nr1', stage: LeadStage.PERDIDO },
    { name: 'Camila Reis', company: 'Logística Brasil Sul', email: 'camila@lbsul.com.br', whatsapp: '(51) 92222-7070', segment: 'Logística e transporte', origin: 'lp-diagnostico', stage: LeadStage.NOVO },
  ];
  for (const ld of LEADS) {
    await prisma.lead.create({ data: { tenantId: org.id, ...ld } });
  }

  const media = Math.round(LEADERS.reduce((s, l) => s + l.score, 0) / LEADERS.length);
  console.log(
    `Seed concluído. Org ${org.id} · ${LEADERS.length} líderes · ICD médio ${media}\n` +
      `  • login tenant:      ceo@crivo.demo / crivo123\n` +
      `  • login super admin: super@crivo.platform / crivo-super-123 (POST /api/admin/auth/login)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
