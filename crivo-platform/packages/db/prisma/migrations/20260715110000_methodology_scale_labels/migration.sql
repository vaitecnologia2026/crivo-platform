-- Escala de resposta editável por versão (aba "Escalas e regras" do mockup 15/07).
-- Aditivo: vazio = escala padrão CRIVO. Não altera a pontuação.
ALTER TABLE "methodology_versions" ADD COLUMN "scale_labels" TEXT[] NOT NULL DEFAULT '{}';
