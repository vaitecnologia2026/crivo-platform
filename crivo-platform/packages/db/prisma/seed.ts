import { PrismaClient, Role, Plan, DominantPattern } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (s: string) => bcrypt.hashSync(s, 10);

// Dimensões do ICD (0–100). dominantPattern = maior sinal de risco entre os drivers.
const dims = (clareza: number, pressao: number, confianca: number, influencia: number, risco: number) =>
  ({ clareza, pressao, confianca, influencia, risco });

// Respostas representativas (não recalculadas pelo dashboard; ilustram o payload).
const sampleAnswers = Array.from({ length: 10 }, (_, i) => ({ questionId: i + 1, value: 3 }));

// Líderes de demonstração com scores variados e padrões distintos.
const LEADERS: Array<{
  name: string; email: string; role: Role; score: number;
  pattern: DominantPattern; dimensions: ReturnType<typeof dims>;
}> = [
  { name: 'Ana Beatriz Carvalho', email: 'ana.carvalho@crivo.demo', role: Role.GESTOR, score: 91, pattern: DominantPattern.EQUILIBRADO, dimensions: dims(94, 90, 92, 88, 91) },
  { name: 'Marina Souza',         email: 'marina.souza@crivo.demo',  role: Role.GESTOR, score: 86, pattern: DominantPattern.EQUILIBRADO, dimensions: dims(90, 84, 88, 82, 86) },
  { name: 'Rafael Moreira',       email: 'rafael.moreira@crivo.demo', role: Role.LIDER,  score: 73, pattern: DominantPattern.PRESSAO,     dimensions: dims(82, 54, 80, 76, 73) },
  { name: 'Carla Mendes',         email: 'carla.mendes@crivo.demo',   role: Role.LIDER,  score: 65, pattern: DominantPattern.CONFORMIDADE, dimensions: dims(70, 72, 74, 49, 60) },
  { name: 'João Pedro Lima',      email: 'joao.lima@crivo.demo',      role: Role.LIDER,  score: 58, pattern: DominantPattern.AUTOIMAGEM,   dimensions: dims(64, 66, 44, 60, 56) },
  { name: 'Eduardo Ramos',        email: 'eduardo.ramos@crivo.demo',  role: Role.LIDER,  score: 49, pattern: DominantPattern.AMEACA,       dimensions: dims(56, 58, 52, 50, 38) },
];

async function main() {
  // Seed de DEMONSTRAÇÃO: reseta os dados para ser determinístico em re-runs.
  // NÃO rodar em produção com dados reais.
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

  // 1) Tenant raiz + empresa
  const org = await prisma.organization.create({
    data: { name: 'CRIVO Demo — O2 Legacy', plan: Plan.ENTERPRISE },
  });
  await prisma.company.create({ data: { tenantId: org.id, name: 'O2 Legacy & Consulting' } });

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

  const media = Math.round(LEADERS.reduce((s, l) => s + l.score, 0) / LEADERS.length);
  console.log(
    `Seed concluído. Org ${org.id} · ${LEADERS.length} líderes · ICD médio ${media} · login: ceo@crivo.demo / crivo123`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
