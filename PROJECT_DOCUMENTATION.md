# TimeAgree - Полное техническое описание проекта

> **Последнее обновление:** 2026-03-11
> **Версия документа:** 1.5
> **Коммит:** 1905891 (feat: add webhook route for Telegram bot commands)

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
│              @TimeAgreeBot (Webhook mode on Vercel)              │
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
│  Webhook Handler: src/app/api/webhook/route.ts                  │
│  Libraries: src/lib/ (db.ts, time-finder.ts, timezone.ts)       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     База данных                                  │
│                                                                  │
│  Локально (dev): SQLite (db/custom.db), telegramId: String      │
│  Продакшн: Supabase PostgreSQL, telegramId: String/BigInt       │
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

### Backend
| Технология | Версия | Назначение |
|------------|--------|------------|
| Prisma | 6.11.1 | ORM для базы данных |
| Zod | 4.0.2 | Валидация данных |
| React Hook Form | 7.60.0 | Формы |

### Database
| Окружение | Технология | Особенности |
|-----------|------------|-------------|
| Development | SQLite | Файл `db/custom.db`, `telegramId: String` |
| Production | Supabase PostgreSQL | Connection pooling, `telegramId: String/BigInt` |

### Deployment
- **Vercel:** Next.js приложение (freetime-app-jy3k.vercel.app)
- **Supabase:** PostgreSQL база данных
- **GitHub:** репозиторий (Dioxit25/freetime-app)

---

## Модели базы данных (Prisma Schema)

### Текущая схема

```prisma
model User {
  id           String        @id @default(cuid())
  telegramId   String        @unique    // String (SQLite) или BigInt (PostgreSQL)
  username     String?
  firstName    String
  lastName     String?
  isBot        Boolean       @default(false)
  timezone     String        @default("UTC")
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
  startAt         DateTime?   // Для ONE_TIME
  endAt           DateTime?   // Для ONE_TIME
  dayOfWeek       Int?        // Для CYCLIC_WEEKLY (0=Вс, 1=Пн, ..., 6=Сб)
  startTimeLocal  String?     // "HH:MM"
  endTimeLocal    String?     // "HH:MM"
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

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
  "lastName": "Иванов",
  "username": "ivan_ivanov",
  "photoUrl": "https://...",
  "languageCode": "ru",
  "timezone": "Europe/Moscow",
  "chatId": -1001234567890
}
```

**Response:**
```json
{
  "user": { "id": "...", "telegramId": "...", "firstName": "...", "timezone": "..." },
  "groups": [{ "id": "...", "telegramTitle": "...", "memberCount": 5 }]
}
```

### Слоты
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/slots?userId=X` | Получить слоты пользователя |
| POST | `/api/slots` | Создать слот |
| DELETE | `/api/slots/[id]` | Удалить слот |

**Типы слотов:**
- `ONE_TIME` — разовое событие (startAt, endAt)
- `CYCLIC_WEEKLY` — еженедельное (dayOfWeek, startTimeLocal, endTimeLocal)

### Группы
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/groups?telegramId=X` | Группы пользователя |
| GET | `/api/groups?all=true` | Все группы |
| POST | `/api/groups` | Создать/обновить группу |
| GET | `/api/groups/[id]` | Информация о группе |
| POST | `/api/groups/join` | Присоединиться к группе |

### Поиск времени
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/find-time` | Найти общее свободное время |

**Request:**
```json
{
  "groupId": "...",
  "userIds": ["..."],      // Опционально
  "daysToLookAhead": 7,
  "minDuration": 60
}
```

### Webhook
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/webhook` | Telegram Bot Webhook |
| GET | `/api/webhook` | Проверка статуса webhook |

---

## Telegram Bot (@TimeAgreeBot)

### Режим работы: Webhook (Production)
**URL:** `https://freetime-app-jy3k.vercel.app/api/webhook`

**Настройка webhook:**
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://freetime-app-jy3k.vercel.app/api/webhook"
```

**Команды:**
| Команда | Контекст | Описание |
|---------|----------|----------|
| `/start` | Любой чат | Приветствие |
| `/help` | Любой | Справка |
| `/initgroup` | Группа | Инициализация группы |
| `/find [дней]` | Группа | Поиск общего времени (1-30 дней) |
| `/add YYYY-MM-DD HH:MM HH:MM описание` | Группа | Быстрое добавление слота |

**События:**
- `my_chat_member` — бот добавлен/удалён из группы (автоматически создаёт группу в БД)

**Handler:** `src/app/api/webhook/route.ts`

---

## UI/UX

### Категории слотов
| Категория | Emoji | Цвет |
|-----------|-------|------|
| Работа | 🏢 | Синий |
| Учёба | 📚 | Зелёный |
| Спорт | 🏃 | Оранжевый |
| Отдых | 🎮 | Фиолетовый |
| Другое | — | Серый |

### Визуализация занятости (Gantt bars)
- 0-30%: зелёный (мало занят)
- 30-60%: жёлтый (средне)
- 60-80%: оранжевый (много)
- 80-100%: красный (очень занят)

### Демо-режим
- Активируется при `userId === 'demo-user'`
- Блокирует все операции записи
- Показывает предупреждение в toast

---

## Переменные окружения

### Локально
```env
DATABASE_URL="file:./db/custom.db"
BOT_TOKEN="..."
WEB_APP_URL="http://localhost:3000"
```

### Vercel (Production)
```env
# Supabase PostgreSQL
DATABASE_URL="postgres://..."
DIRECT_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."

# Supabase API
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Telegram Bot
BOT_TOKEN="..."
BOT_USERNAME="TimeAgreeBot"
WEB_APP_URL="https://freetime-app-jy3k.vercel.app"
```

---

## Структура файлов

```
src/
├── app/
│   ├── page.tsx              # Главный UI (Mini App)
│   ├── layout.tsx            # Root layout + Telegram WebApp SDK
│   ├── globals.css           # Глобальные стили
│   └── api/
│       ├── auth/telegram/route.ts    # Авторизация
│       ├── slots/route.ts            # CRUD слотов
│       ├── slots/[id]/route.ts       # Удаление слота
│       ├── groups/route.ts           # CRUD групп
│       ├── find-time/route.ts        # Поиск времени
│       ├── webhook/route.ts          # Telegram Bot Webhook handler
│       └── ...
├── components/
│   ├── ui/                   # shadcn/ui компоненты
│   ├── DaySlotSheet.tsx      # Bottom sheet для дня
│   └── slots/
├── lib/
│   ├── db.ts                 # Prisma client
│   ├── time-finder.ts        # Алгоритм поиска времени
│   ├── timezone.ts           # Утилиты часовых поясов
│   └── utils.ts              # Общие утилиты
└── hooks/
    ├── use-toast.ts          # Toast уведомления
    └── use-mobile.ts         # Детект мобильных

prisma/
└── schema.prisma             # Схема базы данных
```

---

## Известные проблемы и решения

### 1. ~~"User not identified. Please open from Telegram."~~
**Статус:** ИСПРАВЛЕНО (2026-03-10)
**Причина:** В старом коде не было демо-режима
**Решение:** Откат к коммиту `03b868a` с демо-режимом

### 2. Vercel не деплоит после git push
**Причина:** Vercel подключен к ветке `master`, а не `main`
**Решение:** Push в обе ветки: `git push origin HEAD:main HEAD:master`

### 3. BigInt serialization для PostgreSQL
**Статус:** РЕШЕНО
**Решение:** Fallback в API routes (String → BigInt)

### 4. ~~Бот не реагирует на команды в группах~~
**Статус:** ИСПРАВЛЕНО (2026-03-11)
**Причина:** Webhook route отсутствовал в репозитории
**Решение:** Создан `/api/webhook/route.ts` с обработкой всех команд бота

### 5. ~~Ошибка 409 Conflict при polling~~
**Статус:** ИСПРАВЛЕНО (2026-03-10)
**Причина:** Конфликт между polling mode и webhook mode
**Решение:** Использовать только webhook mode для продакшн

---

## История обновлений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-03-10 | 1.0 | Начальная версия документации |
| 2026-03-10 | 1.1 | Добавлено: webhook handler, исправление проблемы с ботом в группах |
| 2026-03-11 | 1.2 | Webhook route в репозитории, поддержка всех команд бота |
| 2026-03-11 | 1.3 | Добавлена поддержка timezone в командах /find и /add |
| 2026-03-11 | 1.4 | Добавлен раздел "Workflow тестирования и деплоя" |
| 2026-03-11 | 1.5 | Добавлен тестовый бот @FreeTimeV2_bot, создан /api/test-webhook |

---

## Workflow тестирования и деплоя

### Архитектура развертывания

```
┌─────────────────┐     Push      ┌─────────────────┐     Auto-deploy     ┌─────────────────┐
│  Sandbox        │ ────────────> │  GitHub Repo    │ ─────────────────> │    Vercel       │
│  (разработка)   │               │  Dioxit25/      │                    │  Production     │
│                 │               │  freetime-app   │                    │                 │
└─────────────────┘               └─────────────────┘                    └─────────────────┘
```

### Боты

| Бот | Назначение | Переменная окружения | Webhook URL |
|-----|------------|---------------------|-------------|
| **Production Bot** (@TimeAgreeBot) | Основной бот для пользователей | `BOT_TOKEN` | `/api/webhook` |
| **Test Bot** (@FreeTimeV2_bot) | Тестирование изменений | `TEST_BOT_TOKEN` | `/api/test-webhook` |

**Webhook URLs (оба на production):**
- Production: `https://freetime-app-jy3k.vercel.app/api/webhook`
- Test: `https://freetime-app-jy3k.vercel.app/api/test-webhook`

**⚠️ Важно:** Оба бота используют ОДИН И ТОТ ЖЕ код и базу данных!

### Процесс обновления

#### Шаг 1: Разработка и локальное тестирование
```bash
# Внести изменения в код
# Проверить линтер
bun run lint

# Проверить dev сервер (логи)
tail -20 /home/z/my-project/dev.log
```

#### Шаг 2: Тестирование через Test Bot (@FreeTimeV2_bot)
1. Запушить изменения в ветку `develop` (preview deployment)
   ```bash
   git checkout develop
   git add . && git commit -m "test: ..."
   git push origin develop
   ```
2. Протестировать изменения через @FreeTimeV2_bot в тестовой группе
3. Убедиться, что всё работает корректно

**⚠️ Важно:** Тестовый бот использует ТУ ЖЕ базу данных, что и production!

#### Шаг 3: Деплой на Production (только после успешного теста!)
```bash
# Переключиться на master/main
git checkout master

# Слить изменения из develop
git merge develop

# Запушить в ОБЕ ветки (Vercel использует одну из них)
git push origin main
git push origin master

# Vercel автоматически задеплоит изменения
```

#### Шаг 4: Проверка на Production
- Открыть https://freetime-app-jy3k.vercel.app
- Протестировать бота @TimeAgreeBot в группе
- Проверить логи при необходимости

### Откат изменений

```bash
# Откатить последний коммит
git revert HEAD
git push origin main
git push origin master
```

### Полезные команды

```bash
# Проверить статус
git status

# Посмотреть последние коммиты
git log --oneline -5

# Посмотреть разницу с remote
git fetch origin
git diff origin/main
```

### Рекомендации по безопасности

| Практика | Описание |
|----------|----------|
| ✅ Test Bot | Тестировать все изменения через тестового бота |
| ✅ Токены в .env | Никогда не коммитить токены в код |
| ✅ Проверять логи | После деплоя проверять dev.log |
| ✅ Понятные коммиты | Использовать понятные сообщения коммитов |

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

