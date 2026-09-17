-- Auditoria "Programas vs. protótipo Lovable" (17/09): o KPI "Horas
-- contratadas" da tela Mentorias e Agenda não tinha nenhuma fonte real no
-- contrato — ficava sempre "—". Adiciona o campo no próprio Contract para o
-- Super Admin informar e o portal exibir o valor real quando existir.
--
-- Puramente ADITIVA: 1 coluna nullable em contracts, nasce NULL para todo
-- contrato já cadastrado (o KPI continua mostrando "—" até ser preenchido).

ALTER TABLE "contracts" ADD COLUMN "contracted_hours" INTEGER;
