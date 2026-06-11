-- FASE 3 (conversão Lead → Cliente): a empresa nasce de um Produto.
-- Liga o tenant ao produto contratado (sem FK Prisma, para manter o control
-- plane desacoplado — mesma convenção de organizationId).
ALTER TABLE "tenants" ADD COLUMN "productId" UUID;
