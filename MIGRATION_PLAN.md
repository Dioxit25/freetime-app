# План рефакторинга TimeAgree на концептуальное описание календаря

## Текущая проблема
Текущая реализация использует модель `Slot` с двумя типами: `ONE_TIME` и `CYCLIC_WEEKLY`. Это упрощённая модель, которая не поддерживает:
- Статусы событий (confirmed/pending/cancelled)
- Правила повторений (хранятся как временные слоты)
- Исключения из серий
- Часовые пояса для путешественников
- Напоминания

## Концептуальная архитектура

### 1. Event (бывший Slot)
```prisma
model Event {
  id                String
  userId            String
  groupId           String
  
  // Статус
  status            EventStatus // CONFIRMED | PENDING | CANCELLED
  isException       Boolean // Исключение из правила
  
  // Правило повторения (если есть)
  repetitionRuleId   String? // null = одноразовое, неnull = повторяющееся
  
  // Базовая информация
  title             String
  description       String?
  
  // ВСЕ время в UTC
  startAtUtc        DateTime
  endAtUtc         DateTime
  
  // Локальное время (для отображения и поиска)
  startAtLocal     DateTime? // Для поиска пересечений
  endAtLocal      DateTime?
  timezone          String?  // Часовой пояс
  
  // Для повторяющихся событий
  dayOfWeek        Int?     // 0-6 (Sunday-Saturday)
  startTimeLocal    String? // HH:MM
  endTimeLocal      String? // HH:MM
  startDateUtc      DateTime?  // Дата начала серии
  endDateUtc        DateTime? // Дата окончания
  endAtUtc         DateTime?
  
  // Исключения из серии
  parentEventId     String?  // ID оригинального события
  
  createdAt         DateTime
  updatedAt         DateTime
  
  @@index([userId])
  @@index([groupId])
  @@index([startAtUtc])
}
```

### 2. RepetitionRule (новое)
```prisma
model RepetitionRule {
  id              String
  userId          String
  groupId         String
  type            RepetitionType  // DAILY, WEEKLY, MONTHLY
  title           String
  description      String
  dayOfWeek       Int?     // 0-6 (Sunday-Saturday)
  startTimeLocal    String  // HH:MM
  endTimeLocal      String  // HH:MM
  startDateUtc      DateTime
  endDateUtc       DateTime?
  createdAt       DateTime
  updatedAt       DateTime
}
```

### 3. Reminder (новое)
```prisma
model Reminder {
  id          String
  eventId     String
  userId      String
  remindAtUtc DateTime
  repetitionRuleId String?
  status       ReminderStatus // PENDING | SENT | FAILED
  errorMessage String?
  sentAt       DateTime?
  createdAt   DateTime
}
```

## План миграции (Phase 1)

### Шаг 1: Создать новые модели
1. Создать `enum EventStatus` (CONFIRMED | PENDING | CANCELLED)
2. Создать `enum RepetitionType` (DAILY | WEEKLY | MONTHLY)
3. Создать `enum ReminderStatus` (PENDING | SENT | FAILED)
4. Создать модель `Reminder`
5. Создать модель `RepetitionRule`
6. Создать модель `Event` с новыми полями

### Шаг 2: Обновить существующие модели
1. В `User`:
   - Добавить поле `timezone` (сейчас @default("UTC"))
   - Может хранить несколько часовых поясов для разных устройств
   
2. В `Group`:
   - Удалить `memberCount` (будет вычисляться динамически)
   - Добавить `timezone` для группы

### Шаг 3: Миграция слотов
```sql
-- Создаем новую таблицу Event
CREATE TABLE "Event" (...);

-- Переносим существующие слоты в Event
INSERT INTO "Event" (...);

-- Создаем правила повторения для CYCLIC_WEEKLY
-- Группируем одинаковые циклические слоты по описанию, времени и дням недели
INSERT INTO "RepetitionRule" (...);

-- Создаем таблицу Reminder
CREATE TABLE "Reminder" (...);
```

## План реализации (Phase 2)

### Шаг 1: Хранение времени в UTC
```typescript
// При создании слота:
startAtUtc = toUTC(new Date(date + 'T' + startTime + ':00Z'))
endAtUtc = toUTC(new Date(date + 'T' + endTime + ':00Z'))

// При загрузке слотов:
startAtLocal = fromUTC(startAtUtc, user.timezone)
endAtLocal = fromUTC(endAtUtc, user.timezone)
```

### Шаг 2: Правила повторений
```typescript
// Создание повторяющегося события (вместо циклических слотов)
const rule = await db.repetitionRule.create({
  userId,
  groupId,
  type: 'WEEKLY',
  title: 'Работа',
  description: 'Еженедельная встреча',
  dayOfWeek: 1, // Понедельник
  startTimeLocal: '09:00',
  endTimeLocal: '18:00',
  startDateUtc: new Date('2026-03-03'), // Дата начала серии
  endDateUtc: null, // Бесконечная серия
})

// Создаем события для каждого дня недели (7 дней)
for (let i = 0; i < 7; i++) {
  await db.event.create({
    userId,
    groupId,
    type: 'CYCLIC_WEEKLY',
    status: 'CONFIRMED',
    repetitionRuleId: rule.id,
    title: rule.title,
    description: rule.description,
    startAtUtc: getNextWeekDay(rule.startDateUtc, i),
    endAtUtc: getNextWeekDay(rule.startDateUtc, i + 1),
    dayOfWeek: i, // JavaScript день недели (0=Sunday)
    startTimeLocal: rule.startTimeLocal,
    endTimeLocal: rule.endTimeLocal,
    parentEventId: null,
  })
}
```

### Шаг 3: Исключения из серий
```typescript
// Создаем исключение для одной встречи в серии
const exception = await db.event.create({
  userId,
  groupId,
  type: 'ONE_TIME',
  status: 'CONFIRMED',
  isException: true,
  parentEventId: originalEventId, // ID оригинального события
  title: 'Работа (изменено)',
  description: 'Перенесено с 09:00 на 10:00',
  startAtUtc: new Date('2026-03-03T06:00:00Z'),
  endAtUtc: new Date('2026-03-03T07:00:00Z'),
  timezone: 'Europe/Moscow',
  parentEventId: rule.id, // Ссылка на правило
})
```

### Шаг 4: Напоминания
```typescript
// При создании события с напоминанием
await db.reminder.create({
  eventId: event.id,
  userId,
  remindAtUtc: new Date(event.startAtUtc.getTime() - 15 * 60000), // За 15 минут до
  status: 'PENDING',
})

// Фоновый процесс проверяет каждую минуту
// При совпадении времени - отправляет уведомление
// Помечает как SENT чтобы не повторяться
```

### Шаг 5: Проверка пересечений
```typescript
// Проверка пересечения при создании события
const hasConflict = await checkEventConflict(newEvent)

if (hasConflict && mode === 'STRICT') {
  throw new Error('В это время вы уже заняты')
} else if (hasConflict && mode === 'SOFT') {
  // Показываем красный цвет конфликта, но разрешаем сохранять
  // Пользователь может сознательно планировать пересечения
}
```

### Шаг 6: Отображение с учетом часового пояса
```typescript
// При загрузке событий
const displayEvent = {
  ...event,
  startAtLocal: fromUTC(event.startAtUtc, user.timezone),
  endAtLocal: fromUTC(event.endAtUtc, user.timezone),
}

// В календаре показываем displayEvent.startAtLocal и displayEvent.endAtLocal
```

## Последовательность задач

1. ✅ Анализ текущей структуры
2. 📋 Спроектировать новую схему
3. 📋 Миграция данных
4. 🔄 Переписать API
5. 🔄 Переписать фронтенд
6. 🔄 Тестирование

