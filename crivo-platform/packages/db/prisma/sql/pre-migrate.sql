-- PRÉ-REQUISITO DAS MIGRATIONS — roda ANTES de `prisma migrate deploy`.
--
-- Por que existe: várias migrations criam policies de RLS inline (para serem
-- self-contained em produção) e essas policies referenciam `current_tenant()`.
-- A função, porém, é criada pelo `rls.sql`, que no `setup:prod` roda DEPOIS do
-- migrate. Em banco vazio a cadeia trava na 39ª migration
-- (20260618240000_psychosocial_questionnaire) com:
--     ERROR: function current_tenant() does not exist
-- e nenhuma das 48 seguintes é aplicada — ou seja, provisionar ambiente novo
-- não funcionava seguindo o manual.
--
-- A definição aqui é IDÊNTICA à do rls.sql (que roda depois e reaplica com
-- CREATE OR REPLACE). Se um dia mudar, mude nos dois lugares.
CREATE OR REPLACE FUNCTION current_tenant() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant', true), '')::uuid;
$$ LANGUAGE sql STABLE;
