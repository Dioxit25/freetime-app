# Calendar Logic Redesign - Deployment Instructions

## Статус деплоя

### ✅ GitHub
- **Репозиторий**: https://github.com/Dioxit25/freetime-app
- **Ветка**: main (commit: `d685724`)
- **Тег**: v1.0.0-calendar

### ⏳ Vercel
- **Проект**: freetime-app-jy3k
- **URL**: https://freetime-app-jy3k.vercel.app
- **Статус**: Код запушен в GitHub, автодеплой должен запуститься автоматически

## Что было задеплоено

### Новые файлы:
- `src/lib/timezone.ts` - утилиты для работы с timezone
- `src/lib/event-generator.ts` - генератор событий с правилами повторения
- `src/lib/conflict-detector.ts` - детектор конфликтов
- `src/app/api/events/route.ts` - API для событий (GET, POST)
- `src/app/api/events/[id]/route.ts` - API для отдельного события (GET, PUT, DELETE)
- `src/app/api/migrate-events/route.ts` - API миграции базы данных

### Изменённые файлы:
- `prisma/schema.prisma` - добавлены модели Event, EventException, Reminder

## Проверка деплоя

### 1. Проверить новый API:
```bash
curl "https://freetime-app-jy3k.vercel.app/api/migrate-events" -H "Content-Type: application/json"
```

Ожидаемый ответ (если таблицы ещё не созданы):
```json
{
  "status": "ok",
  "tables": {
    "Event": false,
    "EventException": false,
    "Reminder": false
  },
  "columns": {
    "conflictMode": false
  }
}
```

### 2. Проверить Events API (после миграции):
```bash
curl "https://freetime-app-jy3k.vercel.app/api/events?groupId=YOUR_GROUP_ID"
```

## Применение миграции

### Вариант 1: Через curl (рекомендуется)

```bash
curl -X POST "https://freetime-app-jy3k.vercel.app/api/migrate-events" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true, "migrateSlots": false}'
```

Параметры:
- `confirm: true` - подтверждение миграции (обязательно)
- `migrateSlots: false` - НЕ мигрировать существующие слоты (рекомендуется сначала протестировать)
- `migrateSlots: true` - мигрировать существующие слоты (после успешного тестирования)

### Вариант 2: Через Telegram Mini App

1. Откройте приложение: https://t.me/TimeAgreeBot
2. Откройте браузерную консоль (F12)
3. Выполните:
```javascript
fetch('https://freetime-app-jy3k.vercel.app/api/migrate-events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    confirm: true,
    migrateSlots: false
  })
}).then(r => r.json()).then(console.log)
```

## После успешной миграции

### 1. Проверить статус:
```bash
curl "https://freetime-app-jy3k.vercel.app/api/migrate-events"
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "tables": {
    "Event": true,
    "EventException": true,
    "Reminder": true
  },
  "columns": {
    "conflictMode": true
  }
}
```

### 2. Создать тестовое событие:

```bash
curl -X POST "https://freetime-app-jy3k.vercel.app/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "groupId": "YOUR_GROUP_ID",
    "type": "ONE_TIME",
    "description": "Test event",
    "isAllDay": false,
    "startAt": "2026-03-06T10:00:00.000Z",
    "endAt": "2026-03-06T11:00:00.000Z",
    "category": "work",
    "status": "CONFIRMED"
  }'
```

## Troubleshooting

### Проблема: API возвращает 404
**Решение**: Подождите несколько минут, автодеплой Vercel может занять время. Проверьте статус в Vercel Dashboard.

### Проблема: Migration возвращает ошибку
**Решение**: Проверьте логи в Vercel Dashboard. Возможные причины:
- Таблицы уже существуют (можно игнорировать)
- Проблемы с подключением к базе данных

### Проблема: События не создаются
**Решение**: Проверьте:
1. Правильность userId и groupId
2. Что миграция применена успешно
3. Логи ответа API

## Следующие шаги

1. ⏳ Дождаться завершения автодеплоя Vercel
2. ✅ Проверить статус миграции (`GET /api/migrate-events`)
3. ✅ Применить миграцию (`POST /api/migrate-events`)
4. ✅ Протестировать Events API
5. ✅ (опционально) Мигрировать существующие слоты
6. 🔄 Интегрировать Event API с UI
7. 🔄 Реализовать Task 38 (правила повторения в UI)
8. 🔄 Реализовать Task 39 (исключения в UI)

## Контакт

Если возникнут проблемы, проверьте:
- GitHub Actions: https://github.com/Dioxit25/freetime-app/actions
- Vercel Dashboard: https://vercel.com/dioxits-projects/deployments
- Логи в `worklog.md`
