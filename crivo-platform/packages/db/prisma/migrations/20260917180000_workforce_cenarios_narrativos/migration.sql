-- Auditoria "Programas vs. protótipo Lovable" (17/09): a aba "Cenários Pessoa
-- × Processo × IA" do protótipo compara, por tarefa, 3 narrativas de transição
-- — Cenário Atual, Cenário Assistido por IA e Cenário Redesenhado — que não
-- tinham campo equivalente no modelo real (só existia a categoria `scenario`).
--
-- Puramente ADITIVA: 3 colunas de texto livre opcionais em work_tasks, que
-- nascem NULL para toda tarefa já cadastrada. Não substitui `scenario`.

ALTER TABLE "work_tasks" ADD COLUMN "scenario_current" TEXT;
ALTER TABLE "work_tasks" ADD COLUMN "scenario_assisted" TEXT;
ALTER TABLE "work_tasks" ADD COLUMN "scenario_redesigned" TEXT;
