-- Modelo de relatório passa a guardar o HTML FIEL do arquivo importado (.docx),
-- com tabelas, listas e formatação preservadas e os trechos dinâmicos marcados
-- com {{chave}}. Coluna aditiva e nullable: modelos existentes (só `sections`)
-- continuam gerando exatamente como antes.
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "html" TEXT;
