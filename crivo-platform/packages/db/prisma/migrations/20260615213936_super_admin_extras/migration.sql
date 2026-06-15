-- Super Admin extras (#54):
-- 1. Mentorias (Briefing §10, Matriz §Mentorias) — agenda + status do líder.
-- 2. ActionTemplate — biblioteca GLOBAL de ações modelo (Matriz §Plano de Ação).
-- 3. EditableText — copy do produto editável sem deploy (key-value, versionado).
-- 4. GlobalAcademyContent — catálogo GLOBAL da Academia CRIVO.

-- CreateEnum (Mentoria)
CREATE TYPE "MentoriaFormat" AS ENUM ('ONLINE', 'PRESENCIAL', 'HIBRIDA');
CREATE TYPE "MentoriaStatus" AS ENUM ('AGENDADA', 'REALIZADA', 'CANCELADA', 'REAGENDADA');

-- CreateTable: mentorias
CREATE TABLE "mentorias" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "format" "MentoriaFormat" NOT NULL DEFAULT 'ONLINE',
    "mentorName" TEXT NOT NULL,
    "attendee" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "meetingUrl" TEXT,
    "location" TEXT,
    "status" "MentoriaStatus" NOT NULL DEFAULT 'AGENDADA',
    "notes" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable: action_templates
CREATE TABLE "action_templates" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "suggestedResponsible" TEXT,
    "expectedEvidence" TEXT,
    "defaultReviewDays" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: editable_texts
CREATE TABLE "editable_texts" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'geral',
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editable_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: global_academy_content
CREATE TABLE "global_academy_content" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_academy_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentorias_tenantId_idx" ON "mentorias"("tenantId");
CREATE INDEX "mentorias_scheduledAt_idx" ON "mentorias"("scheduledAt");
CREATE INDEX "mentorias_status_idx" ON "mentorias"("status");
CREATE INDEX "action_templates_category_idx" ON "action_templates"("category");
CREATE INDEX "action_templates_active_idx" ON "action_templates"("active");
CREATE UNIQUE INDEX "editable_texts_key_key" ON "editable_texts"("key");
CREATE INDEX "editable_texts_category_idx" ON "editable_texts"("category");
CREATE INDEX "global_academy_content_published_idx" ON "global_academy_content"("published");
CREATE INDEX "global_academy_content_kind_idx" ON "global_academy_content"("kind");
