-- OBJETIVO da medida no Plano de Evolução.
--
-- ADITIVA e NULLABLE: nenhuma linha existente muda, nenhum código que não
-- conhece a coluna quebra. Ações já no plano ficam com objetivo nulo até que a
-- organização preencha (ou até que uma nova sugestão da IA o traga pronto).
--
-- Por que existe: o modelo oficial do Dossiê Técnico tem a coluna "Objetivo" na
-- tabela do Plano de ação, e o sistema não tinha onde guardar esse texto — a
-- sugestão da IA escrevia o objetivo e ele era perdido ao virar ação.
ALTER TABLE "action_items" ADD COLUMN "objective" TEXT;
