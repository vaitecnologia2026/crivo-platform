<div align="center">

# CRIVO™ Platform — Arquitetura Enterprise
### Decision Intelligence System · "A infraestrutura inteligente da liderança moderna"

`Blueprint v0.1` · status: **a validar** · autor: Dex (dev) · base: protótipo `CRIVO-PLATAFORMA/`

</div>

> **Como ler este documento.** Ele define *o que vamos construir e em que ordem* — não é código pronto. Cada módulo do brief vira um **épico** com fatias entregáveis (stories). A regra de ouro: **fundação multi-tenant + auth + 1 módulo end-to-end antes de qualquer expansão horizontal.**

---

## 1. Posicionamento técnico

Hoje a CRIVO **mede** (ICD, questionário). O salto é fazê-la **executar, provar e prever**:

| Eixo | Hoje (protótipo) | Alvo (plataforma) |
|---|---|---|
| Mede | ICD estático, dados fixos no HTML | ICD vivo, multi-tenant, histórico |
| Executa | — | Motor de planos de ação + workflow + Kanban |
| Prova | — | Trilha jurídica auditável (append-only, e-sign, PDF) |
| Prevê | — | Analytics preditivo (score de risco → ML) |
| Aconselha | chat mockado | Copiloto CEO (RAG sobre dados da org) |

**Diferencial defensável:** o ICD como métrica proprietária + o *loop de recorrência* (medir → agir → reavaliar) que gera **dependência operacional** e **dados longitudinais** que nenhum concorrente tem.

---

## 2. Stack & decisões (com justificativa)

| Camada | Escolha | Por quê |
|---|---|---|
| Monorepo | **Turborepo + pnpm** | Compartilha tipos/UI entre web e api; build incremental |
| Frontend | **Next.js 15 (App Router) + React + TypeScript** | SSR p/ dashboards, RSC, ecossistema enterprise |
| UI | **Tailwind + shadcn/ui + Framer Motion** | Design system tokenizável (reaproveita `tokens.css`), dark mode premium |
| Gráficos | **Recharts / visx** | Dashboards vivos, leves |
| Backend | **NestJS (Node + TS)** | Modular por design — 1 módulo Nest por domínio; DI, guards, interceptors |
| ORM | **Prisma** | Migrations versionadas, type-safe, RLS via middleware |
| DB | **PostgreSQL 16** | Multi-tenant + JSONB p/ respostas + `pgvector` p/ IA |
| Cache/Fila | **Redis + BullMQ** | Jobs (alertas, recálculo de score, geração de PDF), rate limit |
| Realtime | **Socket.IO** | Alertas push, atualização de Kanban/dashboard ao vivo |
| IA | **Anthropic Claude (Opus/Sonnet) via API + pgvector (RAG)** | Copiloto contextual por tenant; embeddings dos dados da org |
| Auth | **Auth.js / Lucia + RBAC** | Sessão, SSO futuro (Google/Microsoft), papéis |
| Storage | **S3 (evidências, PDFs)** | Trilha jurídica imutável |
| Infra | **Docker + AWS (ECS/RDS/ElastiCache) + Vercel (web) + CI/CD GitHub Actions** | Escala, multi-tenant, observabilidade |
| Observabilidade | **OpenTelemetry + Sentry** (evolui o `logger.js` atual) | Rastreabilidade enterprise |

---

## 3. Estrutura do monorepo

```
crivo-platform/
├── apps/
│   ├── web/                    # Next.js — dashboards, portais (RH, líder, CEO, jurídico)
│   │   ├── app/(auth)/         # login, SSO
│   │   ├── app/(exec)/         # painel CEO, mapa organizacional
│   │   ├── app/(rh)/           # painel RH, ações, treinamentos
│   │   ├── app/(lider)/        # área do líder + copiloto
│   │   └── app/(juridico)/     # trilha auditável, evidências
│   └── api/                    # NestJS — um módulo por domínio
│       └── src/modules/
│           ├── tenancy/        # multi-tenant, orgs, unidades, filiais
│           ├── iam/            # auth, RBAC, usuários
│           ├── icd/            # cálculo do ICD, dimensões, padrões
│           ├── assessments/    # questionários NR-1, respostas (anônimas)
│           ├── execution/      # MÓD.1 planos de ação, workflow, Kanban
│           ├── compliance/     # MÓD.2 trilha jurídica, e-sign, PDF, audit-log
│           ├── ai/             # MÓD.3 copiloto, RAG, insights
│           ├── finance/        # MÓD.4 custo de risco, ROI
│           ├── journey/        # MÓD.5 índices e evolução organizacional
│           ├── analytics/      # MÓD.13 preditivo, score de risco
│           ├── alerts/         # MÓD.10 motor de alertas multicanal
│           ├── training/       # MÓD.11 trilhas, universidade corporativa
│           └── integrations/   # MÓD.12 WhatsApp, Slack, Teams, ERP, folha
├── packages/
│   ├── ui/                     # design system (shadcn + tokens CRIVO)
│   ├── db/                     # schema Prisma + migrations
│   ├── types/                  # contratos compartilhados (DTOs, enums)
│   └── config/                 # eslint, tsconfig, tailwind preset
└── infra/                      # docker-compose, terraform, CI/CD
```

---

## 4. Multi-tenancy (MÓD.7 — fundação, não feature)

**Estratégia: shared database + `tenant_id` + Row-Level Security (RLS) no Postgres.**
Equilíbrio entre custo (uma instância) e isolamento (RLS garante que tenant A nunca leia dados de B, mesmo com bug na aplicação).

```
Organization (tenant raiz / holding)
  └── Company (empresa)
        └── Unit (filial / unidade)
              └── Team (equipe)
                    └── User (colaborador / líder / gestor)
```

- Toda tabela de negócio carrega `tenant_id` (≡ `organization_id`).
- Policy RLS: `USING (tenant_id = current_setting('app.tenant')::uuid)`.
- O `TenancyMiddleware` resolve o tenant da sessão e seta `app.tenant` por request.
- Benchmarking/ranking entre unidades = queries agregadas dentro do mesmo tenant.

---

## 5. Modelo de dados (núcleo)

> Tabelas essenciais para o MVP. JSONB onde o schema é flexível (respostas, payload de IA).

```sql
-- Tenancy & IAM
organizations(id, name, plan, created_at)
companies(id, tenant_id, organization_id, name, cnpj)
units(id, tenant_id, company_id, name, region)
teams(id, tenant_id, unit_id, name)
users(id, tenant_id, email, name, role)         -- role: COLABORADOR|LIDER|GESTOR|RH|JURIDICO|CEO|ADMIN
team_members(team_id, user_id, is_leader)

-- ICD & Assessments
assessment_cycles(id, tenant_id, name, period, status)        -- loop de recorrência
assessments(id, tenant_id, cycle_id, user_id, type)           -- type: ICD|NR1
responses(id, tenant_id, assessment_id, answers JSONB, anonymous bool, submitted_at)
icd_scores(id, tenant_id, assessment_id, leader_id, score INT, dimensions JSONB, dominant_pattern, computed_at)
                                                              -- dimensions: {clareza,pressao,confianca,influencia,risco}

-- MÓD.1 Execução
action_plans(id, tenant_id, trigger_type, source_score_id, owner_id, status, due_at)
tasks(id, tenant_id, action_plan_id, title, assignee_id, status, deadline)  -- Kanban
                                                              -- status: TODO|DOING|BLOCKED|DONE
recurrences(id, tenant_id, entity, rule, next_run_at)

-- MÓD.2 Compliance (append-only)
audit_log(id, tenant_id, actor_id, action, entity, entity_id, evidence_url, payload JSONB, created_at)
                                                              -- NUNCA UPDATE/DELETE — só INSERT
signatures(id, tenant_id, document_id, signer_id, hash, signed_at)
documents(id, tenant_id, type, storage_url, generated_at)     -- relatórios/PDF auditáveis

-- MÓD.4 Finance
risk_costs(id, tenant_id, unit_id, dimension, estimated_annual_cost, basis JSONB)

-- MÓD.3/13 IA & Analytics
ai_insights(id, tenant_id, scope, scope_id, summary, recommendations JSONB, model, created_at)
embeddings(id, tenant_id, source, source_id, vector vector(1536))   -- pgvector p/ RAG
risk_predictions(id, tenant_id, target, target_id, risk_type, probability, horizon, computed_at)

-- MÓD.10 Alertas / MÓD.11 Treinamento
alerts(id, tenant_id, severity, type, target, message, channels JSONB, sent_at, ack_at)
trainings(id, tenant_id, title, profile, content_url)
training_assignments(id, tenant_id, training_id, user_id, status, completed_at)
```

**Princípio jurídico-chave:** `audit_log` é **append-only** (sem UPDATE/DELETE, garantido por trigger + permissão). É isso que permite à empresa **provar que agiu preventivamente** — o coração do MÓD.2 e do valor anti-passivo trabalhista.

---

## 6. O Loop de Recorrência (MÓD.8 — o motor que cria dependência)

```
1. Colaborador responde (assessment)        → responses
2. IA analisa                                → ai_insights + icd_scores
3. Sistema detecta risco                     → risk_predictions / alerts
4. Gera ação automática                      → action_plans + tasks
5. Líder executa                             → tasks status → DONE (audit_log)
6. RH acompanha                              → painel RH + evidências
7. Sistema reavalia (próximo ciclo)          → novo assessment_cycle
8. IA compara evolução                       → journey indices + ranking
        ↑___________________________________________________________↓
                        (recorrência agendada via BullMQ)
```

Cada transição grava no `audit_log`. É o loop que transforma "consultoria com dashboard" em **sistema operacional humano corporativo**.

---

## 7. Camada de IA (MÓD.3 / 14)

- **RAG por tenant:** embeddings dos scores, respostas agregadas (anônimas), histórico → `pgvector`. O Copiloto responde *com base nos dados reais da org*, isolado por tenant.
- **Guard-rails:** IA nunca expõe respostas individuais anônimas (privacidade/LGPD); só agregados e padrões.
- **Jobs assíncronos:** insights diários do CEO, detecção de padrões, comparação de filiais → BullMQ.
- **Saídas estruturadas:** `ai_insights.recommendations` em JSON acionável (vira `action_plans`).

---

## 8. Segurança & LGPD (transversal — não-negociável)

- RLS por tenant + RBAC por papel + auditoria de todo acesso a dado sensível.
- Respostas de clima/NR-1 **anônimas por design** (k-anonymity: nunca exibir grupo < 5 pessoas).
- Criptografia em repouso (RDS) e trânsito (TLS); evidências em S3 com object-lock.
- Consentimento e retenção de dados versionados; DPA por contrato.

---

## 9. Roadmap faseado (15 módulos → 4 fases)

| Fase | Nome | Inclui | Resultado |
|---|---|---|---|
| **F0** | Fundação | Monorepo, Docker, CI/CD, **tenancy + IAM**, design system | Login multi-tenant real, base p/ tudo |
| **F1 · MVP** | Medir de verdade | ICD vivo, questionário NR-1, dashboard executivo, **Loop básico** | Substitui o protótipo por produto real |
| **F2** | Executar & Provar | **MÓD.1 Execução** (Kanban/ações), **MÓD.2 Compliance** (audit-log/PDF/e-sign), alertas | Dependência operacional + valor jurídico |
| **F3** | Prever & Aconselhar | **MÓD.3 Copiloto/IA**, **MÓD.4 Finance/ROI**, **MÓD.13 Preditivo**, **MÓD.5 Jornada** | Inteligência preditiva + ROI demonstrável |
| **F4** | Escala enterprise | **MÓD.7 Holding** completo, **MÓD.11 Treinamento**, **MÓD.12 Integrações**, **MÓD.14 Painel CEO** avançado | Multiempresa, recorrência forte, valuation |

> MÓD.6 (Dependência), MÓD.9 (UX premium), MÓD.15 (posicionamento) são **transversais** — qualidades que permeiam todas as fases, não épicos isolados.

---

## 10. Backlog inicial (épicos → primeiras stories de F0/F1)

- **EPIC-0 Fundação**
  - `0.1` Setup monorepo Turborepo + pnpm + Docker compose (pg, redis)
  - `0.2` Schema Prisma núcleo (tenancy, IAM) + migrations + RLS
  - `0.3` Auth.js + RBAC + TenancyMiddleware
  - `0.4` Design system `packages/ui` (tokens CRIVO + shadcn + dark mode)
- **EPIC-1 ICD vivo (MVP)**
  - `1.1` Cadastro de org/empresa/unidade/equipe/usuários
  - `1.2` Aplicação do questionário ICD (10 perguntas, 5 dimensões)
  - `1.3` Cálculo do score + padrão dominante + persistência
  - `1.4` Dashboard executivo (ICD geral, por unidade, ranking de líderes)
  - `1.5` Ciclo de recorrência básico (reaplicar + comparar)

---

## 11. Restrições honestas (o que isto NÃO é)

- Não é entregável em uma sessão. F0+F1 sozinhos = semanas de trabalho focado.
- ML preditivo "de verdade" (MÓD.13) exige **dados longitudinais** que só existem depois de N ciclos — começa como *score heurístico* e evolui para modelo treinado.
- Integrações (MÓD.12) dependem de contas/credenciais de cada provedor.
- Assinatura eletrônica com validade jurídica plena pode exigir provedor certificado (ICP-Brasil) — começa com aceite digital + hash auditável.

---

<div align="center">

**Próximo passo:** validar este blueprint e escolher por onde começar a construir de verdade (ver §10).

</div>
