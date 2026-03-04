#!/bin/bash

BOT_TOKEN="8588760442:AAEIHS1Pfomhp6VGqtbIFCS3WwBY_dVZ4i0"
WEBHOOK_URL="https://freetime-app-jy3k.vercel.app/api/webhook"

echo "1. Удаляем старый webhook..."
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"

echo ""
echo "2. Настраиваем новый webhook..."
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -F "url=${WEBHOOK_URL}"

echo ""
echo "3. Проверяем webhook info..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
