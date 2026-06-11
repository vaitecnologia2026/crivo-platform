# Runbook — Deploy da API (`apps/api`) + Banco de produção

> Objetivo: colocar a API NestJS no ar com um Postgres real, para destravar o
> login da plataforma (`apps/web`). Você executa; este guia traz os comandos
> exatos. Tempo estimado: ~45–60 min.

## Cadeia de dependência (ordem obrigatória)

```
1. Provisionar Postgres  →  2. Migrations + Seed + RLS  →  3. Deploy da API
   →  4. Apontar o crivo-web para a API  →  4.1 Site de marketing  →  5. Smoke test
```
> O de-mock das 9 telas já está concluído (ver "Estado do produto" no fim).

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

# 3) SEED primeiro — antes da RLS (o seed escreve catálogos que a RLS deixa
#    somente-leitura: permissões, papéis, módulos). Cria org demo + usuários +
#    super admin + catálogo de módulos/permissões + branding/domínio/biblioteca demo.
pnpm --filter @crivo/db seed
#   → login plataforma:  ceo@crivo.demo / crivo123        (troque depois!)
#   → login super admin: super@crivo.platform / crivo-super-123  (troque depois!)
#   ⚠️ Em produção real, prefira NÃO rodar o seed de demonstração (ele apaga e
#      recria dados). Para um tenant real, provisione via /superadm. O seed é
#      ideal para validar o ambiente; depois limpe os dados demo.

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
# Loop captação → CRM (opcional, mas necessário p/ a LP criar leads no pipeline):
LEAD_INTAKE_SECRET=<gere um segredo forte; o MESMO valor vai no crivo-site>
LEAD_INTAKE_TENANT=<organizationId do tenant que recebe os leads da LP>
# PORT é injetada pelo host automaticamente (o main.ts já respeita)
```
> A API **não sobe** sem `AUTH_SECRET` (≥32) nem `DATABASE_URL_APP` — isso é
> proposital (evita segredo público e RLS desligada).
>
> **`WEB_URL` aceita vários domínios** separados por vírgula (CORS). A plataforma e o
> painel `/superadm` ficam no mesmo origin (`app.crivolegacy.com.br`). O site de
> marketing chama a API pelo servidor (não pelo browser), então **não** precisa
> entrar no CORS.
>
> **`LEAD_INTAKE_TENANT`** é o `organizationId` do tenant que vai receber os leads da
> landing page. Você só o tem **depois** de provisionar ao menos uma empresa (Etapa 5
> ou via `/superadm`): pegue em `GET /api/admin/tenants` (campo `organizationId`) ou
> no banco (`SELECT id FROM organizations`). Sem `LEAD_INTAKE_SECRET`+`LEAD_INTAKE_TENANT`,
> o intake fica desligado (a LP cai no fallback de e-mail/log).

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

## Etapa 4.1 — Site de marketing (`crivo-site`)

Projeto Vercel **`crivo-site`** (Root `apps/site`) → Environment Variables:

```
# Gate de acesso (token VAI) — a comparação é server-side
SITE_ACCESS_TOKEN=<token de acesso ao site; default de dev é VAI2026>
GATE_SECRET=<segredo forte p/ assinar o cookie do gate — openssl rand -base64 32>

# Captação de leads (escolha 1+; se nenhum, o lead vai só pro log):
#  a) loop direto no CRM (recomendado) — MESMO segredo da API:
PLATFORM_API_URL=https://<seu-host-da-api>/api
LEAD_INTAKE_SECRET=<igual ao da API>
#  b) e-mail (Resend):
RESEND_API_KEY=<chave Resend>
LEAD_FROM_EMAIL=contato@crivolegacy.com.br
LEAD_TO_EMAIL=contato@crivolegacy.com.br
#  c) webhook genérico (opcional):
LEAD_WEBHOOK_URL=<url>
```
> A LP (`/api/lead`) tenta o intake no CRM (a), depois e-mail (b), depois webhook (c).
> O loop (a) exige que a API esteja no ar e que `LEAD_INTAKE_TENANT` esteja setado nela.

Deploy: `cd crivo-platform && vercel deploy --prod` (projeto `crivo-site`). O cutover
de DNS de `crivolegacy.com.br` para este projeto já está concluído (ver CLAUDE.md).

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

# 4) Super admin (control plane) — login + listar empresas
ADMIN=$(curl -s -X POST $API/admin/auth/login -H "Content-Type: application/json" \
  -d '{"email":"super@crivo.platform","password":"crivo-super-123"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s $API/admin/tenants -H "Authorization: Bearer $ADMIN"   # → lista de empresas

# 5) Sessão de tenant: módulos ativos da empresa
TOKEN=<token do passo 2>
curl -s $API/me/modules -H "Authorization: Bearer $TOKEN"      # → ["dashboard","icd",...]
```

Depois, na plataforma (`app.crivolegacy.com.br`): logar com `ceo@crivo.demo /
crivo123` deve abrir o app; senha errada deve mostrar "E-mail ou senha inválidos".

---

## ✅ Checklist final
- [ ] Banco provisionado; owner com BYPASSRLS; `crivo_app` criado e com senha forte
- [ ] `migrate:deploy` → `seed` → `rls` rodados **nessa ordem**, sem erro (12 migrations)
- [ ] `rls.sql` reaplicado (cobre control plane + catálogos RBAC/módulos + `tenant_branding`/
      `tenant_domains`/`usage_counters`/`library_items`); é idempotente — rode de novo se mudar
- [ ] API no ar; `GET /api/health` responde `ok`
- [ ] API não sobe sem `AUTH_SECRET`/`DATABASE_URL_APP` (testado)
- [ ] Login plataforma retorna token; login errado 401
- [ ] Super admin loga (`/api/admin/auth/login`) e lista empresas (`/api/admin/tenants`)
- [ ] Isolamento: usuário do tenant A não vê dados do tenant B (rode `pnpm --filter @crivo/db test:isolation`)
- [ ] `crivo-web` com `API_URL=.../api` e CORS liberado (`WEB_URL`); login funciona pela UI
- [ ] `crivo-site` com gate (`SITE_ACCESS_TOKEN`/`GATE_SECRET`) e captação (`PLATFORM_API_URL`+`LEAD_INTAKE_SECRET`)
- [ ] `LEAD_INTAKE_TENANT` setado na API com o `organizationId` real; lead da LP cai no pipeline
- [ ] **Trocar as senhas demo** `ceo@crivo.demo` e `super@crivo.platform` (ou provisionar reais e limpar o demo)
      — super admin: `PATCH /api/admin/auth/password` (`{currentPassword,newPassword}`, nova ≥12)

> ⚠️ **Segurança pendente (follow-ups conhecidos):** o super admin já troca a própria
> senha (`PATCH /api/admin/auth/password`), mas **ainda não há MFA/TOTP** (F2) nem troca
> de senha self-service para usuários de tenant. Após o deploy, troque a senha do super
> admin demo por esse endpoint e restrinja o acesso ao `/superadm`.

---

## Estado do produto (jun/2026)
- **Telas:** 9/9 migradas para React+API (de-mock concluído). 7 com dado real
  (Dashboard, ICD, CRM, Questionário, Campanhas, Líder, Biblioteca); Relatórios e
  Parecer são placeholders honestos até terem backend próprio.
- **Backend multi-tenant completo:** RLS, RBAC dinâmico, Control Plane + Super Admin,
  planos+módulos com gate, metering (leads/usuários/api_calls) com limites, white-label
  (branding+domínios+self-service), gestão de time. Ver `SAAS-TRANSFORMATION.md`.
- **Falta para o go-live:** apenas a **infra desta runbook** (banco + API + env/DNS na
  Vercel). Refinamentos opcionais: theming da tela de login por host, automação de
  domínio na Vercel, backends de Relatórios/Parecer, MFA do super admin.
