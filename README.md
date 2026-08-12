# CRIVO™

Plataforma de inteligência organizacional da **CRIVO** (O2 Legacy & Consulting):
site público, portal executivo para as empresas contratantes e um super admin de
control-plane.

**No ar:** https://crivolegacy.com.br (site) · https://app.crivolegacy.com.br (portal e `/superadm`)

---

## Comece por aqui

```bash
cd crivo-platform
pnpm install
pnpm build          # compila os 3 apps + os pacotes
pnpm test           # 173 testes (cálculo do ICD e regras da API)
```

Isso funciona sem banco, sem Docker e sem nenhuma variável de ambiente. Para
**rodar** de verdade (não só compilar), siga
[docs/ENVIRONMENT.md](crivo-platform/docs/ENVIRONMENT.md).

| Quero… | Leia |
|---|---|
| Entender a arquitetura e onde mexer | [CLAUDE.md](CLAUDE.md) |
| Rodar local com banco | [docs/ENVIRONMENT.md](crivo-platform/docs/ENVIRONMENT.md) |
| **Publicar em produção** | [docs/DEPLOY.md](crivo-platform/docs/DEPLOY.md) |
| Ver a infra que está no servidor | [infra/](crivo-platform/infra/) |

## O monorepo

`crivo-platform/` — pnpm + Turborepo, Next.js 16 · React 19 · NestJS · Prisma · PostgreSQL.

| Pacote | O que é |
|---|---|
| `apps/site` | Site público e a LP. Captura o lead do **MAPA Executivo**. |
| `apps/web` | Portal da empresa contratante (`/plataforma`) + super admin (`/superadm`). Também empacotado como app via Capacitor (`android/`, `ios/`). |
| `apps/api` | API NestJS, prefixo global `/api`. Multi-tenant com **RLS** no Postgres. |
| `packages/db` | Prisma: schema, 88 migrations, RLS (`sql/rls.sql`), seeds. |
| `packages/types` | Tipos e o **motor de cálculo** compartilhados (ICD, metodologias). |
| `packages/ui` | Design system em código — tokens e componentes de marca. |
| `packages/config` | tsconfig base. |

## Três coisas que economizam horas

1. **Multi-tenant é RLS de verdade.** Query de negócio usa
   `prisma.forTenant(tenantId, …)`. A conexão `prisma.admin` **fura** a RLS e só
   vale para control-plane — há um gate na CI (`pnpm --filter @crivo/api
   check:rls-bypass`) que barra uso novo sem justificativa explícita.

2. **Não existe auto-deploy.** Push na `main` roda só o gate de qualidade.
   Publicar é manual — [docs/DEPLOY.md](crivo-platform/docs/DEPLOY.md).

3. **`seed:demo` apaga a base.** São ~37 `deleteMany` sem escopo; por isso ele
   exige `CRIVO_SEED_DEMO=1`. O seed seguro, idempotente, é `seed:bootstrap`.

## Pastas fora do monorepo

Material de projeto, não código de produção: `legacy/` (site estático anterior ao
React — **não é servido**), `docs/`, `assets/`, `images_Crivo_nova/` (as 20 telas
de referência do cliente, citadas em comentário no código como "Tela NN"),
`Solicitacoes cliente/`, `Antes e depois/`, `crivo-validacao-antes-depois/`.

## Documentos históricos

`crivo-platform/docs/DEPLOY-API.md`, `DEPLOY-BACKEND.md` e `DEPLOY-CHECKLIST.md`
descrevem uma arquitetura **antiga** (Railway + Vercel + Supabase) que não é a
produção atual. Ficaram como registro. Para deploy, use
[docs/DEPLOY.md](crivo-platform/docs/DEPLOY.md).
