# Deploy do backend CRIVO (Railway) — passo a passo

> Backend = **API NestJS** (servidor Node, prefixo `/api`) + **Postgres com RLS**.
> Frontend (site/web) já está na Vercel. Falta só subir o backend e ligar as URLs.
> Escolha: **Railway** (Postgres + API no mesmo provedor, plano grátis p/ validar).

---

## Visão geral (o que vai acontecer)

```
Railway:  [ Postgres ]  ←  [ API NestJS (/api) ]
                                  ▲
Vercel:   crivo-site (LP)  ───────┤  PLATFORM_API_URL
          crivo-web (portal) ─────┘  API_URL
```

São **3 etapas**: (1) criar o Postgres, (2) preparar o banco (migrations + RLS + seed),
(3) subir a API e ligar as URLs na Vercel.

---

## Etapa 1 — Postgres no Railway

1. Crie conta em railway.app → **New Project** → **Provision PostgreSQL**.
2. No serviço Postgres → aba **Variables/Connect** → copie a **connection string pública**
   (algo como `postgresql://postgres:SENHA@HOST.proxy.rlwy.net:PORTA/railway`).
   Essa é a conexão **owner** (`DATABASE_URL`).

## Etapa 2 — Preparar o banco (uma única vez)

Rode **na sua máquina** (assim a senha do banco não sai do seu computador).
Precisa de `psql` instalado (para o passo de RLS).

```bash
cd crivo-platform
export DATABASE_URL="postgresql://postgres:SENHA@HOST.proxy.rlwy.net:PORTA/railway"

pnpm install
pnpm --filter @crivo/db setup:prod       # faz tudo: generate + migrate + rls + seed
```

> `setup:prod` roda, em ordem: `generate` (client) → `migrate:deploy` (cria as
> tabelas) → `rls` (usuário crivo_app + políticas RLS) → `seed` (super admin +
> produtos + dados demo). Se preferir passo a passo, rode os 4 separadamente
> (`generate`, `migrate:deploy`, `rls`, `seed`). O `rls` precisa de `psql` instalado.

O `seed` cria, entre outros, o produto obrigatório **PRÉ-DIAGNÓSTICO CRIVO** + CRIVO
Lite/Professional/Enterprise e leads de CRM demo.

**Logins gerados pelo seed:**
- Super Admin: `super@crivo.platform` / `crivo-super-123` → tela `/superadm`
- CEO (tenant demo): `ceo@crivo.demo` / `crivo123`

> 🔐 **Troque essas senhas após o 1º login.** Veja "Segurança" no fim.

Depois do `rls`, existe o usuário **`crivo_app`** (senha padrão `crivo_app`). A conexão
de aplicação (`DATABASE_URL_APP`) usa esse usuário — **mesmo host/porta/banco**, só muda
user/senha:

```
DATABASE_URL_APP = postgresql://crivo_app:crivo_app@HOST.proxy.rlwy.net:PORTA/railway
```

## Etapa 3 — Subir a API + ligar as URLs

### 3a. Serviço da API no Railway

No mesmo projeto → **New** → **GitHub Repo** → `vaitecnologia2026/crivo-platform`.
Configure o serviço:

- **Root Directory:** `/` (é um monorepo pnpm — não aponte para `apps/api`)
- **Build / Start:** já vêm prontos do **`railway.json`** na raiz do repo — o Railway
  lê automaticamente. (Se quiser conferir/sobrescrever na UI:)
  - Build: `pnpm install --frozen-lockfile && pnpm --filter @crivo/types build && pnpm --filter @crivo/db generate && pnpm --filter @crivo/api build`
  - Start: `node apps/api/dist/main.js`

**Variáveis de ambiente da API** (aba Variables):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | conexão **owner** (postgres) — pode referenciar `${{Postgres.DATABASE_URL}}` |
| `DATABASE_URL_APP` | conexão **crivo_app** (RLS) — `postgresql://crivo_app:SENHA@HOST:PORTA/railway` |
| `AUTH_SECRET` | segredo forte do JWT — gere com `openssl rand -hex 32` |
| `WEB_URL` | origens CORS (separadas por vírgula): `https://crivo-web.vercel.app,https://crivo.vai-sistema.com` |
| `JWT_EXPIRES_IN` | (opcional) ex.: `8h` |
| `PORT` | **injetada automaticamente** pelo Railway — não precisa setar |

> A API responde em `/api`. Ex.: `https://crivo-api-production.up.railway.app/api`.
> Teste rápido depois de subir: abra `…/api/public/tenant?domain=x` (deve responder, mesmo que 404 lógico).

### 3b. Ligar a Vercel ao backend

Pegue a **URL pública da API** (Railway → serviço API → Settings → Domains) e acrescente `/api`:
`https://<sua-api>.up.railway.app/api`

**crivo-web** (Settings → Environment Variables → Production):
| Variável | Valor |
|---|---|
| `API_URL` | `https://<sua-api>.up.railway.app/api` |

**crivo-site** (Settings → Environment Variables → Production):
| Variável | Valor |
|---|---|
| `PLATFORM_API_URL` | `https://<sua-api>.up.railway.app/api` |

Depois **redeploy** os dois projetos na Vercel (env nova só vale em build novo).

---

## Pronto — fluxo de ponta a ponta

1. Visitante na LP → **Realizar diagnóstico** → form → 10 perguntas → resultado.
2. Lead cai automaticamente no **CRM do Super Admin** (`/superadm` → CRM — Funil).
3. Admin converte o lead → escolhe o **produto** → empresa provisionada (módulos + perguntas + IA do produto).

---

## Segurança (importante)

- **Não cole a senha do banco no chat.** Rode a Etapa 2 você mesmo (ou via `! comando`
  nesta sessão). Para eu ligar a Vercel, me passe só a **URL pública da API** (sem senha).
- Troque a senha do `crivo_app` (padrão fraca):
  `ALTER ROLE crivo_app PASSWORD '<senha-forte>';` e atualize `DATABASE_URL_APP`.
- `AUTH_SECRET` deve ser aleatório e secreto (nunca o default).
- Troque `crivo-super-123` no 1º login do super admin.
