// Fonte única do SEED da metodologia v1 (Fase 1 — metodologia configurável).
// Gera a migração com DDL + INSERTs (Railway só roda migrate:deploy, sem seed).
// Rodar: `node packages/db/prisma/data/methodology.source.mjs`
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Dados portados de packages/types/src/index.ts (v1 = padrão atual) ──
const PRE = {
  instrument: 'PRE_DIAGNOSTIC',
  versionId: '1d100000-0000-4000-8000-000000000001',
  label: 'Diagnóstico Inicial — v1 (padrão CRIVO)',
  bandKind: 'MATURITY',
  dimensions: [
    ['pressao_rotina', 'Pressão Organizacional e Rotina'],
    ['lideranca_sustentacao', 'Liderança e Sustentação'],
    ['cultura_comunicacao', 'Cultura, Comunicação e Segurança Psicológica'],
    ['fatores_psicossociais', 'Fatores Psicossociais e NR-1'],
    ['governanca_plano', 'Governança, Evidências e Plano de Ação'],
  ],
  questions: [
    ['pressao_rotina', 'A rotina da empresa permite que líderes e equipes atuem com clareza de prioridades, sem depender apenas de urgências e improvisos?'],
    ['pressao_rotina', 'A empresa consegue identificar quando pressão, sobrecarga ou mudanças constantes começam a afetar a execução, o clima e a qualidade das decisões?'],
    ['lideranca_sustentacao', 'Os líderes estão preparados para sustentar conversas difíceis, cobranças e decisões sem ampliar conflitos, ruídos ou insegurança?'],
    ['lideranca_sustentacao', 'A liderança possui rituais claros para acompanhar pessoas, prioridades, riscos e execução?'],
    ['cultura_comunicacao', 'As pessoas conseguem falar sobre problemas, riscos e dificuldades antes que eles se transformem em crise?'],
    ['cultura_comunicacao', 'A comunicação entre áreas favorece alinhamento, cooperação e tomada de decisão com clareza?'],
    ['fatores_psicossociais', 'A empresa já monitora sinais como afastamentos, turnover, conflitos, clima, queda de produtividade ou adoecimento relacionado ao trabalho?'],
    ['fatores_psicossociais', 'Existem ações estruturadas para identificar, registrar e tratar fatores psicossociais relacionados ao trabalho?'],
    ['governanca_plano', 'A empresa possui responsáveis, prazos, evidências e acompanhamento para tratar riscos psicossociais, culturais e organizacionais?'],
    ['governanca_plano', 'Os temas de liderança, cultura, riscos psicossociais e resultados são acompanhados de forma contínua pela gestão?'],
  ],
  // faixas de maturidade (computePreDiagnostic: >=80/60/40)
  bands: [
    ['INICIAL', 'Inicial', 0, 39, '#d04a4a'],
    ['EM_ESTRUTURACAO', 'Em estruturação', 40, 59, '#c4702a'],
    ['ESTRUTURADO', 'Estruturado', 60, 79, '#b07d2e'],
    ['AVANCADO', 'Avançado', 80, 100, '#1d9e75'],
  ],
};

const PSY = {
  instrument: 'PSYCHOSOCIAL',
  versionId: '1d100000-0000-4000-8000-000000000002',
  label: 'Diagnóstico Organizacional — v1 (psicossocial, em validação)',
  bandKind: 'RISK',
  dimensions: [
    ['demandas', 'Demandas e ritmo de trabalho'],
    ['controle', 'Autonomia e participação'],
    ['apoio', 'Apoio (liderança e colegas)'],
    ['reconhecimento', 'Reconhecimento e desenvolvimento'],
    ['clareza', 'Clareza de papel e justiça'],
    ['relacoes', 'Relações e segurança psicológica'],
  ],
  questions: [
    ['demandas', 'Consigo realizar meu trabalho sem sobrecarga frequente.'],
    ['demandas', 'O volume e o ritmo de trabalho são sustentáveis no dia a dia.'],
    ['controle', 'Tenho autonomia para organizar como faço minhas tarefas.'],
    ['controle', 'Minha opinião é considerada em decisões que afetam meu trabalho.'],
    ['apoio', 'Recebo apoio da minha liderança quando preciso.'],
    ['apoio', 'Posso contar com meus colegas diante de dificuldades.'],
    ['reconhecimento', 'Meu trabalho é reconhecido de forma justa.'],
    ['reconhecimento', 'Vejo perspectivas de desenvolvimento e crescimento na empresa.'],
    ['clareza', 'Sei com clareza o que se espera do meu papel.'],
    ['clareza', 'As regras e decisões da empresa são aplicadas de forma justa.'],
    ['relacoes', 'Sinto-me seguro(a) para falar de problemas sem medo de retaliação.'],
    ['relacoes', 'O ambiente é livre de assédio e desrespeito.'],
  ],
  // faixas de risco (psychosocialLevel: >=75 BAIXO / 55 / 35)
  bands: [
    ['CRITICO', 'Risco crítico', 0, 34, '#d04a4a'],
    ['ALTO', 'Risco alto', 35, 54, '#c4702a'],
    ['MODERADO', 'Risco moderado', 55, 74, '#b07d2e'],
    ['BAIXO', 'Risco baixo', 75, 100, '#1d9e75'],
  ],
};

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
let seq = 0;
// UUID determinístico (v4-shaped) para cada linha-filha.
const mk = () => {
  seq += 1;
  return `2d100000-0000-4000-8000-${seq.toString(16).padStart(12, '0')}`;
};

function seedFor(m) {
  const lines = [];
  lines.push(
    `INSERT INTO "methodology_versions" ("id","instrument","version","label","status","notes","published_at") VALUES (${q(m.versionId)}, '${m.instrument}', 1, ${q(m.label)}, 'ACTIVE', ${q('Versão inicial portada do padrão CRIVO.')}, CURRENT_TIMESTAMP);`,
  );
  m.dimensions.forEach(([slug, label], i) => {
    lines.push(
      `INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES (${q(mk())}, ${q(m.versionId)}, ${q(slug)}, ${q(label)}, 1, ${i});`,
    );
  });
  m.questions.forEach(([dim, text], i) => {
    lines.push(
      `INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES (${q(mk())}, ${q(m.versionId)}, ${q(dim)}, ${q(text)}, 1, false, ${i});`,
    );
  });
  m.bands.forEach(([code, label, min, max, color], i) => {
    lines.push(
      `INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES (${q(mk())}, ${q(m.versionId)}, '${m.bandKind}', ${q(code)}, ${q(label)}, ${min}, ${max}, ${q(color)}, ${i});`,
    );
  });
  return lines.join('\n');
}

const sql = `-- Metodologia configurável (Fase 1) — DDL + seed v1 (Railway não roda seed).

-- CreateEnum
CREATE TYPE "MethodologyInstrument" AS ENUM ('PRE_DIAGNOSTIC', 'PSYCHOSOCIAL');
CREATE TYPE "MethodologyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "MethodologyBandKind" AS ENUM ('MATURITY', 'RISK');

-- CreateTable
CREATE TABLE "methodology_versions" (
    "id" UUID NOT NULL,
    "instrument" "MethodologyInstrument" NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "MethodologyStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    CONSTRAINT "methodology_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "methodology_dimensions" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "methodology_dimensions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "methodology_questions" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "dimension_slug" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "inverse" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "methodology_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "methodology_bands" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "kind" "MethodologyBandKind" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "methodology_bands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "methodology_versions_instrument_version_key" ON "methodology_versions"("instrument", "version");
CREATE INDEX "methodology_versions_instrument_status_idx" ON "methodology_versions"("instrument", "status");
CREATE UNIQUE INDEX "methodology_dimensions_version_id_slug_key" ON "methodology_dimensions"("version_id", "slug");
CREATE INDEX "methodology_questions_version_id_idx" ON "methodology_questions"("version_id");
CREATE INDEX "methodology_bands_version_id_idx" ON "methodology_bands"("version_id");

-- AddForeignKey
ALTER TABLE "methodology_dimensions" ADD CONSTRAINT "methodology_dimensions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "methodology_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "methodology_questions" ADD CONSTRAINT "methodology_questions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "methodology_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "methodology_bands" ADD CONSTRAINT "methodology_bands_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "methodology_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed v1 (ACTIVE) — Pré-Diagnóstico + Psicossocial/Organizacional
${seedFor(PRE)}

${seedFor(PSY)}
`;

const outDir = join(__dirname, '..', 'migrations', '20260625100000_methodology_config');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'migration.sql'), sql);
console.log(`OK — ${sql.split('\n').length} linhas, seq=${seq} linhas-filhas → ${outDir}/migration.sql`);
