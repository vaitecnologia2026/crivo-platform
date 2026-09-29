-- H-008 (decisão CRIVO 28/09/2026): o responsável por ação formal do Plano é
-- vinculado a usuário, cargo ou área; texto livre só para externo ou exceção.
--
-- ADITIVA e NULLABLE: nenhuma linha muda. As ações existentes ficam com tipo
-- NULL (texto legado): continuam no Dossiê como estão, mas uma ação só passa a
-- APROVADA depois de ter o responsável vinculado.
ALTER TABLE "action_items" ADD COLUMN "responsible_type" TEXT;
ALTER TABLE "action_items" ADD COLUMN "responsible_user_id" UUID;
ALTER TABLE "action_items" ADD COLUMN "responsible_reason" TEXT;

ALTER TABLE "action_items"
  ADD CONSTRAINT "action_items_responsible_type_check"
  CHECK ("responsible_type" IS NULL OR "responsible_type" IN ('USUARIO','CARGO','AREA','EXTERNO','EXCECAO'));

ALTER TABLE "action_items"
  ADD CONSTRAINT "action_items_responsible_user_id_fkey"
  FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "action_items_responsible_user_id_idx" ON "action_items"("responsible_user_id");
