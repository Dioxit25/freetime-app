# Event Service

Отдельный сервис для предоставления новых API календаря на порту 3001.

## Запуск

### Development mode:
```bash
cd /home/z/my-project/mini-services/event-service
bun install
bun run dev
```

### Production mode:
```bash
cd /home/z/my-project/mini-services/event-service
bun run start
```

## API Endpoints

### Health Check
- `GET /health` - Проверка статуса сервиса

### Migration API
- `GET /api/migrate-events` - Проверка статуса миграции
  - `POST /api/migrate-events` - Применение миграции

### Events API
- `GET /api/events` - Получение списка событий
- `POST /api/events` - Создание нового события
- `GET /api/events/[id]` - Получение события по ID
- `PUT /api/events/[id]` - Обновление события
- ` DELETE /api/events/[id]` - Удаление события

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@host:5432/database/freetime-app

# Optional (default values)
NODE_ENV=development
```

## Examples

### 1. Check migration status:
```bash
curl "http://localhost:3001/api/migrate-events"
```

### 2. Apply migration:
```bash
curl -X POST "http://localhost:3001/api/migrate-events" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true, "migrateSlots": false}'
```

### 3. Create an event:
```bash
curl -X POST "http://localhost:3001/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-here",
    "groupId": "group-id-here",
    "type": "ONE_TIME",
    "description": "Meeting",
    "isAllDay": false,
    "startAt": "2026-03-06T10:00:00:00.000Z",
    "endAt": "2026-03-06T11:00:00:00.000Z",
    "category": "work",
    "status": "CONFIRMED"
  }'
```

### 4. Get events:
```bash
curl "http://localhost:3001/api/events?userId=user-id-here&groupId=group-id-here"
```

### 5. Update event:
```bash
curl -X PUT "http://localhost:3001/api/events/event-id-here" \
  -H "Content-Type: application/json" \
  -d '{ "description": "Updated meeting" }'
```

### 6. Delete event:
```bash
curl -X DELETE "http://localhost:3001/api/events/event-id-here"
```

## Database

Сервис использует ту же базу данных, что основной проект (PostgreSQL/Supabase).

Таблицы:
- `Event` - события
- `EventException` - исключения для повторяющихся событий
- `Reminder` - напоминания

## Features

### Timezone Support
- Конвертация времени между UTC и локальными часовыми поясами
- Поддержка различных timezone для пользователей

### Conflict Detection
- Автоматическая проверка пересечений между событиями
- Режимы: HARD (запрет) и SOFT (предупреждение)

### Recurring Events
- Поддержка правил повторения: DAILY, WEEKLY, BIWEEKLY, MONTHLY, YEARLY, CUSTOM
- Генерация экземпляров событий по правилам
- Исключения для отдельных встреч в повторяющихся сериях

### Event Statuses
- CONFIRMED - подтверждено
- CANCELLED - отменено
- DRAFT - черновик
- ARCHIVED - архивировано

### All-day Events
- События на весь день (день рождения, отпуск, праздники)
- Игнорирование timezone для целых дней

## Development

### File Structure
```
mini-services/event-service/
├── index.ts          # Main server file with API routes
├── prisma/schema.prisma   # Database schema
├── package.json       # Dependencies
└── README.md          # This file
```

### Dependencies
- bun (runtime)
- @prisma/client (database ORM)
- typescript (type definitions)
