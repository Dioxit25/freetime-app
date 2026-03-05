# ⚠️ Проблема с деплоем Vercel

## Текущая ситуация

### Что сделано:
- ✅ Код успешно запушен в GitHub (ветка main, коммиты: d685724, 6384aa1, 969c124)
- ✅ Весь код календаря реализован:
  - Timezone утилиты
  - Event модель с Event, EventException, Reminder
  - Event generator для правил повторения
  - Conflict detector с режимами HARD/SOFT
  - Events API (GET, POST, PUT, DELETE)
  - Migration API

### Проблема:
- ❌ Vercel автодеплой не сработал (2 коммита запушены, но деплой не запустился)
- ❌ Лимит на API деплоев (более 100 за день)
- ❌ Последний деплой: 2 часа назад (старый коммит f210074)
- ❌ Лимит сбросится через ~9 часов после последнего деплоя

## Временные решения

### Вариант 1: Дождаться 9 часов
Лимит сбросится автоматически через ~9 часов. После этого я смогу задеплоить через Vercel CLI или API.

### Вариант 2: Проверить локально
Запустите локальный сервер и проверьте работу нового API. Все файлы уже есть в проекте.

### Вариант 3: Отдельный сервис
Создать отдельный сервис на другом порту, который будет предоставлять новые API (Events, Migration).

## Что можно сделать сейчас (локальная проверка)

Запустите локально:

\`\`\ncd /home/z/my-project
bun run dev
\`\`

Затем в браузере:
1. Откройте http://localhost:3000
2. Откройте консоль (F12)
3. Проверьте миграцию:
\`\`\n
// В консоли:
fetch('http://localhost:3000/api/migrate-events', {
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(console.log)
\`\`

4. Примените миграцию:
\`\`\n
fetch('http://localhost:3000/api/migrate-events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    confirm: true,
    migrateSlots: false
  })
}).then(r => r.json()).then(console.log)
\`\`

5. Протестируйте Events API:
\`\`\n
// Создать тестовое событие:
fetch('http://localhost:3000/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'YOUR_USER_ID',
    groupId: 'YOUR_GROUP_ID',
    type: 'ONE_TIME',
    description: 'Test event',
    isAllDay: false,
    startAt: '2026-03-06T10:00:00.000Z',
    endAt: '2026-03-06T11:00:00.000Z',
    category: 'work',
    status: 'ConfirmeD'
  })
}).then(r => r.json()).then(console.log)
\`\`

## Файлы, которые уже есть в проекте

Бэкенд:
- src/lib/timezone.ts - утилиты для работы с timezone
- src/lib/event-generator.ts - генератор событий
- src/lib/conflict-detector.ts - детектор конфликтов
- src/app/api/events/route.ts - API событий
- src/app/api/events/[id]/route.ts - API отдельного события
- src/app/api/migrate-events/route.ts - API миграции

База данных:
- prisma/schema.prisma - обновлена схема с Event, EventException, Reminder

## Как я могу помочь прямо сейчас

### Вариант A: Создать отдельный сервис
Я могу создать отдельный сервис на порту 3001, который будет предоставлять:
- /api/migrate-events (GET, POST)
- /api/events (GET, POST, PUT, DELETE)

Это позволит вам проверить новые функции прямо сейчас.

### Вариант B: Создать GitHub Action для триггера деплоя
Создать .github/workflows/deploy.yml который будет триггерить деплой через Vercel API.

### Вариант C: Подождать и задеплоить через 9 часов
Я создам новый коммит и задеплою как только лимит сбросится.

Что выбираете?
