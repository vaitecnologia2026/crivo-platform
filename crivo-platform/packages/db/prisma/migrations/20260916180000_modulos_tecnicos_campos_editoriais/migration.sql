-- Módulos Técnicos (Super Admin › Catálogo Comercial) — campos editoriais.
--
-- module_catalog só tinha code/name/category/minPlan (espelho de MODULES em
-- @crivo/types). O protótipo do Super Admin mostra, por módulo, a descrição
-- funcional, as dependências, as permissões e a regra de ativação técnica —
-- texto informativo para a equipe CRIVO, que não é regra executável (a
-- liberação continua sendo Solução/Adicional → Contrato → tenant_modules).
--
-- Aditiva: colunas opcionais + status com default; linhas existentes ficam
-- como estão. A tabela continua CATÁLOGO GLOBAL (bloco 5 do rls.sql: sem RLS
-- por tenant, INSERT/UPDATE/DELETE revogados de crivo_app — quem escreve é o
-- owner via Super Admin/seed), então nada muda em política aqui.
CREATE TYPE "ModuleCatalogStatus" AS ENUM ('ATIVO', 'BETA', 'INTERNO');

ALTER TABLE "module_catalog"
  ADD COLUMN "description"      TEXT,
  ADD COLUMN "dependenciesNote" TEXT,
  ADD COLUMN "permissionsNote"  TEXT,
  ADD COLUMN "releaseRule"      TEXT,
  ADD COLUMN "status"           "ModuleCatalogStatus" NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
