-- Renomeia o rótulo do instrumento built-in PRE_DIAGNOSTIC:
-- "Diagnóstico Inicial (LP)" → "Diagnóstico Executivo".
--
-- Só o nome exibido muda. O slug ("PRE_DIAGNOSTIC") e o id
-- ('3d100000-0000-4000-8000-000000000001') permanecem os mesmos, e toda a lógica
-- do motor chaveia por slug/id — nada de cálculo, vínculo ou histórico é afetado.
--
-- Por que uma migração nova em vez de editar 20260714200000_diagnostic_instruments:
-- aquela migração já está aplicada em produção e seu checksum está registrado em
-- _prisma_migrations. Alterar o arquivo faria o `prisma migrate deploy` falhar.
UPDATE "diagnostic_instruments"
   SET "name" = 'Diagnóstico Executivo',
       "updated_at" = CURRENT_TIMESTAMP
 WHERE "slug" = 'PRE_DIAGNOSTIC';
