# Deploy da CRIVO — o que realmente está no ar

> Este é o documento **válido**. Os arquivos `DEPLOY-API.md`, `DEPLOY-BACKEND.md`
> e `DEPLOY-CHECKLIST.md` descrevem uma arquitetura **antiga** (Railway + Vercel +
> Supabase) que **não é a produção**. Foram mantidos como histórico e estão
> marcados como obsoletos no topo. Se algum deles conflitar com este aqui, este
> vale.

## O que existe

Tudo roda num **VPS do cliente**, sem Docker (é um container LXC Debian 12, que
não roda Docker dentro). Deploy **nativo**: o fonte vai por `rsync`, o build roda
**no servidor**, e três serviços `systemd` ficam atrás do nginx.

| Domínio | Serve | Serviço | Porta |
|---|---|---|---|
| `crivolegacy.com.br` (+ `www`, `lp`) | site público / LP (`apps/site`) | `crivo-lp` | 3001 |
| `app.crivolegacy.com.br` | portal da empresa + `/superadm` (`apps/web`) | `crivo-web` | 3000 |
| `app.crivolegacy.com.br/api/` | API NestJS (`apps/api`, prefixo global `/api`) | `crivo-api` | 3046 |

- **Host:** `204.157.108.178` — Debian 12, LXC, 4 vCPU / 8 GB / 30 GB.
- **Acesso:** SSH por chave dedicada, como `root`. A chave **não está no repo** —
  peça ao responsável.
- **Código:** `/opt/crivo/app` (é uma cópia por rsync, **não é um clone git**).
- **Segredos:** `/opt/crivo/api.env` e `/opt/crivo/lp.env`, `chmod 600`, fora do
  git. Ver [ENVIRONMENT.md](./ENVIRONMENT.md).
- **Logs:** `/var/log/crivo-{api,web,lp}.log`.
- **Banco:** PostgreSQL no próprio host.

As unidades systemd e os vhosts nginx que estão rodando estão versionados em
[`../infra/`](../infra/) — são cópias fiéis do servidor, sem segredo.

## Não existe auto-deploy

Push na `main` **não publica nada**. A CI (`.github/workflows/ci.yml`) só roda o
gate de qualidade. Publicar é a sequência manual abaixo.

## Redeploy

Do seu computador, na raiz do monorepo (`crivo-platform/`):

```bash
rsync -az --itemize-changes \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude dist --exclude '.env*' --exclude .turbo \
  -e "ssh -i ~/.ssh/SUA_CHAVE" \
  ./ root@204.157.108.178:/opt/crivo/app/
```

Depois, **no servidor**, buildando só o que mudou:

```bash
cd /opt/crivo/app && pnpm install
pnpm --filter @crivo/site build && systemctl restart crivo-lp
```

```bash
cd /opt/crivo/app && pnpm --filter @crivo/api build && systemctl restart crivo-api
```

```bash
cd /opt/crivo/app && pnpm --filter @crivo/web build && systemctl restart crivo-web
```

### Quatro regras que custam caro se esquecidas

1. **Build sem restart deixa o site quebrado.** O Next em memória segue servindo
   HTML que aponta para chunks que o build novo apagou → CSS 500, visitante vê a
   página sem estilo, e formulário morre com `Failed to find Server Action`.
   **`systemctl restart` é parte do deploy, não um passo opcional.**
   Diagnóstico: se `systemctl show <unit> -p ActiveEnterTimestamp` for **mais
   antigo** que o mtime de `.next/BUILD_ID`, é isso.

2. **O rsync exclui `dist/`.** Quando `packages/types` ou `packages/db` mudam, o
   build no servidor tem que respeitar a ordem — o filtro do pnpm **não** compila
   as dependências:
   ```bash
   pnpm --filter @crivo/types build && pnpm --filter @crivo/api build
   ```

3. **`apps/web` lê `API_URL` (não `NEXT_PUBLIC_API_URL`) no `next.config.mjs`,**
   e o valor é embutido em tempo de build. Buildar o web sem essa variável
   embute a URL padrão. Sempre:
   ```bash
   API_URL=https://app.crivolegacy.com.br/api pnpm --filter @crivo/web build
   ```

4. **Migrations novas** rodam antes do restart da API:
   ```bash
   cd /opt/crivo/app && packages/db/node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma
   ```
   Use o binário local — `npx prisma` baixaria uma versão incompatível.

## Banco novo, do zero

Só para provisionar um ambiente novo (**nunca** contra a base do cliente):

```bash
pnpm --filter @crivo/db setup:prod
```

Isso encadeia `prisma generate` → `pre-migrate` (cria a função `current_tenant()`,
que a 39ª das 88 migrations exige) → `migrate deploy` → `rls.sql` → bootstrap
idempotente. Pular o `pre-migrate` faz o migrate quebrar no meio.

> ⚠️ **`seed:demo` é destrutivo** — tem ~37 `deleteMany` sem escopo, apaga a base
> inteira. Ele exige `CRIVO_SEED_DEMO=1` justamente para não rodar sem querer.
> **Nunca** o aponte para produção.

## Rollback

Não existe rollback automático — não há snapshot gerenciado. Reverter é
**redeployar a versão anterior** (`git checkout <tag/commit>` → rsync → build →
restart). Antes de qualquer operação de risco no banco, tire um dump manual:

```bash
pg_dump "$DATABASE_URL" | gzip > /opt/crivo/backups/crivo-$(date +%Y%m%d-%H%M).sql.gz
```

**Pendência conhecida:** a rotina automática de backup do Postgres não está
versionada neste repo. Confirme com o responsável o que existe hoje no servidor
antes de assumir que há backup.

## Verificação depois de publicar

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://crivolegacy.com.br/
curl -s -o /dev/null -w "%{http_code}\n" https://app.crivolegacy.com.br/
curl -s -o /dev/null -w "%{http_code}\n" https://app.crivolegacy.com.br/api/public/pre-diagnostic
ssh root@204.157.108.178 'systemctl is-active crivo-api crivo-web crivo-lp'
```
