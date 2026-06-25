-- Metodologia configurável (Fase 1) — DDL + seed v1 (Railway não roda seed).

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
INSERT INTO "methodology_versions" ("id","instrument","version","label","status","notes","published_at") VALUES ('1d100000-0000-4000-8000-000000000001', 'PRE_DIAGNOSTIC', 1, 'Diagnóstico Inicial — v1 (padrão CRIVO)', 'ACTIVE', 'Versão inicial portada do padrão CRIVO.', CURRENT_TIMESTAMP);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000001', '1d100000-0000-4000-8000-000000000001', 'pressao_rotina', 'Pressão Organizacional e Rotina', 1, 0);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000002', '1d100000-0000-4000-8000-000000000001', 'lideranca_sustentacao', 'Liderança e Sustentação', 1, 1);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000003', '1d100000-0000-4000-8000-000000000001', 'cultura_comunicacao', 'Cultura, Comunicação e Segurança Psicológica', 1, 2);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000004', '1d100000-0000-4000-8000-000000000001', 'fatores_psicossociais', 'Fatores Psicossociais e NR-1', 1, 3);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000005', '1d100000-0000-4000-8000-000000000001', 'governanca_plano', 'Governança, Evidências e Plano de Ação', 1, 4);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000006', '1d100000-0000-4000-8000-000000000001', 'pressao_rotina', 'A rotina da empresa permite que líderes e equipes atuem com clareza de prioridades, sem depender apenas de urgências e improvisos?', 1, false, 0);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000007', '1d100000-0000-4000-8000-000000000001', 'pressao_rotina', 'A empresa consegue identificar quando pressão, sobrecarga ou mudanças constantes começam a afetar a execução, o clima e a qualidade das decisões?', 1, false, 1);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000008', '1d100000-0000-4000-8000-000000000001', 'lideranca_sustentacao', 'Os líderes estão preparados para sustentar conversas difíceis, cobranças e decisões sem ampliar conflitos, ruídos ou insegurança?', 1, false, 2);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000009', '1d100000-0000-4000-8000-000000000001', 'lideranca_sustentacao', 'A liderança possui rituais claros para acompanhar pessoas, prioridades, riscos e execução?', 1, false, 3);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000000a', '1d100000-0000-4000-8000-000000000001', 'cultura_comunicacao', 'As pessoas conseguem falar sobre problemas, riscos e dificuldades antes que eles se transformem em crise?', 1, false, 4);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000000b', '1d100000-0000-4000-8000-000000000001', 'cultura_comunicacao', 'A comunicação entre áreas favorece alinhamento, cooperação e tomada de decisão com clareza?', 1, false, 5);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000000c', '1d100000-0000-4000-8000-000000000001', 'fatores_psicossociais', 'A empresa já monitora sinais como afastamentos, turnover, conflitos, clima, queda de produtividade ou adoecimento relacionado ao trabalho?', 1, false, 6);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000000d', '1d100000-0000-4000-8000-000000000001', 'fatores_psicossociais', 'Existem ações estruturadas para identificar, registrar e tratar fatores psicossociais relacionados ao trabalho?', 1, false, 7);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000000e', '1d100000-0000-4000-8000-000000000001', 'governanca_plano', 'A empresa possui responsáveis, prazos, evidências e acompanhamento para tratar riscos psicossociais, culturais e organizacionais?', 1, false, 8);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000000f', '1d100000-0000-4000-8000-000000000001', 'governanca_plano', 'Os temas de liderança, cultura, riscos psicossociais e resultados são acompanhados de forma contínua pela gestão?', 1, false, 9);
INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES ('2d100000-0000-4000-8000-000000000010', '1d100000-0000-4000-8000-000000000001', 'MATURITY', 'INICIAL', 'Inicial', 0, 39, '#d04a4a', 0);
INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES ('2d100000-0000-4000-8000-000000000011', '1d100000-0000-4000-8000-000000000001', 'MATURITY', 'EM_ESTRUTURACAO', 'Em estruturação', 40, 59, '#c4702a', 1);
INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES ('2d100000-0000-4000-8000-000000000012', '1d100000-0000-4000-8000-000000000001', 'MATURITY', 'ESTRUTURADO', 'Estruturado', 60, 79, '#b07d2e', 2);
INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES ('2d100000-0000-4000-8000-000000000013', '1d100000-0000-4000-8000-000000000001', 'MATURITY', 'AVANCADO', 'Avançado', 80, 100, '#1d9e75', 3);

INSERT INTO "methodology_versions" ("id","instrument","version","label","status","notes","published_at") VALUES ('1d100000-0000-4000-8000-000000000002', 'PSYCHOSOCIAL', 1, 'Diagnóstico Organizacional — v1 (psicossocial, em validação)', 'ACTIVE', 'Versão inicial portada do padrão CRIVO.', CURRENT_TIMESTAMP);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000014', '1d100000-0000-4000-8000-000000000002', 'demandas', 'Demandas e ritmo de trabalho', 1, 0);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000015', '1d100000-0000-4000-8000-000000000002', 'controle', 'Autonomia e participação', 1, 1);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000016', '1d100000-0000-4000-8000-000000000002', 'apoio', 'Apoio (liderança e colegas)', 1, 2);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000017', '1d100000-0000-4000-8000-000000000002', 'reconhecimento', 'Reconhecimento e desenvolvimento', 1, 3);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000018', '1d100000-0000-4000-8000-000000000002', 'clareza', 'Clareza de papel e justiça', 1, 4);
INSERT INTO "methodology_dimensions" ("id","version_id","slug","label","weight","order") VALUES ('2d100000-0000-4000-8000-000000000019', '1d100000-0000-4000-8000-000000000002', 'relacoes', 'Relações e segurança psicológica', 1, 5);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000001a', '1d100000-0000-4000-8000-000000000002', 'demandas', 'Consigo realizar meu trabalho sem sobrecarga frequente.', 1, false, 0);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000001b', '1d100000-0000-4000-8000-000000000002', 'demandas', 'O volume e o ritmo de trabalho são sustentáveis no dia a dia.', 1, false, 1);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000001c', '1d100000-0000-4000-8000-000000000002', 'controle', 'Tenho autonomia para organizar como faço minhas tarefas.', 1, false, 2);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000001d', '1d100000-0000-4000-8000-000000000002', 'controle', 'Minha opinião é considerada em decisões que afetam meu trabalho.', 1, false, 3);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000001e', '1d100000-0000-4000-8000-000000000002', 'apoio', 'Recebo apoio da minha liderança quando preciso.', 1, false, 4);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-00000000001f', '1d100000-0000-4000-8000-000000000002', 'apoio', 'Posso contar com meus colegas diante de dificuldades.', 1, false, 5);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000020', '1d100000-0000-4000-8000-000000000002', 'reconhecimento', 'Meu trabalho é reconhecido de forma justa.', 1, false, 6);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000021', '1d100000-0000-4000-8000-000000000002', 'reconhecimento', 'Vejo perspectivas de desenvolvimento e crescimento na empresa.', 1, false, 7);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000022', '1d100000-0000-4000-8000-000000000002', 'clareza', 'Sei com clareza o que se espera do meu papel.', 1, false, 8);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000023', '1d100000-0000-4000-8000-000000000002', 'clareza', 'As regras e decisões da empresa são aplicadas de forma justa.', 1, false, 9);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000024', '1d100000-0000-4000-8000-000000000002', 'relacoes', 'Sinto-me seguro(a) para falar de problemas sem medo de retaliação.', 1, false, 10);
INSERT INTO "methodology_questions" ("id","version_id","dimension_slug","text","weight","inverse","order") VALUES ('2d100000-0000-4000-8000-000000000025', '1d100000-0000-4000-8000-000000000002', 'relacoes', 'O ambiente é livre de assédio e desrespeito.', 1, false, 11);
INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES ('2d100000-0000-4000-8000-000000000026', '1d100000-0000-4000-8000-000000000002', 'RISK', 'CRITICO', 'Risco crítico', 0, 34, '#d04a4a', 0);
INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES ('2d100000-0000-4000-8000-000000000027', '1d100000-0000-4000-8000-000000000002', 'RISK', 'ALTO', 'Risco alto', 35, 54, '#c4702a', 1);
INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES ('2d100000-0000-4000-8000-000000000028', '1d100000-0000-4000-8000-000000000002', 'RISK', 'MODERADO', 'Risco moderado', 55, 74, '#b07d2e', 2);
INSERT INTO "methodology_bands" ("id","version_id","kind","code","label","min","max","color","order") VALUES ('2d100000-0000-4000-8000-000000000029', '1d100000-0000-4000-8000-000000000002', 'RISK', 'BAIXO', 'Risco baixo', 75, 100, '#1d9e75', 3);
