#!/bin/bash

# Тест webhook: отправляем тестовое событие
WEBHOOK_URL="https://freetime-app-jy3k.vercel.app/api/webhook"

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {
        "id": 123456789,
        "first_name": "Test",
        "username": "testuser"
      },
      "chat": {
        "id": 123456789,
        "type": "private"
      },
      "date": 1772532865,
      "text": "/start"
    }
  }'

echo ""
echo "Webhook test sent!"
