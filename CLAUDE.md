# CRIVO™ — Guia do projeto (padrão React)

> **Regra de ouro:** todo ajuste e melhoria é feito em **React (Next.js + Tailwind v4 + `@crivo/ui`)**, dentro do monorepo `crivo-platform/`. **Não criar mais HTML/CSS/JS estático novo.** Os arquivos estáticos na raiz são **legado** que ainda serve a produção até o cutover (ver abaixo).

## Arquitetura (fonte de verdade)

Tudo vive no monorepo **`crivo-platform/`** (pnpm + Turborepo):

```
crivo-platform/
├── apps/
│   ├── site/   → Next.js 16 · marketing: / (gate VAI), /lp (landing), /design-system
│   ├── web/    → Next.js 16 · plataforma SaaS (login + 9 telas; protótipo migrado)
│   └── api/    → NestJS + Prisma (IAM, ICD)
├── packages/
│   ├── ui/     → @crivo/ui · DESIGN SYSTEM EM CÓDIGO (tema Tailwind c/ tokens CRIVO,
│   │             componentes de marca, logger). Fonte única de verdade visual.
│   ├── db/     → Prisma (schema, migrations, RLS, seed)
│   ├── types/  → tipos compartilhados
│   └── config/ → tsconfig base
```

Stack unificada: **Next.js 16 · React 19 · Tailwind v4 · TypeScript · pnpm 9**.

## Onde mexer

| Quero ajustar… | Edite em… |
|---|---|
| Gate de acesso (token VAI) | `apps/site/src/app/page.tsx` + `gate.module.css` |
| Landing Page | `apps/site/src/app/lp/page.tsx` + `lp.css` (efeitos em `LpEffects.tsx`) |
| Design System (showcase) | `apps/site/src/app/design-system/page.tsx` + `ds.css` |
| Plataforma (telas) | `apps/web/app/plataforma/` (markup + `Plataforma.tsx` + `app.css`) |
| Cores/tipografia/tokens globais | `packages/ui/src/styles/theme.css` (tema Tailwind + `--crivo-*`) |
| Componentes de marca (Vértice, Button…) | `packages/ui/src/components/` |
| Logger / observabilidade | `packages/ui/src/logger.ts` |

> **Convenção da migração:** LP, Design System e Plataforma reaproveitam o CSS já aprovado (`lp.css`/`ds.css`/`app.css`, co-localizados e escopados por rota) para fidelidade 1:1 — a estrutura é React. **Trabalho novo** (e refactors) usa Tailwind + componentes `@crivo/ui`.

## Comandos

```bash
cd crivo-platform
pnpm install
pnpm --filter @crivo/site dev   # marketing (localhost:3000) — token VAI2026
pnpm --filter @crivo/web dev    # plataforma (localhost:3000)
pnpm build                       # build de todos os apps/packages (turbo)
```

## Deploy

**Não há auto-deploy e não é Vercel.** Produção é o VPS do cliente: rsync do
fonte → build no servidor → `systemctl restart`. Três serviços atrás do nginx:
`crivo-lp` (site, 3001), `crivo-web` (portal + superadm, 3000) e `crivo-api`
(NestJS, 3046, prefixo `/api`).

- Runbook completo: **[crivo-platform/docs/DEPLOY.md](crivo-platform/docs/DEPLOY.md)**
- Variáveis e onde elas vivem: **[crivo-platform/docs/ENVIRONMENT.md](crivo-platform/docs/ENVIRONMENT.md)**
- Unidades systemd e vhosts nginx versionados: **[crivo-platform/infra/](crivo-platform/infra/)**

Domínios de produção: `crivolegacy.com.br` (site) e `app.crivolegacy.com.br`
(portal e `/superadm`).

## Histórico

O site já foi estático e já esteve na Vercel em `crivo.vai-sistema.com`. Os dois
saíram: o estático está arquivado em `legacy/` (não é servido) e os projetos da
Vercel foram apagados — `crivo.vai-sistema.com` **não é mais da CRIVO**. Se
encontrar esse domínio em algum lugar do código ou da documentação, é resíduo.
