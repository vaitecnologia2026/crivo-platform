#!/usr/bin/env bash
# Leitura dos logs do CRIVO no servidor. SOMENTE LEITURA — não altera nada.
#
# Vive em /opt/crivo/crivo-logs.sh (chmod 700). Existe porque, até 31/08/2026, a
# API passava dias sem escrever uma linha e não havia como distinguir "nada
# falhou" de "nada foi registrado". Agora há o que ler — e isto é o atalho.
#
#   ./crivo-logs.sh erros [horas]   erros e avisos dos 3 serviços (padrão: 24h)
#   ./crivo-logs.sh lead <req-id>   a jornada de um lead: site + API, em ordem
#   ./crivo-logs.sh mapa [horas]    só o fluxo do MAPA (lead, IA, e-mail, e-book)
#   ./crivo-logs.sh saude           serviços, /api/health e tamanho dos logs
#   ./crivo-logs.sh vivo            acompanha os 3 logs em tempo real
set -uo pipefail

API=/var/log/crivo-api.log
WEB=/var/log/crivo-web.log
LP=/var/log/crivo-lp.log
CMD=${1:-erros}

# Linhas das últimas N horas. O formato começa com timestamp ISO em UTC nos
# dois serviços, então dá para comparar como texto — sem parsing de data.
desde() {
  date -u -d "${1:-24} hours ago" +%Y-%m-%dT%H:%M:%S
}

recente() { # arquivo, corte
  awk -v corte="$2" '$1 >= corte' "$1" 2>/dev/null
}

case "$CMD" in
  erros)
    CORTE=$(desde "${2:-24}")
    echo "== erros e avisos desde $CORTE (UTC) =="
    for f in "$API" "$LP" "$WEB"; do
      recente "$f" "$CORTE" | grep -E ' (WARN|ERROR|FATAL) ' | sed "s|^|$(basename "$f" .log)  |" || true
    done | sort -k2 | sed 's/  */ /2'
    ;;
  lead)
    ID=${2:-}
    [ -z "$ID" ] && { echo "uso: $0 lead <req-id>"; exit 1; }
    echo "== jornada do lead req=$ID (site e API, em ordem) =="
    grep -h "req=$ID" "$LP" "$API" 2>/dev/null | sort || true
    ;;
  mapa)
    CORTE=$(desde "${2:-24}")
    echo "== fluxo do MAPA desde $CORTE (UTC) =="
    for f in "$LP" "$API"; do
      recente "$f" "$CORTE" | grep -E 'diagnostic-lead|PlatformLeads|PreliminaryReports|Mailer|Whatsapp|AiSettings|e-book|E-book' || true
    done | sort
    ;;
  saude)
    echo "== serviços =="
    systemctl is-active crivo-api crivo-web crivo-lp | paste -d' ' <(echo -e "crivo-api\ncrivo-web\ncrivo-lp") -
    echo "== API =="
    curl -s -o /dev/null -w 'health: HTTP %{http_code}\n' http://127.0.0.1:3046/api/health
    echo "== logs (tamanho e última escrita) =="
    ls -lh --time-style=+'%F %T' "$API" "$WEB" "$LP" 2>/dev/null | awk '{print $5, $6, $7, $8}'
    echo "(0 bytes com data antiga = o serviço parou de registrar; investigue)"
    ;;
  vivo)
    echo "== acompanhando os 3 logs (Ctrl+C para sair) =="
    tail -f "$API" "$LP" "$WEB"
    ;;
  *)
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
exit 0
