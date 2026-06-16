# CRIVO™ — Checklist de deploy pós backlog técnico

Este documento cobre os passos para colocar **em produção** as features
entregues nos commits `a1f66df` (backlog completo P0-P3) + `b0fda44`
(integrações) + commit Analytics MVP.

> Enquanto os passos **1** e **2** abaixo não rodarem, as features novas
> (Decision, Pocket, Mentorias, Relatório Preliminar, Analytics, etc.)
> aparecem na UI mas **não funcionam** em produção: a UI vai chamar
> endpoints cujas tabelas ainda não existem no banco.

---

## 1) Aplicar 8 migrations no Postgres do Railway

**O quê:** as 8 migrations geradas offline (via `prisma migrate diff`) precisam
ser aplicadas no banco de produção. Todas têm `DEFAULT CURRENT_TIMESTAMP`
em colunas `NOT NULL` adicionadas a tabelas com dados existentes — seguro
para rodar em prod sem janela de manutenção obrigatória.

**Migrations:**

| Ordem | Diretório | O que faz |
|---|---|---|
| 1 | `20260615192959_add_decision_models` | Decision/Category/Audience/SustentationAction (6 enums + 5 tabelas) |
| 2 | `20260615194440_add_decision_icd_score` | `IcdAxis` enum + `decision_icd_scores` (modelo dos 4 Eixos §6-9) |
| 3 | `20260615195040_add_icd_quarterly_cycle` | `IcdCycleStatus` + `IcdCycle`, `LeaderQuarterlyIcd`, `CompanyQuarterlyIcd` |
| 4 | `20260615195631_add_pocket` | Pocket: 2 enums + `PocketSession`/`Reflection`/`AiSummary` |
| 5 | `20260615205749_campaigns_editable` | Campos extras em `assessment_cycles` (sector, publicSlug, etc.) |
| 6 | `20260615210703_preliminary_reports` | `PreliminaryReportStatus` + `PreliminaryReport` |
| 7 | `20260615213936_super_admin_extras` | Mentorias + ActionTemplate + EditableText + GlobalAcademyContent |
| 8 | `20260615223127_domain_verification` | DNS verify: `verificationToken`, `verifiedAt`, etc. em `tenant_domains` |

**Como rodar:**

```bash
cd crivo-platform
# Conectado ao Railway via 'railway run' OU exportando DATABASE_URL local
pnpm --filter @crivo/db exec prisma migrate deploy
```

**Verificação:**

```bash
# Confirma que todas estão no _prisma_migrations
psql $DATABASE_URL -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 8;"
```

Deve listar as 8 acima como `finished_at NOT NULL`.

**Rollback:**

Cada migration tem `migration.sql` que cria objetos novos (CREATE TABLE,
CREATE TYPE, ADD COLUMN). Para rollback granular, gerar o SQL inverso com
`prisma migrate diff` apontando para o schema anterior, ou rodar manualmente
`DROP TABLE`/`DROP TYPE` na ordem inversa de dependência.

---

## 2) Configurar variáveis de ambiente no Railway

### 2.a — Resend (envio de e-mails)

Sem essas variáveis, o **Relatório Preliminar CRIVO** e os **lembretes de
campanha** ficam em modo "stub" — gerados, mas não enviados. O sistema
funciona, mas o operador precisa disparar manualmente.

```env
RESEND_API_KEY="re_..."  # https://resend.com/api-keys
RESEND_FROM="CRIVO <noreply@crivolegacy.com.br>"
```

**Verificar domínio no Resend:** O e-mail `noreply@crivolegacy.com.br`
precisa ter o domínio `crivolegacy.com.br` verificado no painel do Resend
(MX/DKIM/SPF). Senão Resend rejeita o `from`.

### 2.b — Demais variáveis (já existentes, conferir)

| Variável | Necessária para |
|---|---|
| `DATABASE_URL` | conexão owner (migrations, control plane) |
| `DATABASE_URL_APP` | conexão `crivo_app` (RLS por tenant) |
| `AUTH_SECRET` | JWT |
| `WEB_URL` | CORS — listar `crivo-web.vercel.app` + domínio custom |

---

## 3) Ativar IA via Super Admin

A IA (OpenAI) é configurada **via UI**, não env. Necessária para:

- **Relatório Preliminar CRIVO** (#52) — geração markdown via prompt §5
- **Mentoria IA do Pocket** (#58) — síntese ao concluir sessão (Anexo §10.2)
- **Copiloto da Área do Líder** (Briefing §6) — já existia

**Passo a passo:**

1. Logar no Super Admin: `crivo-web.vercel.app/superadm`
2. Ir em **Configurações de IA**
3. Colar OpenAI API key (formato `sk-...`)
4. Marcar `enabled = true`
5. Selecionar módulos habilitados (`copiloto`, `lider`, ou vazio = todos)
6. Modelo padrão: `gpt-4o-mini` (ou `gpt-4o` se contrato premium)
7. Clicar em **Testar** — deve retornar "OK"

**Custo médio por feature:**

| Feature | Tokens médios | Custo gpt-4o-mini |
|---|---|---|
| Relatório Preliminar | ~3.000 in + 1.500 out | ~US$ 0.001 |
| Mentoria Pocket | ~1.200 in + 500 out | ~US$ 0.0004 |
| Copiloto (1 turno) | ~600 in + 200 out | ~US$ 0.0002 |

---

## 4) Validar a build da Vercel

Após o push (`b0fda44` + Analytics), os 2 projetos da Vercel devem
rebuildar automaticamente via webhook do GitHub:

- `crivo-site` → `crivo-site.vercel.app` (LP + design system)
- `crivo-web` → `crivo-web.vercel.app` (portal + super admin)

**Checks pós-deploy:**

| Rota | O que esperar |
|---|---|
| `crivo-site.vercel.app/lp` | Hero com CTA "Fazer diagnóstico inicial" |
| `crivo-web.vercel.app` | Tela de login |
| `crivo-web.vercel.app/superadm` | Tela de login do Super Admin |

**Se a build falhar:** ver o log na Vercel; provável causa é `NEXT_PUBLIC_API_URL`
ainda não setado no projeto `crivo-web`. Definir como
`https://<railway-api-url>`.

---

## 5) Smoke test E2E manual (10 min)

Antes de avisar ao cliente, validar o caminho crítico:

1. **Login** com `ceo@crivo.demo / crivo123` (seed) no `/web`
2. **Dashboard** carrega sem erro 500 (banco precisa ter as tabelas novas)
3. **Decisão**: criar uma decisão de impacto MÉDIO/ALTO no menu Líder
4. **ICD**: responder as 8 afirmações P1-P8 para a decisão
5. **Ciclo**: criar ciclo trimestral, verificar que decisão entrou
6. **Pocket**: iniciar sessão, responder ao menos 5 perguntas, concluir →
   se IA estiver ativa, deve aparecer síntese
7. **Campanha**: criar, gerar link público, clicar "lembrete" → ver alert
8. **Super Admin**: gerar Relatório Preliminar para um lead → ver markdown
9. **Histórico**: ver últimas ações registradas
10. **Trocar senha**: ícone ⚿ no topo direito

Se algum desses falhar, abrir issue no GitHub com print do console.

---

## Rollback de emergência

Se algo crítico quebrar em produção:

```bash
# Voltar para o último commit funcional (antes deste backlog)
git revert b0fda44 a1f66df
git push origin main
```

Os builds da Vercel vão rebuildar a versão anterior. As migrations **não
rodam automaticamente em reverse** — para isso, restaurar do backup do
Postgres (Railway tem snapshot diário).
