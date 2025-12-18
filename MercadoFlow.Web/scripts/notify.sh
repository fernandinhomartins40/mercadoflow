#!/bin/bash
# Script de notificação para eventos de deploy
# Uso: ./notify.sh "Título" "Mensagem" "tipo"
# Tipos: success, warning, error, info

TITLE="${1:-Notificação MercadoFlow}"
MESSAGE="${2:-Deploy executado}"
TYPE="${3:-info}"

# Cores para log
case "$TYPE" in
  success)
    COLOR="\033[0;32m" # Verde
    EMOJI="✅"
    ;;
  warning)
    COLOR="\033[0;33m" # Amarelo
    EMOJI="⚠️"
    ;;
  error)
    COLOR="\033[0;31m" # Vermelho
    EMOJI="❌"
    ;;
  *)
    COLOR="\033[0;36m" # Ciano
    EMOJI="ℹ️"
    ;;
esac
NC="\033[0m" # No Color

# Log para console
echo -e "${COLOR}${EMOJI} ${TITLE}${NC}"
echo -e "${COLOR}${MESSAGE}${NC}"
echo ""

# Timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Salvar em arquivo de log
LOG_FILE="/var/log/mercadoflow/deploy.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
echo "[${TIMESTAMP}] [${TYPE}] ${TITLE}: ${MESSAGE}" >> "$LOG_FILE" 2>/dev/null || true

# ===== INTEGRAÇÃO COM SERVIÇOS DE NOTIFICAÇÃO =====

# 1. Slack Webhook (opcional)
if [ -n "${SLACK_WEBHOOK_URL}" ]; then
  case "$TYPE" in
    success) SLACK_COLOR="good" ;;
    warning) SLACK_COLOR="warning" ;;
    error) SLACK_COLOR="danger" ;;
    *) SLACK_COLOR="#36a64f" ;;
  esac

  curl -X POST "${SLACK_WEBHOOK_URL}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"attachments\": [{
        \"color\": \"${SLACK_COLOR}\",
        \"title\": \"${TITLE}\",
        \"text\": \"${MESSAGE}\",
        \"footer\": \"MercadoFlow Deploy\",
        \"ts\": $(date +%s)
      }]
    }" \
    --silent --output /dev/null || true
fi

# 2. Discord Webhook (opcional)
if [ -n "${DISCORD_WEBHOOK_URL}" ]; then
  curl -X POST "${DISCORD_WEBHOOK_URL}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"embeds\": [{
        \"title\": \"${EMOJI} ${TITLE}\",
        \"description\": \"${MESSAGE}\",
        \"color\": 3066993,
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
      }]
    }" \
    --silent --output /dev/null || true
fi

# 3. Telegram Bot (opcional)
if [ -n "${TELEGRAM_BOT_TOKEN}" ] && [ -n "${TELEGRAM_CHAT_ID}" ]; then
  curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    -d "text=${EMOJI} *${TITLE}*%0A${MESSAGE}" \
    -d "parse_mode=Markdown" \
    --silent --output /dev/null || true
fi

# 4. Email (opcional)
if [ -n "${NOTIFICATION_EMAIL}" ] && command -v mail &> /dev/null; then
  echo "${MESSAGE}" | mail -s "[MercadoFlow] ${TITLE}" "${NOTIFICATION_EMAIL}" 2>/dev/null || true
fi

exit 0
