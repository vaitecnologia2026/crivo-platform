-- CRM Interno (PDF §4.2): ciclo comercial completo da captação ao pós-venda.
-- Aditivo e idempotente: só adiciona novos valores ao enum (não remove os antigos).
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'OPORTUNIDADE';
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'CONTRATO';
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'ONBOARDING';
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'IMPLANTACAO';
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'ENTREGA';
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'SUSTENTACAO';
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'RENOVACAO';
ALTER TYPE "PlatformLeadStage" ADD VALUE IF NOT EXISTS 'UPSELL';
