# Variáveis de ambiente

Em produção **não existe `.env` no repo**. Cada serviço lê um arquivo próprio no
VPS (`chmod 600`, fora do git):

| Serviço | Arquivo no VPS |
|---|---|
| `crivo-api` (NestJS) | `/opt/crivo/api.env` |
| `crivo-lp` (site/LP) | `/opt/crivo/lp.env` |
| `crivo-web` (portal + superadm) | **nenhum** — o que ele precisa é embutido no build (ver `API_URL` abaixo) |

Referência de nomes: [`../.env.example`](../.env.example) (monorepo) e
[`../apps/api/.env.example`](../apps/api/.env.example).

## API — `/opt/crivo/api.env`

| Variável | Obrigatória | Se faltar |
|---|---|---|
| `DATABASE_URL` | **sim** | a API não sobe |
| `DATABASE_URL_APP` | **sim** | conexão de aplicação (RLS) não funciona |
| `AUTH_SECRET` | **sim** | fail-fast no boot, de propósito — sem fallback |
| `PORT` | sim | default 3000; a produção usa **3046** |
| `WEB_URL` / `PORTAL_URL` | sim | CORS e links de e-mail apontam para o lugar errado |
| `FCM_SERVICE_ACCOUNT_PATH` | não | push vira no-op silencioso (loga WARN) |
| `SITE_NOTIFY_SECRET` | **recomendada** | ⚠️ **a validação é pulada inteira**: `POST /notifications/site-event/:key` fica aberto e qualquer um dispara push, com título e corpo escolhidos por quem chama |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | **sim (rede de proteção)** | **nenhum e-mail sai da API** — falha silenciosa: o "Gerar nova senha e enviar por e-mail" **troca a senha do cliente e não entrega a ninguém**, e o Relatório Preliminar não chega. É o **mesmo bloco do `lp.env`** (conta `financeiro@crivolegacy.com.br`, a que já envia o e-book). **Precedência:** se houver conta gravada em **Governança → E-mail de envio** (tabela `mail_settings`), ela tem prioridade; se `AUTH_SECRET` mudar e a senha cifrada não decifrar, o mailer cai de volta para estas `SMTP_*`. Por isso elas continuam **obrigatórias** mesmo com o painel configurado |
| `EBOOK_URL` | não | fallback da API (`https://crivolegacy.com.br/ebook-crivo.pdf`). O e-book do painel (Governança → E-book) é servido em `GET /api/public/ebook`; o Relatório Preliminar e o WhatsApp já anexam o PDF do banco |
| `OPENAI_API_KEY` | não | a chave de IA fica **no banco**, pela UI do super admin — não aqui |

## Site / LP — `/opt/crivo/lp.env`

| Variável | Obrigatória | Se faltar |
|---|---|---|
| `PLATFORM_API_URL` | **sim** | a LP não busca a metodologia do MAPA |
| `NEXT_PUBLIC_PLATAFORMA_URL` | sim | botão "Acessar Portal" cai no fallback |
| `SITE_URL` | sim | links absolutos em e-mail |
| `EBOOK_URL` | sim | link do e-book no e-mail do lead da LP. **Para o e-book do painel (Governança → E-book) chegar ao lead da LP, aponte para `https://app.crivolegacy.com.br/api/public/ebook` e rebuilde o site** — senão o e-mail da LP segue no PDF estático (o Relatório Preliminar da API já usa o do banco) |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | **sim** | **o lead entra no CRM mas não recebe e-mail nem e-book** — falha silenciosa |
| `VAI_API_URL` / `VAI_API_EMAIL` / `VAI_API_PASSWORD` / `VAI_WA_CHANNEL_ID` | não | WhatsApp do lead vira stub: o log diz `ok=false` e ninguém é avisado |
| `LEAD_ALERT_EMAIL` | não | o e-mail de **resgate** (lead que não entrou no CRM, com dados completos) cai na própria caixa SMTP autenticada |
| `NEXT_PUBLIC_GA4_ID` | não | **hoje não está setada, de propósito** — medição inerte até o cliente enviar o `G-XXXXXXXXXX`. Setar + rebuildar o site é tudo que falta |
| `SITE_NOTIFY_SECRET` | recomendada | precisa ser **o mesmo valor** do `api.env` |

> `NEXT_PUBLIC_*` é embutida **em tempo de build**. Mudar qualquer uma exige
> rebuildar o app, não só reiniciar o serviço.

## Governança configurável pelo Super Admin (não é env)

Três telas do super admin (grupo **Governança**) movem para o banco o que antes só
vivia em variável de ambiente — sempre com o env como **rede de proteção**:

| Tela | Tabela | O que faz | Env de fallback |
|---|---|---|---|
| **E-mail de envio** | `mail_settings` | conta SMTP de saída (senha cifrada AES-256-GCM com `AUTH_SECRET`); `verifySmtp` autentica antes de gravar | `SMTP_*` do `api.env` (usadas se o banco estiver vazio ou a senha não decifrar) |
| **E-book** | `ebook_assets` | PDF do e-book (≤ 8 MB) servido em `GET /api/public/ebook`; anexado ao Relatório Preliminar e ao WhatsApp | `EBOOK_URL` (repontar o do `lp.env` p/ o endpoint acima — ver tabela do `lp.env`) |
| **Origens e Canais** | `platform_lead_origins` | catálogo de origens/canais do lead no CRM | 7 origens embutidas no front (fallback se a API falhar) |

> Se `AUTH_SECRET` mudar no VPS, a senha SMTP gravada deixa de decifrar e o mailer
> volta para as `SMTP_*` do ambiente (loga WARN, não derruba a API).

## Portal — build do `apps/web`

⚠️ **A pegadinha mais cara do projeto.** O `apps/web/next.config.mjs` lê
**`API_URL`** (não `NEXT_PUBLIC_API_URL`) e embute o valor no bundle. Buildar sem
ela embute a URL padrão — já aconteceu de o super admin ler um banco antigo por
causa disso, e o sintoma foi "o lead não aparece no funil", que não parece um
problema de build.

```bash
API_URL=https://app.crivolegacy.com.br/api pnpm --filter @crivo/web build
```

## Rodando local

```bash
cd crivo-platform
cp .env.example apps/api/.env       # o Prisma e o Nest resolvem .env pelo cwd de cada um
cp .env.example packages/db/.env    # (copiar para a raiz do monorepo NÃO funciona)
pnpm install
pnpm infra:up                       # Postgres em Docker
pnpm --filter @crivo/db setup:prod  # migrations + RLS + bootstrap idempotente
pnpm dev
```

Para popular com dados de demonstração (**nunca em produção**):

```bash
CRIVO_SEED_DEMO=1 pnpm --filter @crivo/db seed:demo
```
