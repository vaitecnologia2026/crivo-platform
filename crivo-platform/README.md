<div align="center">

# CRIVO™ Platform — Monorepo
### Decision Intelligence System · Enterprise SaaS

`Fase F0 · Fundação` — multi-tenancy + IAM + design shell

</div>

> Arquitetura completa em [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
> Esta é a **fundação** sobre a qual as fases F1–F4 serão construídas.

---

## O que já existe (F0)

| Camada | Entregue |
|---|---|
| **Monorepo** | Turborepo + pnpm workspaces (`apps/*`, `packages/*`) |
| **Infra local** | `docker-compose` com Postgres 16 + Redis 7 |
| **DB** | Prisma schema (tenancy + IAM) + **RLS** multi-tenant + seed demo |
| **API** | NestJS — auth (JWT), RBAC (`@Roles`), tenancy, `/api/health` |
| **Web** | Next.js 15 — shell + tela de login na identidade CRIVO |
| **Contratos** | `@crivo/types` (DTOs/enums compartilhados entre web e api) |

---

## Pré-requisitos

- Node ≥ 20 · pnpm 9 · Docker

## Setup

```bash
cd crivo-platform
cp .env.example .env            # ajuste segredos
pnpm install

# 1) sobe Postgres + Redis
pnpm infra:up

# 2) cria o schema e aplica RLS
pnpm db:generate
pnpm db:migrate                 # cria as tabelas
pnpm db:rls                     # ativa Row-Level Security + usuário de app
pnpm --filter @crivo/db seed    # cria org/empresa/CEO demo

# 3) sobe API (3333) e Web (3000)
pnpm dev
```

Acesse `http://localhost:3000` → login com **ceo@crivo.demo / crivo123**.
Health da API: `http://localhost:3333/api/health`.

---

## Multi-tenancy (RLS)

Toda query de negócio deve rodar dentro de `prisma.forTenant(tenantId, tx => …)`,
que fixa `app.tenant` na transação. As policies do Postgres (`prisma/sql/rls.sql`)
garantem que um tenant **nunca** lê dados de outro — mesmo com bug na aplicação.

> O login é cross-tenant (busca por e-mail) e roda na conexão owner. Em produção,
> o tenant vem do subdomínio/seleção e a busca passa a ser escopada.

---

## Próximas stories (ver ARCHITECTURE §10)

- `0.4` Extrair design system para `packages/ui` (Tailwind + shadcn + tokens CRIVO)
- `1.1`–`1.5` **EPIC-1 ICD vivo**: cadastro org, questionário, cálculo de score, dashboard, recorrência

---

## Segurança (F0 → endurecer em F1)

- [ ] Trocar hash SHA-256 por **argon2id** no `AuthService` e no seed
- [ ] Refresh tokens + rotação
- [ ] Rate limit (Redis) no `/api/auth/login`
- [ ] Validação de schema nos DTOs (`class-validator`)
