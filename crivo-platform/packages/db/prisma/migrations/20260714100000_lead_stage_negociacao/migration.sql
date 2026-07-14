-- Funil do CRM (mockup do cliente 14/07): etapa Negociação entre Proposta e Fechamento.
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'NEGOCIACAO' BEFORE 'FECHADO';
