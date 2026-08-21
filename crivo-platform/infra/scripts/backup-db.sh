#!/bin/bash
# Backup diario do Postgres da Plataforma CRIVO (Clausula 6 do anexo contratual:
# periodicidade compativel + restauravel). Retencao: 14 dias.
#
# Vive em producao como /opt/crivo/backup-db.sh, disparado pelo cron do root:
#   20 3 * * * /opt/crivo/backup-db.sh >> /opt/crivo/backups/backup.log 2>&1
#
# NOTA IMPORTANTE: api.env e formato systemd (EnvironmentFile), NAO shell-valido.
# Valores como `SMTP_FROM=CRIVO <financeiro@crivolegacy.com.br>` tem `<`/`>` e
# espaco sem aspas — um `. /opt/crivo/api.env` (source) quebra com "syntax error"
# e, com `set -e`, aborta o backup inteiro. Foi o que parou os dumps automaticos
# entre 18 e 21/08/2026. Por isso extraimos SO o DATABASE_URL, sem sourcing.
set -e
DBURL="$(grep -E '^DATABASE_URL=' /opt/crivo/api.env | head -1 | cut -d= -f2-)"
DBURL="${DBURL%\"}"; DBURL="${DBURL#\"}"
STAMP=$(date +%Y%m%d-%H%M)
OUT=/opt/crivo/backups/crivo-${STAMP}.sql.gz
pg_dump "${DBURL%%\?*}" | gzip > "$OUT"
find /opt/crivo/backups -name "crivo-*.sql.gz" -mtime +14 -delete
echo "$(date -Is) backup ok: $OUT ($(du -h "$OUT" | cut -f1))" >> /opt/crivo/backups/backup.log
