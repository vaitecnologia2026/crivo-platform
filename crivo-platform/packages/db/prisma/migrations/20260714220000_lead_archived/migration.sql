-- Kanban do CRM (call 14/07): jornada concluída sai do funil (arquivamento).
ALTER TABLE "platform_leads" ADD COLUMN "archived_at" TIMESTAMP(3);
