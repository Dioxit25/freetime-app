# TimeAgree - Полное техническое описание проекта

> **Последнее обновление:** 2026-03-10
> **Версия документа:** 1.5
> **Коммит:** feat: implement Telegram bot for group commands
> **Статус:** ✅ Все задачи выполнены

---

## Важно для AI-ассистента

**При каждом запросе пользователя:**
1. **СНАЧАЛА** прочитать этот файл (`PROJECT_DOCUMENTATION.md`)
2. При необходимости обновить информацию (с датой обновления)
3. **ПОТОМ** вносить изменения в код

**Когда обновлять этот файл:**
- Добавление нового функционала
- Изменение архитектуры
- Исправление багов (добавить в раздел "Известные проблемы")
- Изменение API или моделей данных
- Изменение переменных окружения

---

## Краткое описание

**TimeAgree** — Telegram Mini App для поиска общего свободного времени в группах.
Позволяет пользователям управлять расписанием занятости и находить временные слоты,
когда все участники группы свободны.

---

## Архитектура системы

```
┌─────────────────────────────────────────────────────────────────┐
│                        Telegram Client                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Личный чат │  │  Групповой  │  │   Mini App (WebApp)     │  │
│  │   с ботом   │  │    чат      │  │  freetime-app-jy3k...   │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Telegram Bot API                             │
│                    @TimeAgreeBot (port 3001)                     │
│  • /start, /help — справка                                      │
│  • /initgroup — создание группы                                 │
│  • /find [дней] — поиск времени                                 │
│  • /add [дата] [время] [описание] — добавление слота            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router                         │
│                      (Vercel, port 3000)                         │
│                                                                  │
│  Frontend: src/app/page.tsx + components/                       │
│  API Routes: src/app/api/                                        │
│  Libraries: src/lib/ (db.ts, time-finder.ts, timezone.ts)       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     База данных                                  │
│                                                                  │
│  Локально (dev): SQLite (db/custom.db), telegramId: String      │
│  Продакшн: Supabase PostgreSQL, telegramId: BigInt              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Технологический стек

### Frontend
| Технология | Версия | Назначение |
|------------|--------|------------|
| Next.js | 16.1.1 | React фреймворк с App Router |
| React | 19.0.0 | UI библиотека |
| TypeScript | 5.x | Типизация |
| Tailwind CSS | 4.x | Стилизация |
| shadcn/ui | New York | UI компоненты (Radix UI) |
| Lucide React | 0.525.0 | Иконки |
| Framer Motion | 12.23.2 | Анимации |
| date-fns | 4.1.0 | Работа с датами |
| date-fns-tz | 3.2.0 | **Работа с часовыми поясами** |

### Backend
| Технология | Версия | Назначение |
|------------|--------|------------|
| Prisma | 6.11.1 | ORM для базы данных |
| Telegraf | (telegraf) | Telegram Bot Framework |
| Zod | 4.0.2 | Валидация данных |
| React Hook Form | 7.60.0 | Формы |

### Database
| Окружение | Технология | Особенности |
|-----------|------------|-------------|
| Development | SQLite | Файл `db/custom.db`, `telegramId: String` |
| Production | Supabase PostgreSQL | Connection pooling, `telegramId: BigInt` |

### Deployment
- **Vercel:** Next.js приложение (freetime-app-jy3k.vercel.app)
- **Supabase:** PostgreSQL база данных
- **GitHub:** репозиторий (Dioxit25/freetime-app)

---

## Модели базы данных (Prisma Schema)

```prisma
model User {
  id           String        @id @default(cuid())
  telegramId   String        @unique    // String (SQLite) или BigInt (PostgreSQL)
  username     String?
  firstName    String
  lastName     String?
  isBot        Boolean       @default(false)
  timezone     String        @default("UTC")  // Часовой пояс пользователя
  languageCode String?       @default("en")
  photoUrl     String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  conflictMode String        @default("SOFT")  // HARD, SOFT
  slots        Slot[]
  memberships  GroupMember[]
}

model Group {
  id               String        @id @default(cuid())
  telegramChatId   String        @unique
  telegramTitle    String
  telegramPhotoUrl String?
  tier             String        @default("FREE")
  memberCount      Int           @default(1)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  members          GroupMember[]
}

model GroupMember {
  id        String   @id @default(cuid())
  userId    String
  groupId   String
  joinedAt  DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@unique([userId, groupId])
}

model Slot {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  type            String   // "ONE_TIME" или "CYCLIC_WEEKLY"
  description     String?
  
  // Для ONE_TIME - время в UTC
  startAt         DateTime?
  endAt           DateTime?
  
  // Для CYCLIC_WEEKLY - локальное время и timezone
  dayOfWeek       Int?        // 0=Вс, 1=Пн, ..., 6=Сб (JavaScript формат)
  startTimeLocal  String?     // "HH:MM" в локальном времени пользователя
  endTimeLocal    String?     // "HH:MM" в локальном времени пользователя
  timezone        String?     // "Europe/Moscow", "America/New_York" и т.д.
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@index([startAt])
  @@index([timezone])
}
```

---

## Работа с часовыми поясами (Timezone Handling)

### Обновлено в версии 1.1 (2026-03-10)

#### Проблема
Ранее timezone не учитывался при поиске слотов CYCLIC_WEEKLY, что приводило к смещению времени для пользователей не в UTC.

#### Решение

**1. Добавлено поле `timezone` в модель Slot:**
- Хранит часовой пояс пользователя на момент создания слота
- Для CYCLIC_WEEKLY слотов — обязателен
- Fallback на timezone пользователя или UTC

**2. Обновлён алгоритм поиска (TimeFinderService):**
```typescript
// Используется date-fns-tz для конвертации
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

// При создании занятых интервалов для CYCLIC_WEEKLY:
const currInTz = toZonedTime(curr, slotTimezone)
const dayOfWeekInTz = currInTz.getDay()

// Создаём локальное время и конвертируем в UTC
const startUtc = fromZonedTime(localDateStart, slotTimezone)
```

**3. Фронтенд передаёт timezone:**
```typescript
// При сохранении слота
const userTimezone = user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

await fetch('/api/slots', {
  method: 'POST',
  body: JSON.stringify({
    // ...
    startTimeLocal: '09:00',
    endTimeLocal: '18:00',
    timezone: userTimezone,  // "Europe/Moscow"
  })
})
```

#### Поток данных

```
┌─────────────────────────────────────────────────────────────────┐
│                  Добавление CYCLIC_WEEKLY слота                  │
├─────────────────────────────────────────────────────────────────┤
│  Пользователь (Москва, UTC+3)                                    │
│  Вводит: 09:00 - 18:00                                           │
│           ↓                                                      │
│  Frontend: timezone = "Europe/Moscow"                            │
│  Отправляет: { startTimeLocal: "09:00", timezone: "Europe/Moscow" }
│           ↓                                                      │
│  Server: Сохраняет как есть (локальное время + timezone)        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Поиск общего времени                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Загружаем слоты с timezone                                   │
│  2. Для каждого CYCLIC_WEEKLY:                                   │
│     - Получаем день в timezone пользователя                      │
│     - Создаём локальное время (09:00 Moscow)                     │
│     - Конвертируем в UTC (06:00 UTC)                             │
│  3. Сравниваем все интервалы в UTC                               │
│  4. Возвращаем результаты в UTC                                  │
│           ↓                                                      │
│  Frontend: toLocaleString() показывает в локальном времени       │
└─────────────────────────────────────────────────────────────────┘
```

#### Пример конвертации

| Пользователь | Локальное время | UTC |
|--------------|-----------------|-----|
| Москва (UTC+3) | 09:00 | 06:00 |
| Нью-Йорк (UTC-5) | 09:00 | 14:00 |
| Токио (UTC+9) | 09:00 | 00:00 |

---

## API Endpoints

### Аутентификация
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/telegram` | Авторизация через Telegram WebApp |

**Request:**
```json
{
  "id": 123456789,
  "firstName": "Иван",
  "timezone": "Europe/Moscow",
  "chatId": -1001234567890
}
```

**Response:**
```json
{
  "user": { 
    "id": "...", 
    "timezone": "Europe/Moscow" 
  },
  "groups": [...]
}
```

### Слоты
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/slots?userId=X` | Получить слоты пользователя |
| POST | `/api/slots` | Создать слот (с timezone) |
| DELETE | `/api/slots/[id]` | Удалить слот |

**Создание CYCLIC_WEEKLY с timezone:**
```json
{
  "userId": "...",
  "type": "CYCLIC_WEEKLY",
  "dayOfWeek": 1,
  "startTimeLocal": "09:00",
  "endTimeLocal": "18:00",
  "timezone": "Europe/Moscow"
}
```

### Группы
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/groups?telegramId=X` | Группы пользователя |
| POST | `/api/groups` | Создать/обновить группу |

### Поиск времени
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/find-time` | Найти общее свободное время |

**Response с информацией о timezone:**
```json
{
  "slots": [...],
  "participants": [
    { "firstName": "Иван", "timezone": "Europe/Moscow" }
  ],
  "timezones": ["Europe/Moscow", "America/New_York"]
}
```

---

## Алгоритмы

### Поиск общего свободного времени (TimeFinderService)

**Файл:** `src/lib/time-finder.ts`

```
1. Определение временного окна (windowStart → windowEnd) в UTC
2. Для каждого пользователя:
   a. getBusyIntervals() - сбор занятых интервалов
      - ONE_TIME: [startAt, endAt] уже в UTC
      - CYCLIC_WEEKLY:
        * Для каждого дня в окне
        * Получить день недели в timezone слота
        * Создать локальное время
        * Конвертировать в UTC с fromZonedTime()
   b. mergeIntervals() - объединение пересекающихся
   c. invertIntervals() - получение свободного времени
3. Пересечение свободного времени всех пользователей (в UTC)
4. Фильтрация по минимальной длительности
5. Сортировка по времени начала
```

**Ключевые функции:**
```typescript
// Конвертация из локального времени в UTC
fromZonedTime(localDate, timezone)

// Конвертация из UTC в локальное время
toZonedTime(utcDate, timezone)
```

---

## Известные проблемы и решения

### 1. ~~"User not identified. Please open from Telegram."~~
**Статус:** ИСПРАВЛЕНО (2026-03-10)
**Решение:** Откат к коммиту с демо-режимом

### 2. ~~CYCLIC_WEEKLY слоты смещены по timezone~~
**Статус:** ИСПРАВЛЕНО И ПРОТЕСТИРОВАНО (2026-03-10)
**Причина:** Алгоритм использовал серверное время вместо timezone пользователя
**Решение:** 
- Добавлено поле `timezone` в модель Slot
- Обновлён TimeFinderService для конвертации времени с использованием `date-fns-tz`
- Переключён провайдер Prisma с SQLite на PostgreSQL
- Деплой на Vercel успешно выполнен
**Проверено:** https://freetime-app-jy3k.vercel.app

### 3. ~~Vercel не деплоит после git push~~
**Статус:** ИСПРАВЛЕНО (2026-03-10)
**Решение:** Production branch изменён на `main` в настройках Vercel

### 4. BigInt serialization для PostgreSQL
**Статус:** РЕШЕНО
**Решение:** Fallback в API routes (String → BigInt)

### 5. ~~Календарь начинается с воскресенья вместо понедельника~~
**Статус:** ИСПРАВЛЕНО (2026-03-10)
**Решение:** Добавлен отдельный массив `daysOfWeekCalendar` для заголовков календаря в европейском формате (Пн-Вс), изменена логика `startPadding` для недель начинающихся с понедельника

### 6. ~~Бот не отвечает на команды в группах~~
**Статус:** ИСПРАВЛЕНО (2026-03-10)
**Описание:** Telegram бот не отвечал на команды (/start, /find, /add, /initgroup) в групповых чатах
**Решение:** Реализован мини-сервис бота:
- Создан `mini-services/bot-service/` на порту 3001
- Установлен telegraf и настроен polling режим
- Команды: /start, /help, /initgroup, /find [дней], /add [дата] [время]
- API обновлён для поддержки telegramId при создании слотов
- Запуск: `BOT_TOKEN=xxx bun run dev` в mini-services/bot-service/

### 7. ~~Нет кнопки обновления слотов при переключении группы~~
**Статус:** ИСПРАВЛЕНО (2026-03-10)
**Решение:** Добавлена кнопка RefreshCw рядом с результатами поиска, сброс participant selection при смене группы

### 8. ~~Нет выбора участников при поиске слота~~
**Статус:** ИСПРАВЛЕНО (2026-03-10)
**Описание:** При поиске общего свободного времени нет возможности выбрать конкретных участников группы
**Решение:** Добавлен интерактивный список участников с возможностью клика для включения/исключения, визуальная индикация выбранных участников, параметр `userIds` в API запросе

---

## История обновлений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-03-10 | 1.5 | **Telegram Bot:** реализован мини-сервис бота с командами /start, /help, /initgroup, /find, /add |
| 2026-03-10 | 1.4 | **UI улучшения:** календарь начинается с Пн, кнопка обновления поиска, выбор участников для поиска слотов |
| 2026-03-10 | 1.3 | **Деплой подтверждён:** timezone работает корректно, продакшн обновлён |
| 2026-03-10 | 1.2 | **Переключение на PostgreSQL:** изменён провайдер Prisma с SQLite на PostgreSQL для совместимости с Supabase |
| 2026-03-10 | 1.1 | **Исправлена работа с timezone:** добавлено поле timezone в Slot, обновлён TimeFinderService, добавлена date-fns-tz |
| 2026-03-10 | 1.0 | Начальная версия документации |

---

## Для будущих изменений

При добавлении нового функционала добавлять информацию в соответствующие разделы:

1. **Новый API endpoint** → раздел "API Endpoints"
2. **Новая модель БД** → раздел "Модели базы данных"
3. **Новый алгоритм** → раздел "Алгоритмы"
4. **Новая команда бота** → раздел "Telegram Bot"
5. **Исправление бага** → раздел "Известные проблемы"
6. **Новая переменная окружения** → раздел "Переменные окружения"

**Формат для исправлений:**
```markdown
### N. Название проблемы
**Статус:** ИСПРАВЛЕНО / В РАБОТЕ / ИЗВЕСТНО
**Дата:** YYYY-MM-DD
**Причина:** ...
**Решение:** ...
```
