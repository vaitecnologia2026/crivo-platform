# CRIVO™ — Plano de Transformação para SaaS Multi-Tenant Enterprise

> Documento de arquitetura (CTO/CIO/Arquiteto SaaS). **Plano antes de código.**
> Baseado em auditoria do estado real em `crivo-platform/` (jun/2026).
> Versão 1.0 — autor: squad C-Level (CTO Architect).

---

## Sumário executivo (TL;DR)

A boa notícia: **70% da fundação multi-tenant correta já existe**. O sistema NÃO precisa de
reescrita — precisa de **5 camadas novas** sobre uma base sólida:

1. **Control Plane + Super Admin** (não existe hoje)
2. **Permissões dinâmicas** módulo→tela→ação (hoje só RBAC estático de 7 papéis)
3. **White-label** por empresa (hoje inexistente; mas os design tokens `--crivo-*` já facilitam)
4. **Catálogo de módulos** ativável por plano/empresa (hoje `Plan` existe mas nunca é aplicado)
5. **Dashboards e formulários dinâmicos** (hoje ICD é hard-coded em constante TypeScript)

O modelo de isolamento escolhido (**shared-DB + shared-schema + RLS no Postgres**) é exatamente
o correto para **100.000+ empresas**. Mantemos e endurecemos — não trocamos.

**Esforço estimado:** 9 fases, ~16–22 semanas para um time pequeno, entregando valor incremental
a cada fase. Nenhuma fase é "big bang".

---

## 1. Diagnóstico do sistema atual

### 1.1 Stack e topologia (real)

```
crivo-platform/ (pnpm + Turborepo)
├── apps/
│   ├── site/  → Next 16 — marketing (gate, LP, design-system)
│   ├── web/   → Next 16 — plataforma SaaS (login + shell + 9 rotas)
│   └── api/   → NestJS — IAM, ICD, Leads
└── packages/
    ├── db/    → Prisma + Postgres (schema, migrations, RLS, seed)
    ├── ui/    → @crivo/ui — design system (tokens --crivo-*)
    ├── types/ → contratos compartilhados
    └── config/
```

### 1.2 O que JÁ está certo (fundação aproveitável) ✅

| Camada | Estado | Avaliação |
|---|---|---|
| **Tenant raiz** | `Organization` é o tenant; todo modelo de negócio tem `tenantId` | ✅ Modelo correto |
| **Isolamento de dados** | RLS Postgres: `ENABLE` + **`FORCE`** + policy `tenant_isolation USING (tenantId = current_tenant())` em 11 tabelas | ✅ Padrão enterprise |
| **Princípio de menor privilégio** | App conecta como `crivo_app` (não-owner, sem BYPASSRLS); owner só para login/provisioning | ✅ Correto |
| **Escopo por request** | `prisma.forTenant(tenantId, fn)` faz `SET app.tenant` dentro de transação | ✅ Correto |
| **Boot seguro** | Serviço **falha** se `DATABASE_URL_APP` ausente (impede rodar sem RLS) | ✅ Defensivo |
| **Auth** | JWT com `tenantId` no payload; `AuthGuard` injeta `req.user` | ✅ Base ok |
| **Índices tenant-first** | `@@index([tenantId])`, `@@index([tenantId, stage])` | ✅ Padrão de escala correto |
| **Rate limiting** | `ThrottlerModule` global (60 req/min) | ✅ Presente |
| **Design tokens** | `--crivo-*` CSS custom properties em `@crivo/ui` | ✅ Habilita white-label barato |

> **Conclusão técnica:** quem desenhou o `schema.prisma` e o `rls.sql` já pensou multi-tenant
> de verdade. Isso economiza meses. A transformação é **aditiva**, não corretiva na base.

### 1.3 O que FALTA para ser SaaS Enterprise multiempresa ❌

| Capacidade pedida | Estado atual | Gap |
|---|---|---|
| **Nível 1 — Super Admin global** | Inexistente. Maior papel é `ADMIN`/`CEO` *dentro* de um tenant | 🔴 Crítico |
| **Provisionamento de empresas** | Manual via seed/SQL | 🔴 Crítico |
| **Planos / billing / metering** | enum `Plan` existe, **nunca é lido** em nenhuma regra | 🔴 Crítico |
| **Permissões dinâmicas (módulo/tela/ação)** | RBAC estático: 7 papéis fixos no enum `Role` + `@Roles()` hard-coded | 🟠 Alto |
| **Papéis customizáveis por empresa** | Impossível (enum no banco) | 🟠 Alto |
| **White-label (logo/cor/domínio/favicon)** | Inexistente | 🟠 Alto |
| **Catálogo de módulos ativável por empresa** | Inexistente; menu hard-coded em `markup.ts` | 🟠 Alto |
| **Dashboards configuráveis (widgets)** | Dashboard fixo, 1 layout para todos | 🟡 Médio |
| **Formulários/avaliações dinâmicos** | ICD hard-coded em `ICD_QUESTIONS` (constante TS) | 🟡 Médio |
| **Domínio próprio por empresa** | Inexistente (1 domínio global) | 🟡 Médio |
| **Audit log** | Mencionado como "fase F2", não implementado | 🟡 Médio |
| **Menu/navegação data-driven** | 9 rotas fixas no HTML shell | 🟡 Médio |

---

## 2. Problemas encontrados (riscos já presentes no código)

1. **🔴 Login cross-tenant ambíguo.** `auth.service.ts` faz
   `prisma.admin.user.findFirst({ where: { email } })` sem escopar tenant. Como o schema permite
   `@@unique([tenantId, email])` (mesmo e-mail em orgs diferentes), com 2+ tenants o login pode
   autenticar contra o **usuário errado**. Hoje não estoura porque só há 1 tenant. **Vira bug de
   segurança no dia do 2º cliente.** → Resolver com login por (domínio/subdomínio → tenant) ou
   tela de seleção de organização.

2. **🟠 Uso de `prisma.admin` (BYPASSRLS) é a única barreira contra vazamento.** Qualquer query
   de negócio que use `admin` por engano fura o isolamento silenciosamente. → Precisa de lint/CI
   que proíba `prisma.admin.*` fora de IAM/provisioning, e testes de isolamento automatizados.

3. **🟠 RBAC não-extensível.** `Role` é enum no Postgres → adicionar papel = migration. Empresas
   não podem criar papéis próprios. Incompatível com "Administrador da empresa cria permissões
   internas".

4. **🟡 `Plan` decorativo.** Existe mas não gateia nada → não há monetização nem limites por plano.

5. **🟡 Conteúdo de domínio hard-coded.** `ICD_QUESTIONS` em `packages/types` significa que mudar
   uma pergunta = deploy. Inviável para "cada empresa cria suas avaliações".

6. **🟡 Frontend é shell estático.** `markup.ts` tem as 9 rotas e o menu fixos no HTML; navegação
   e telas não são dirigidas por config/permissão.

7. **🟡 Sem observabilidade de tenant.** Não há `tenantId` em logs/métricas → impossível diagnosticar
   "noisy neighbor" ou cobrar por uso.

---

## 3. Estrutura ideal SaaS — visão de arquitetura

### 3.1 Princípio fundador: **Control Plane vs Data Plane**

O erro mais comum em SaaS multiempresa é enfiar o "Super Admin" no mesmo modelo de papéis dos
usuários do tenant. **Não faça isso.** Separe em dois planos:

```
┌─────────────────────────────────────────────────────────────┐
│  CONTROL PLANE  (sem RLS de tenant — é GLOBAL)                │
│  • Registro de tenants (Tenant catalog)                      │
│  • Planos, assinaturas, billing, uso/metering                │
│  • Catálogo global de módulos e templates                    │
│  • Super Admins (principal SEPARADO do tenant)               │
│  • Mapa tenant → shard/banco (para escala futura)            │
│  • Audit de provisionamento                                  │
└─────────────────────────────────────────────────────────────┘
                          │ provisiona / configura
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  DATA PLANE  (RLS por tenant — isolado)                      │
│  • Organization (= tenant) e tudo abaixo                     │
│  • Users, Teams, Leads, Assessments, Dashboards, Forms…      │
│  • Branding, módulos ativos, papéis e permissões DA empresa  │
└─────────────────────────────────────────────────────────────┘
```

**Implementação no Postgres:** um schema `control` (ou banco separado) **sem** as policies de
tenant, e o schema `public` (data plane) com RLS. Super Admin autentica contra o control plane e
nunca recebe `app.tenant` — ele opera via APIs administrativas explícitas, com auditoria.

### 3.2 Modelo de hospedagem de dados (decisão de escala)

| Modelo | Quando | CRIVO |
|---|---|---|
| **Pooled** (shared DB+schema, RLS) | Muitos tenants pequenos/médios | ✅ **Default — já temos** |
| **Schema-per-tenant** | Tenants médios, isolamento forte | Opcional p/ ENTERPRISE |
| **DB-per-tenant** | Poucos tenants enormes/regulados | Escape hatch p/ ADVISORY |

**Recomendação:** manter **pooled+RLS como padrão** e adicionar um **catálogo `tenant_shard`** no
control plane que permite, no futuro, *promover* um tenant ENTERPRISE para schema/banco dedicado
sem mudar o código de aplicação (o `forTenant` resolve a conexão pelo mapa). Isto é o padrão
"sharding com catálogo de tenants" — é como se sustenta 100k+ tenants.

---

## 4. Estrutura de banco completa (control plane + data plane)

> Sketches Prisma — **design**, não migration final. Convenção atual mantida (`@db.Uuid`, `tenantId`, `@@map`).

### 4.1 Control Plane (schema `control`, SEM RLS de tenant)

```prisma
/// Registro mestre de cada empresa-cliente. Espelha Organization no data plane.
model Tenant {
  id           String   @id @default(uuid()) @db.Uuid
  slug         String   @unique            // usado em <slug>.crivolegacy.com.br
  name         String
  status       TenantStatus @default(ACTIVE) // ACTIVE | SUSPENDED | DELETED
  planId       String   @db.Uuid
  plan         PlanDef  @relation(fields: [planId], references: [id])
  shardKey     String   @default("pool-default") // → mapa de conexão (escala)
  createdAt    DateTime @default(now())
  branding     TenantBranding?
  domains      TenantDomain[]
  modules      TenantModule[]
  subscription Subscription?
  usage        UsageCounter[]
  @@map("tenants")
}

enum TenantStatus { ACTIVE  SUSPENDED  DELETED }

model SuperAdmin {                          // Nível 1 — principal GLOBAL, fora do RBAC de tenant
  id           String  @id @default(uuid()) @db.Uuid
  email        String  @unique
  name         String
  passwordHash String
  active       Boolean @default(true)
  totpSecret   String?                      // MFA obrigatório p/ super admin
  @@map("super_admins")
}

model PlanDef {                             // Catálogo de planos (Super Admin define)
  id        String  @id @default(uuid()) @db.Uuid
  code      String  @unique                 // BASE | EVOLUCAO | ENTERPRISE | ADVISORY
  name      String
  limits    Json                            // { maxUsers, maxLeads, modules:[...], ... }
  priceCents Int    @default(0)
  tenants   Tenant[]
  @@map("plan_defs")
}

model Subscription {
  id        String  @id @default(uuid()) @db.Uuid
  tenantId  String  @unique @db.Uuid
  tenant    Tenant  @relation(fields: [tenantId], references: [id])
  status    String                          // trialing | active | past_due | canceled
  provider  String?                         // stripe | manual
  externalId String?                        // id na gateway
  renewsAt  DateTime?
  @@map("subscriptions")
}

model ModuleCatalog {                       // Catálogo GLOBAL de módulos disponíveis
  id        String  @id @default(uuid()) @db.Uuid
  code      String  @unique                 // crm | icd | dashboards | forms | reports | ranking…
  name      String
  category  String?
  minPlan   String?                         // plano mínimo p/ habilitar
  tenants   TenantModule[]
  @@map("module_catalog")
}

model UsageCounter {                        // Metering p/ billing e noisy-neighbor
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  metric    String                          // api_calls | active_users | storage_mb | leads
  period    String                          // 2026-06
  value     BigInt   @default(0)
  @@unique([tenantId, metric, period])
  @@map("usage_counters")
}
```

### 4.2 Data Plane — extensões ao schema existente (COM RLS)

```prisma
/// White-label por empresa
model TenantBranding {
  tenantId       String  @id @db.Uuid
  org            Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  logoUrl        String?
  faviconUrl     String?
  primaryColor   String?                     // sobrescreve --crivo-azul
  secondaryColor String?                     // sobrescreve --crivo-terra
  emailFrom      String?
  whatsapp       String?
  footerHtml     String?
  @@map("tenant_branding")
}

model TenantDomain {
  id        String  @id @default(uuid()) @db.Uuid
  tenantId  String  @db.Uuid
  org       Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  domain    String  @unique                  // app.clienteX.com  |  clienteX.crivolegacy.com.br
  verified  Boolean @default(false)
  primary   Boolean @default(false)
  @@index([tenantId])
  @@map("tenant_domains")
}

model TenantModule {                          // Quais módulos a empresa ativou
  tenantId  String  @db.Uuid
  org       Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  moduleCode String
  enabled   Boolean @default(true)
  config    Json?
  @@id([tenantId, moduleCode])
  @@index([tenantId])
  @@map("tenant_modules")
}

// ── RBAC dinâmico (substitui o enum Role estático) ──
model RoleDef {                               // Papéis: sistema (tenantId null) OU custom da empresa
  id        String  @id @default(uuid()) @db.Uuid
  tenantId  String? @db.Uuid                  // null = papel de sistema (template)
  org       Organization? @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  code      String                            // admin | gestor | operador | <custom>
  name      String
  isSystem  Boolean @default(false)
  perms     RolePermission[]
  userRoles UserRole[]
  @@unique([tenantId, code])
  @@index([tenantId])
  @@map("role_defs")
}

model Permission {                            // módulo : recurso/tela : ação
  id        String  @id @default(uuid()) @db.Uuid
  code      String  @unique                   // "leads:view"  "leads:export"  "financeiro:edit"
  module    String                            // leads
  resource  String                            // screen/tela
  action    String                            // view | create | edit | delete | export
  roles     RolePermission[]
  @@map("permissions")
}

model RolePermission {
  roleId  String @db.Uuid
  permId  String @db.Uuid
  tenantId String @db.Uuid
  role    RoleDef    @relation(fields: [roleId], references: [id], onDelete: Cascade)
  perm    Permission @relation(fields: [permId], references: [id], onDelete: Cascade)
  @@id([roleId, permId])
  @@index([tenantId])
  @@map("role_permissions")
}

model UserRole {                              // usuário → papéis (N:N, substitui User.role)
  userId   String @db.Uuid
  roleId   String @db.Uuid
  tenantId String @db.Uuid
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  role     RoleDef @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@id([userId, roleId])
  @@index([tenantId])
  @@map("user_roles")
}

// ── Dashboards dinâmicos ──
model Dashboard {
  id        String  @id @default(uuid()) @db.Uuid
  tenantId  String  @db.Uuid
  org       Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name      String
  scope     String                            // tenant | role:<id> | user:<id>
  layout    Json                              // [{ widgetId, x, y, w, h }]
  widgets   Widget[]
  @@index([tenantId])
  @@map("dashboards")
}

model Widget {
  id          String @id @default(uuid()) @db.Uuid
  tenantId    String @db.Uuid
  dashboardId String @db.Uuid
  dashboard   Dashboard @relation(fields: [dashboardId], references: [id], onDelete: Cascade)
  type        String                          // card | chart | funnel | kanban | ranking | table | goal | kpi | calendar | map
  title       String
  metricKey   String                          // chave no REGISTRY de métricas (NUNCA SQL livre)
  params      Json?
  requiredPerm String?
  @@index([tenantId])
  @@map("widgets")
}

// ── Formulários / avaliações dinâmicos (generaliza o ICD) ──
model FormDefinition {
  id        String  @id @default(uuid()) @db.Uuid
  tenantId  String? @db.Uuid                  // null = template de sistema (ex.: ICD, NR1)
  org       Organization? @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  code      String
  name      String
  kind      String                            // assessment | survey | audit | checklist | nps
  schema    Json                              // { sections:[{ questions:[{id,type,weight,options}] }] }
  scoring   Json?                             // { formula, ranges } — engine de pontuação
  version   Int     @default(1)
  submissions FormSubmission[]
  @@index([tenantId])
  @@map("form_definitions")
}

model FormSubmission {
  id        String  @id @default(uuid()) @db.Uuid
  tenantId  String  @db.Uuid
  org       Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  formId    String  @db.Uuid
  form      FormDefinition @relation(fields: [formId], references: [id], onDelete: Cascade)
  subjectId String? @db.Uuid                  // líder avaliado, p.ex.
  answers   Json
  score     Json?
  submittedAt DateTime @default(now())
  @@index([tenantId])
  @@index([tenantId, formId])
  @@map("form_submissions")
}

// ── Auditoria (append-only) ──
model AuditLog {
  id        String  @id @default(uuid()) @db.Uuid
  tenantId  String? @db.Uuid                  // null = ação de super admin (control plane)
  actorId   String?
  action    String
  target    String?
  meta      Json?
  at        DateTime @default(now())
  @@index([tenantId])
  @@index([at])
  @@map("audit_log")
}
```

> **Migração de `User.role`:** o enum atual vira *seed* de `RoleDef` de sistema. `User.role` é
> mantido por 1 release (compat) e depois substituído por `UserRole`. Os 7 papéis existentes viram
> papéis-template que toda nova empresa recebe.

---

## 5. Diagrama de entidades (ER simplificado)

```
CONTROL PLANE                          DATA PLANE (RLS por tenantId)
─────────────                          ─────────────────────────────
SuperAdmin                             Organization (=Tenant) ──┐
PlanDef ─< Tenant >── Subscription            │                 │
              │                               ├─ TenantBranding (1:1)
              ├─ TenantModule >── ModuleCatalog├─ TenantDomain (1:N)
              ├─ UsageCounter                  ├─ TenantModule (1:N)
              └─ shardKey → conexão            │
                                               ├─ User ─< UserRole >─ RoleDef ─< RolePermission >─ Permission
                                               ├─ Company ─ Unit ─ Team ─ TeamMember
                                               ├─ Dashboard ─< Widget
                                               ├─ FormDefinition ─< FormSubmission
                                               ├─ Lead
                                               ├─ AssessmentCycle ─ Assessment ─ Response / IcdScore
                                               └─ AuditLog
```

---

## 6. Fluxograma de permissões (resolução de acesso)

```
Request → AuthGuard (verifica JWT, extrai {userId, tenantId})
   │
   ├─ É Super Admin? (token emitido pelo control plane)
   │     SIM → rotas /admin/* (control plane). NUNCA recebe app.tenant. Tudo auditado.
   │     NÃO ↓
   │
   ├─ Resolve tenant (do JWT; validado contra domínio/subdomínio da requisição)
   │
   ├─ Carrega permissões efetivas do usuário (cache por sessão):
   │     UserRole → RoleDef → RolePermission → Permission  ⇒  Set<"modulo:acao">
   │
   ├─ PermissionGuard: a rota exige @RequirePermission("leads:export")?
   │     permset.has("leads:export") ?  → 200 : 403
   │
   └─ prisma.forTenant(tenantId, tx => ...)  ⇒  RLS garante isolamento físico no banco
```

**Defesa em profundidade:** permissão (app) decide *o que pode fazer*; RLS (banco) garante *de quais
dados* — mesmo com bug na app, o Postgres não devolve linha de outro tenant.

---

## 7. Estrutura Multi-Tenant — validação em 6 superfícies

| Superfície | Mecanismo | Status / Ação |
|---|---|---|
| **Banco** | RLS `FORCE` + `current_tenant()` | ✅ Existe — adicionar policies às tabelas novas |
| **Backend** | `forTenant()` em toda query; lint proíbe `prisma.admin` fora de IAM | 🟠 Reforçar + testes de isolamento |
| **API** | `tenantId` sempre do JWT, **nunca** do body/query do cliente | 🟠 Auditar DTOs (ex.: intake usa env, ok) |
| **Frontend** | Tenant resolvido por domínio (middleware Next); UI filtra por permissão | 🔴 Implementar middleware + nav data-driven |
| **Uploads** | Prefixo de path por tenant (`s3://bucket/<tenantId>/…`) + URLs assinadas | 🔴 Definir storage (não existe hoje) |
| **Relatórios/Export** | Geração roda dentro de `forTenant`; metering por tenant | 🔴 Implementar com query registry |

---

## 8. Roadmap de implementação (mapeando as FASES 1–10 pedidas)

Sequência otimizada por **dependência + risco** (não pela ordem literal). Cada fase entrega valor.

| Fase | Nome | Entrega | Depende de | Esforço |
|---|---|---|---|---|
| **F0** ✅ | Fundação tenancy + IAM + RLS | *Já existe* | — | feito |
| **F1** ✅ | **Control Plane + Super Admin** (FASE 1) | `SuperAdmin`+`Tenant`+`TenantStatus`, RLS de control plane (revoga `crivo_app`), API `/admin/auth` + `/admin/tenants` (listar/provisionar/suspender/reativar/excluir), provisionador atômico (org+tenant+admin), gating de login por status. **Backend entregue — ver Apêndice B** | F0 | feito |
| **F2** 🟦 | **Hardening multi-tenant** (FASE 4 + FASE 9 parte 1) | ✅ Fix login cross-tenant, ✅ check CI anti-`prisma.admin`, ✅ teste automatizado de isolamento, ✅ AuditLog das ações de plataforma. Resta: MFA/TOTP, `tenantId` em logs. **Ver Apêndice C** | F1 | em curso |
| **F3** | **RBAC dinâmico** (FASE 3) | `RoleDef`/`Permission`/`UserRole`, `PermissionGuard`, migração do enum→seed, UI de papéis | F1 | 2–3 sem |
| **F4** | **Planos + módulos** (FASE 1 cont.) | `PlanDef`, `ModuleCatalog`, `TenantModule`, gate por plano, metering básico (`UsageCounter`) | F1, F3 | 2 sem |
| **F5** | **White-label** (FASE 5) | `TenantBranding`/`TenantDomain`, middleware de resolução por domínio, injeção de tokens `--crivo-*`, automação de domínio (Vercel) | F1 | 2 sem |
| **F6** | **Nav + telas data-driven** (FASE 5 cont.) | Menu gerado de `TenantModule`+permissões; migrar shell `markup.ts` → React config-driven | F3, F4 | 2–3 sem |
| **F7** | **Dashboards dinâmicos** (FASE 6) | `Dashboard`/`Widget`, **registry de métricas** server-side, builder drag-drop (react-grid-layout), 10 widgets | F3, F6 | 3 sem |
| **F8** | **Formulários/avaliações dinâmicos** (FASE 7) | `FormDefinition`/`FormSubmission`, engine de scoring, ICD migrado p/ template, builder de formulário | F3 | 3 sem |
| **F9** | **Escala + segurança + deploy** (FASES 8,9,10) | Particionamento, pooler, read-replica p/ relatórios, `tenant_shard`, pen-test de isolamento, observabilidade, go-live | todas | 2–3 sem |

> **Marco comercial mínimo (MVP SaaS vendável):** F1 + F2 + F4 + F5 → já permite vender, provisionar
> e isolar múltiplas empresas com marca própria. F3/F6/F7/F8 elevam para "enterprise configurável".

---

## 9. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | Vazamento cross-tenant por uso indevido de `prisma.admin` | 🔴 Crítico | Lint/CI proíbe `admin.*` fora de IAM; testes automáticos de isolamento; revisão obrigatória |
| R2 | Bug de login com e-mail repetido entre tenants | 🔴 Crítico | Resolver tenant por domínio/subdomínio ANTES do lookup; ou seleção de org (F2) |
| R3 | "Noisy neighbor" — um tenant degrada todos | 🟠 Alto | Metering + rate-limit por tenant; promover tenant grande p/ shard dedicado (`shardKey`) |
| R4 | SQL livre em dashboards → injeção/perf/fura-RLS | 🟠 Alto | **Registry de métricas** parametrizado; proibir SQL ad-hoc do usuário |
| R5 | "JSONB para tudo" (forms/dashboards) perde validação e perf | 🟡 Médio | Validar com Zod no app; índices GIN; versionar `schema`/`scoring` |
| R6 | Migração do enum `Role` quebra autorização existente | 🟠 Alto | Seed dos 7 papéis como template; manter `User.role` 1 release em paralelo; feature flag |
| R7 | TLS/certificado de domínio próprio por cliente | 🟡 Médio | Vercel Domains API (wildcard + custom) automatizando emissão |
| R8 | Crescimento de tabelas grandes (responses, leads, audit) | 🟡 Médio | Particionar por `tenantId`/data; arquivamento; índices compostos tenant-first (já é o padrão) |
| R9 | Super Admin comprometido = acesso total | 🔴 Crítico | MFA/TOTP obrigatório, IP allowlist, auditoria de toda ação, princípio de break-glass |
| R10 | Custo de reescrever frontend estático em config-driven | 🟡 Médio | Migração incremental (já em curso: 4/9 telas viraram ilhas React) |

---

## 10. Código necessário para migração (esqueletos-chave)

> Ilustrativo. Implementação real entra por fase, com testes. **Ainda não codar.**

**(a) `PermissionGuard` substituindo `@Roles` estático:**
```ts
// @RequirePermission('leads:export')
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private perms: PermissionService) {}
  async canActivate(ctx: ExecutionContext) {
    const needed = this.reflector.get<string[]>(PERM_KEY, ctx.getHandler());
    if (!needed?.length) return true;
    const { user } = ctx.switchToHttp().getRequest();
    const set = await this.perms.effectiveFor(user.id, user.tenantId); // cacheado
    if (!needed.every(p => set.has(p))) throw new ForbiddenException();
    return true;
  }
}
```

**(b) Resolução de tenant por domínio (middleware Next):**
```ts
// apps/web — middleware.ts
export function middleware(req: NextRequest) {
  const host = req.headers.get('host')!;            // app.clienteX.com
  const tenant = resolveTenantByDomain(host);       // consulta TenantDomain (cache edge)
  const res = NextResponse.next();
  res.headers.set('x-tenant', tenant.id);           // disponível p/ branding e API
  return res;
}
```

**(c) White-label via tokens (já temos `--crivo-*`):**
```tsx
// injeta no <html> as cores do tenant — zero CSS novo
<style>{`:root{
  --crivo-azul:${branding.primaryColor ?? '#0D1F3C'};
  --crivo-terra:${branding.secondaryColor ?? '#A8693D'};
}`}</style>
```

**(d) RLS para tabelas novas — basta acrescentar ao array em `rls.sql`:**
```sql
-- adicionar: 'tenant_branding','tenant_domains','tenant_modules','role_defs',
-- 'role_permissions','user_roles','dashboards','widgets',
-- 'form_definitions','form_submissions','audit_log'
-- (audit_log recebe policy somente-INSERT, como já previsto no comentário do rls.sql)
```

**(e) Registry de métricas (dashboards seguros, sem SQL livre):**
```ts
const METRICS: Record<string, (tx, params) => Promise<unknown>> = {
  'leads.by_stage': (tx) => tx.lead.groupBy({ by: ['stage'], _count: true }),
  'icd.avg_score':  (tx) => tx.icdScore.aggregate({ _avg: { score: true } }),
  // widget só referencia metricKey → impossível injetar SQL
};
```

---

## 11. Arquitetura para **100.000+ empresas**

1. **Pooled + RLS como padrão** (já temos) — densidade máxima, custo mínimo por tenant.
2. **Catálogo de shards** (`Tenant.shardKey` → mapa de `DATABASE_URL`): a maioria fica em
   `pool-default`; tenants ENTERPRISE/ADVISORY são *promovidos* a schema/banco dedicado sem mudar a
   app (o `forTenant` resolve a conexão pelo shard). É o padrão "sharding com tenant catalog".
3. **Connection pooling** obrigatório (PgBouncer / pooler do Supabase) — 100k tenants não significam
   100k conexões; o pool multiplexa.
4. **Cache de metadados de tenant** (branding, módulos, permissões) em Redis/edge — não bater no
   banco a cada request.
5. **Observabilidade com `tenantId`** em todo log/métrica/trace → detectar e isolar noisy neighbors.
6. **Onboarding assíncrono** — provisionar tenant via fila (cria org, seed de papéis/módulos,
   branding default), não no request síncrono.

## 12. Arquitetura para **milhões de registros**

1. **Particionamento declarativo** por `tenantId` (e/ou data) nas tabelas quentes:
   `form_submissions`, `responses`, `leads`, `audit_log`, `usage_counters`.
2. **Índices compostos tenant-first** (já é o padrão do projeto: `@@index([tenantId, stage])`) —
   manter para toda nova tabela.
3. **Read replicas** para relatórios/dashboards pesados → não competir com o tráfego transacional.
4. **Paginação por cursor** (keyset) em todas as listagens, nunca `OFFSET` grande.
5. **Arquivamento/TTL** de dados frios (ex.: ciclos antigos, audit > N meses → cold storage).
6. **Materialized views** por tenant para KPIs caros (refresh agendado), expostas via registry.

## 13. Arquitetura para **dashboards configuráveis**

- **Separação layout × dados:** `Dashboard.layout` (grid JSONB) define posição/tamanho; `Widget`
  define tipo + `metricKey`.
- **Registry de métricas server-side** (item 10e): o front nunca manda SQL — só escolhe métrica +
  params. Mata injeção, garante RLS e permite otimizar/cachear cada métrica.
- **Catálogo de 10 widgets** no front (`@crivo/ui`): card, chart, funnel, kanban, ranking, table,
  goal, kpi, calendar, map — cada um consome `{ data, config }`.
- **Builder** com `react-grid-layout` (drag/resize/persist). Permissão por widget (`requiredPerm`).
- **Escopo**: dashboard de tenant, por papel ou por usuário (campo `scope`).

## 14. Arquitetura para **formulários e avaliações configuráveis**

- **`FormDefinition.schema`** (JSONB): seções → perguntas tipadas (texto, escala, múltipla,
  booleano…), com `weight`/`options`. Versionado (`version`) para não quebrar submissões antigas.
- **Engine de scoring** seguro: fórmulas declarativas (ex.: `expr-eval`/JSONLogic) sobre respostas e
  pesos → produz `score`/dimensões. **NPS, auditoria, checklist são apenas `kind` diferentes.**
- **ICD vira template de sistema**: migrar `ICD_QUESTIONS` (hoje constante TS) para um
  `FormDefinition` seedado (`tenantId = null`); o scoring atual (`scoring.ts`) vira um plugin de
  fórmula registrado. Empresas clonam o template e customizam.
- **Validação** com Zod ao submeter; respostas em JSONB com índice GIN para consulta.

## 15. Arquitetura para **White-Label completo**

- **`TenantBranding`** (logo, favicon, cores, e-mail, whatsapp, rodapé) + **`TenantDomain`** (1:N).
- **Resolução por domínio** no middleware (subdomínio `clienteX.crivolegacy.com.br` *ou* domínio
  próprio `app.clienteX.com`) → injeta `x-tenant`.
- **Tema runtime**: sobrescrever os tokens `--crivo-*` no `:root` por tenant (o design system já é
  todo baseado nesses tokens → **white-label sai quase de graça**, sem CSS novo).
- **Domínio próprio**: automação via **Vercel Domains API** (verificação + TLS). Subdomínio wildcard
  `*.crivolegacy.com.br` já cobre o caso padrão sem custo de certificado por cliente.
- **E-mails transacionais** com remetente/branding por tenant (provider com domains verificados).
- **Assets isolados** por tenant no storage (`<tenantId>/branding/...`).

---

## Apêndice — decisões de arquitetura (ADR resumido)

| Decisão | Escolha | Por quê |
|---|---|---|
| Isolamento de dados | Pooled + RLS (manter) | Densidade p/ 100k tenants; já implementado e correto |
| Super Admin | Control plane separado, **não** é papel de tenant | Evita escalonamento de privilégio; auditoria limpa |
| Permissões | RBAC dinâmico (módulo:tela:ação) | Empresas criam papéis próprios sem deploy |
| Dashboards/Forms | Schema JSONB + registry/engine | Configurável sem código; seguro contra SQL livre |
| White-label | Override de tokens `--crivo-*` | DS já tokenizado → custo marginal baixo |
| Escala futura | `shardKey` + catálogo de tenants | Promover tenant grande sem reescrever a app |

> **Próximo passo recomendado:** aprovar o roadmap e iniciar **F1 (Control Plane + Super Admin)**,
> que destrava o provisionamento de múltiplas empresas. Só então começamos a codar — por fase,
> com testes de isolamento como gate de cada entrega.

---

## Apêndice B — F1 entregue (Control Plane + Super Admin, backend)

**Status:** ✅ backend implementado e validado ponta a ponta no ambiente local (jun/2026).

### O que foi construído

- **Banco** (`packages/db`): modelos `SuperAdmin`, `Tenant` (liga a `Organization` por
  `organizationId`, desacoplado, 1:1) e enum `TenantStatus` (ACTIVE/SUSPENDED/DELETED).
  Migration `20260609203229_control_plane_super_admin`.
- **RLS de control plane** (`prisma/sql/rls.sql`): `super_admins` e `tenants` ficam FORA da RLS
  por tenant — RLS habilitada **sem policy** + `REVOKE ALL` de `crivo_app`. Só a conexão owner
  (módulo Admin) acessa. Validado: `crivo_app` → *permission denied*; owner → OK.
- **API** (`apps/api/src/admin/`):
  - `POST /api/admin/auth/login` — login de super admin → JWT com `scope:'platform'` (sem tenantId).
  - `GET /api/admin/auth/me` — sessão do super admin.
  - `GET /api/admin/tenants`, `GET /:id`, `POST` (provisiona), `PATCH /:id/suspend`,
    `PATCH /:id/activate`, `DELETE /:id` (exclusão lógica).
  - `SuperAdminGuard` (exige `scope:'platform'`); `AuthGuard` de tenant rejeita tokens de plataforma.
  - `ProvisioningService`: cria **org + tenant + usuário ADMIN** atomicamente (senha temporária
    gerada e retornada 1× quando não informada).
  - Gating de login: `auth.service` bloqueia usuários de tenant SUSPENDED/DELETED.
- **Seed**: super admin `super@crivo.platform` / `crivo-super-123` + backfill do `Tenant` da org demo
  (`slug: o2legacy`).

### Smoke-test (10/10 ✅)

login super admin · `/me` · listar tenants · provisionar nova empresa · login do admin criado ·
suspender → login bloqueado · reativar → login OK · token de tenant barrado em `/admin` (401) ·
token de plataforma barrado em `/leads` (401) · `crivo_app` sem acesso às tabelas de control plane.

### Front do super admin — ✅ entregue

Rota `/superadm` em `apps/web` (Tailwind + `@crivo/ui`, sessão isolada por
`crivo_admin_token`, `noindex`): login de super admin, tabela de empresas com
badges de status e ações (bloquear/reativar/excluir), e provisionamento de nova
empresa com exibição única da senha temporária. Client em `lib/admin-api.ts`
(redirect para `/superadm` em 401). Typecheck + lint + `next build` ok.
Pode ser extraída para um app/subdomínio dedicado (`superadm.crivolegacy.com.br`)
no futuro sem mudança de contrato.

### Pendente nesta fase (follow-ups)

- **MFA/TOTP** do super admin → F2 (em curso, ver Apêndice C).

---

## Apêndice C — F2 entregue (Hardening, parte 1)

**Status:** 🟦 itens críticos implementados e validados localmente (jun/2026); MFA/TOTP pendente.

### O que foi construído

- **R2 — fix do login cross-tenant** (`iam/auth.service.ts`): o e-mail pode existir em
  vários tenants. Com `tenantSlug` (novo campo opcional em `LoginRequest`) a busca é escopada
  àquela organização; sem slug, só prossegue se houver **exatamente 1** correspondência —
  havendo mais, retorna *"Informe a empresa para entrar."* (em vez de logar contra tenant arbitrário).
- **R1 — gate anti-bypass de RLS** (`apps/api/scripts/check-no-admin-bypass.mjs`,
  `pnpm --filter @crivo/api check:rls-bypass`): falha o build se `prisma.admin` (conexão owner,
  bypass RLS) for usado fora de IAM/Admin. Queries de negócio devem usar `forTenant()`.
- **Teste automatizado de isolamento** (`packages/db/prisma/test-isolation.ts`,
  `pnpm --filter @crivo/db test:isolation`): cria 2 tenants e verifica contra o banco real:
  tenant A só vê o próprio dado; sem `app.tenant` → 0 linhas; insert cross-tenant bloqueado
  (WITH CHECK); `crivo_app` sem acesso a `tenants`/`super_admins`/`audit_log`.
- **AuditLog** (modelo control-plane owner-only, migration `audit_log`): trilha das ações de
  plataforma. `AuditService` (best-effort) grava `admin.login`, `tenant.provision`,
  `tenant.suspend/activate/delete` com ator, alvo e meta.

### Verificação

- `check:rls-bypass` → ✓ sem usos indevidos.
- `test:isolation` → ✓ 6/6.
- Smoke E2E (R2 + audit): login ambíguo barrado, slug correto autentica o tenant certo, senha de
  outro tenant rejeitada, login single-tenant intacto, `audit_log` populado.

### Pendente da F2

- **MFA/TOTP** do super admin (campo `totpSecret` pronto; falta dependência + enrollment + verify).
- **`tenantId` em logs/observabilidade** estruturada.
- **Campo "empresa" no login da plataforma** (UI): hoje, e-mail duplicado entre tenants retorna a
  mensagem mas o form ainda não tem o campo de slug — resolve-se naturalmente com a resolução por
  subdomínio da F5/F6.
