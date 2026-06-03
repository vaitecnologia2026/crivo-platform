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

## Deploy (Vercel)

Projetos separados, **build remoto a partir de `crivo-platform/`** com Root Directory configurado:

| App | Projeto Vercel | Root Directory | Preview |
|---|---|---|---|
| site | `crivo-site` | `apps/site` | https://crivo-site.vercel.app |
| web | `crivo-web` | `apps/web` | https://crivo-web.vercel.app |

Deploy: `cd crivo-platform && vercel link --project <projeto> && vercel deploy` (preview) / `--prod` (produção).
Notas de monorepo: `next.config` fixa `turbopack.root` no monorepo (pnpm); deploy **não-prebuilt** (build remoto resolve o workspace).

## ✅ Cutover concluído (06/2026)

`crivo.vai-sistema.com` agora aponta para o projeto **`crivo-site`** (React, `apps/site`): `/` (gate), `/lp` (landing), `/design-system`. O domínio foi movido do antigo projeto `crivo` (estático), que ficou sem domínio.

O site estático original foi arquivado em **`legacy/`** (`index.html`, `CRIVO-LP/`, `CRIVO-PLATAFORMA/`, `design-system.html`, `ds.css`, `tokens.css`, `logger.js`) — referência histórica, **não é mais servido** e não deve receber ajustes. Todo trabalho novo é em `crivo-platform/`.

> A plataforma (`crivo-web` / `apps/web`) está publicada em https://crivo-web.vercel.app. Quando ganhar domínio próprio (ex.: `app.vai-sistema.com`), atualizar os links "Acessar sistema"/"Plataforma" na LP e no design system (hoje apontando para `/CRIVO-PLATAFORMA/`).
