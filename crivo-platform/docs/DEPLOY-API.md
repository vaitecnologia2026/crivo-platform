# Runbook — Deploy da API (`apps/api`) + Banco de produção

> Objetivo: colocar a API NestJS no ar com um Postgres real, para destravar o
> login da plataforma (`apps/web`). Você executa; este guia traz os comandos
> exatos. Tempo estimado: ~45–60 min.

## Cadeia de dependência (ordem obrigatória)

```
1. Provisionar Postgres  →  2. Migrations + RLS + Seed  →  3. Deploy da API
        →  4. Apontar o crivo-web para a API  →  5. (depois) de-mock das telas
```

⚠️ **Não deploye o `crivo-web` com o login real antes da Etapa 4.** Sem API no ar,
a plataforma fica sem login.

---

## Pré-requisitos
- Node 20+ e pnpm 9 instalados localmente.
- `psql` instalado (para aplicar a RLS) — ou usar o SQL editor do provedor.
- Conta no provedor de banco e no host da API (ver abaixo).

---

## Etapa 1 — Postgres de produção

Você precisa de **duas credenciais de conexão** no mesmo banco:

| Var | Papel | Pode ignorar RLS? | Usado por |
|---|---|---|---|
| `DATABASE_URL` | **owner / admin** | **SIM** (precisa de `BYPASSRLS` ou superuser) | migrations, seed, e o **login cross-tenant** |
| `DATABASE_URL_APP` | `crivo_app` (restrito) | **NÃO** | todas as queries de negócio (RLS por tenant) |

> 🔑 **Por que o owner precisa de BYPASSRLS:** o login busca o usuário por e-mail
> *antes* de saber o tenant (`auth.service.ts`), usando a conexão owner. Como a RLS
> está com `FORCE` (todas as tabelas), o owner só consegue ler se puder ignorar a
> RLS. Isso exige um papel com `rolbypassrls` ou superuser.

### Provedor recomendado: **Supabase**
O papel `postgres` do Supabase já vem com `BYPASSRLS` — a arquitetura de login
atual funciona sem alteração de código.

1. Crie um projeto em https://supabase.com → anote a senha do banco.
2. Em **Project Settings → Database → Connection string**, pegue a string
   (modo **Session** para migrations; **Transaction/pooler** para o runtime).
3. `DATABASE_URL` = string do papel `postgres` (owner, com BYPASSRLS).

### Alternativa: **Neon**
Funciona, mas o papel padrão do Neon **pode não permitir `BYPASSRLS`** (sem
superuser). Se o `ALTER ROLE ... BYPASSRLS` falhar, fale comigo — há uma pequena
mudança de código (login escopado por tenant via subdomínio, que é o desenho
final previsto no próprio `auth.service.ts`) que remove essa dependência.

---

## Etapa 2 — Migrations + RLS + Seed

Rode **localmente**, apontando para o banco de produção. **A ordem importa**
(com `FORCE` RLS, o seed precisa rodar *antes* da RLS):

```bash
cd crivo-platform
pnpm install

# 1) Exporte a conexão OWNER (com BYPASSRLS)
export DATABASE_URL="postgresql://postgres:<senha>@<host>:5432/postgres?sslmode=require"

# 2) Gera o client e aplica o schema
pnpm --filter @crivo/db generate
pnpm --filter @crivo/db migrate:deploy

# 3) SEED primeiro (cria org demo + 1º usuário) — antes da RLS
pnpm --filter @crivo/db seed
#   → login criado: ceo@crivo.demo / crivo123  (troque depois!)

# 4) Agora aplica a RLS (cria o papel crivo_app + policies + FORCE)
pnpm --filter @crivo/db rls
#   (se não tiver psql: copie o conteúdo de packages/db/prisma/sql/rls.sql
#    e rode no SQL editor do provedor)

# 5) Garanta o BYPASSRLS no owner (se o provedor não der por padrão).
#    Rode no SQL editor como papel privilegiado:
#       ALTER ROLE postgres BYPASSRLS;   -- ajuste o nome do papel owner
```

`DATABASE_URL_APP` = mesma string, trocando usuário/senha para
`crivo_app` / `crivo_app` (o papel e a senha são criados pelo `rls.sql`).
**Recomendado:** troque a senha do `crivo_app` por uma forte:
```sql
ALTER ROLE crivo_app PASSWORD '<senha-forte>';
```

---

## Etapa 3 — Deploy da API

A API é NestJS com transações interativas por request (`forTenant`). Isso roda
**muito melhor num host de processo persistente** do que em serverless (evita o
problema de pooling/transação do PgBouncer em serverless).

### Opção A (recomendada): Railway ou Render

Configuração do serviço (a partir da raiz `crivo-platform/`):

| Campo | Valor |
|---|---|
| Install | `pnpm install` |
| Build | `pnpm --filter @crivo/db generate && pnpm --filter @crivo/db build && pnpm --filter @crivo/api build` |
| Start | `node apps/api/dist/main.js` |
| Health check path | `/api/health` |

**Variáveis de ambiente** no serviço:
```
DATABASE_URL=postgresql://postgres:<senha>@<host>:5432/postgres?sslmode=require
DATABASE_URL_APP=postgresql://crivo_app:<senha>@<host>:5432/postgres?sslmode=require
AUTH_SECRET=<gere com: openssl rand -base64 48>
JWT_EXPIRES_IN=7d
WEB_URL=https://app.crivolegacy.com.br
# PORT é injetada pelo host automaticamente (o main.ts já respeita)
```
> A API **não sobe** sem `AUTH_SECRET` (≥32) nem `DATABASE_URL_APP` — isso é
> proposital (evita segredo público e RLS desligada).

Após o deploy, a API fica em algo como `https://crivo-api.up.railway.app`, e os
endpoints em `https://crivo-api.up.railway.app/api/...` (prefixo global `/api`).

### Opção B: Vercel serverless
Já existe `apps/api/api/index.ts` + `vercel.json`. Crie um projeto Vercel
`crivo-api` com Root `apps/api`, mesmas env vars. Caveats: cold start, e o
pooling de transações exige `?pgbouncer=true&connection_limit=1` na
`DATABASE_URL_APP` + um pooler. Por isso a Opção A é preferível para este app.

---

## Etapa 4 — Apontar o `crivo-web` para a API

No projeto Vercel **`crivo-web`** → Settings → Environment Variables:

```
API_URL=https://<seu-host-da-api>/api      ←  ATENÇÃO: inclua o /api no final
WEB_URL=https://app.crivolegacy.com.br
```
> O `next.config.mjs` mapeia `API_URL` → `NEXT_PUBLIC_API_URL`. O cliente
> (`lib/api.ts`) chama `/auth/login`, então a base **precisa** terminar em `/api`
> → `https://host/api/auth/login`.

Redeploy do `crivo-web` para embutir a env no build:
```bash
cd crivo-platform && vercel deploy --prod   # projeto crivo-web
```

E garanta o CORS: `WEB_URL` da API deve listar o domínio do front
(`https://app.crivolegacy.com.br`), senão o navegador bloqueia as chamadas.

---

## Etapa 5 — Smoke test (valide antes de anunciar)

```bash
API=https://<seu-host-da-api>/api

# 1) Health
curl -s $API/health            # → {"status":"ok",...}

# 2) Login correto
curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ceo@crivo.demo","password":"crivo123"}'
#   → {"token":"...","user":{...}}

# 3) Login errado (deve dar 401)
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ceo@crivo.demo","password":"errada"}'
#   → 401
```

Depois, na plataforma (`app.crivolegacy.com.br`): logar com `ceo@crivo.demo /
crivo123` deve abrir o app; senha errada deve mostrar "E-mail ou senha inválidos".

---

## ✅ Checklist final
- [ ] Banco provisionado; owner com BYPASSRLS; `crivo_app` criado e com senha forte
- [ ] `migrate:deploy` → `seed` → `rls` rodados **nessa ordem**, sem erro
- [ ] API no ar; `GET /api/health` responde `ok`
- [ ] API não sobe sem `AUTH_SECRET`/`DATABASE_URL_APP` (testado)
- [ ] Login correto retorna token; login errado retorna 401
- [ ] Isolamento: usuário do tenant A não vê dados do tenant B (testar com 2 orgs)
- [ ] `crivo-web` com `API_URL=.../api` e CORS liberado; login funciona pela UI
- [ ] Trocar a senha do usuário demo `ceo@crivo.demo` (ou criar usuários reais)

---

## Depois disto → Fase seguinte (de-mock)
Com a API no ar e dados reais, substituímos as 9 telas estáticas (`markup.ts`)
por componentes que buscam dados via `apiFetch` (Dashboard/ICD primeiro), com
estados de loading/erro/vazio. É a virada final de "maquete" para "produto".
