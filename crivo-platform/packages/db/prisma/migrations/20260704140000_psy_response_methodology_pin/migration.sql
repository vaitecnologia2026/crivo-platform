-- MET1 — trilha de metodologia por resposta psicossocial.
-- A versão de metodologia que EFETIVAMENTE pontuou a resposta é pinada no
-- momento do score, para rastreabilidade/comparabilidade. Republicar a
-- metodologia não altera respostas já pontuadas.
ALTER TABLE "psychosocial_responses" ADD COLUMN "methodologyVersionId" UUID;
CREATE INDEX "psychosocial_responses_methodologyVersionId_idx" ON "psychosocial_responses"("methodologyVersionId");
