# infra/ — o que roda no servidor (versionado)

Cópias fiéis do que está em produção no VPS (`root@204.157.108.178`, `/opt/crivo`).
Deploy é manual — ver [../docs/DEPLOY.md](../docs/DEPLOY.md). Nada aqui é aplicado
automaticamente; estes arquivos existem para rastreabilidade e para reprovisionar
o servidor sem perder configuração.

## Conteúdo

| Caminho | Onde vive em produção | O que é |
|---|---|---|
| `systemd/crivo-api.service` | `/etc/systemd/system/` | unit da API (NestJS, porta 3046) |
| `systemd/crivo-web.service` | `/etc/systemd/system/` | unit do portal + superadm (Next, 3000) |
| `systemd/crivo-lp.service` | `/etc/systemd/system/` | unit do site/LP (Next, 3001) |
| `nginx/crivo.conf` | `/etc/nginx/sites-enabled/` | vhost `app.crivolegacy.com.br` (+ proxy `/api/`) |
| `nginx/crivo-lp.conf` | `/etc/nginx/sites-enabled/` | vhost `crivolegacy.com.br` (+ www, lp) |
| `scripts/backup-db.sh` | `/opt/crivo/backup-db.sh` | dump diário do Postgres (cron `20 3 * * *`), retenção 14 dias |
| `logrotate/crivo` | `/etc/logrotate.d/crivo` | rotação semanal dos logs `/var/log/crivo-*.log` (copytruncate) |

## Notas operacionais (2026-08-21)

- **backup-db.sh**: a versão anterior fazia `. /opt/crivo/api.env` (source). O
  `api.env` é formato systemd, não shell-válido (`SMTP_FROM=CRIVO <...>` tem `<`/`>`
  sem aspas), o que quebrava o backup com "syntax error" e parou os dumps
  automáticos entre 18 e 21/08. A versão aqui extrai só o `DATABASE_URL` e voltou a
  funcionar. Para aplicar em produção: copiar para `/opt/crivo/backup-db.sh`,
  `chmod 700`.
- **logrotate/crivo**: aplicar copiando para `/etc/logrotate.d/crivo`.

## Endurecimento de SSH — PENDENTE (fazer com a chave em mãos)

O `documentacao/ACESSOS-CRIVO.md` §7 recomenda, e ainda NÃO foi feito (para não
arriscar trancar o acesso sem a chave `crivo-deploy` testada):

1. Testar login por `ssh -i <chave crivo-deploy> root@204.157.108.178`.
2. Só se a chave funcionar: em `/etc/ssh/sshd_config`, `PasswordAuthentication no`
   e `PermitRootLogin prohibit-password`; `systemctl reload sshd`.
3. Rotacionar a senha do root (ela trafegou em texto).
