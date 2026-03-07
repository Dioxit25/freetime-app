# TimeAgree - Новый Дизайн Концепция

## 🎨 Общая концепция

**Стиль**: Dark Neon (темный неон)
**Целевая аудитория**: Пользователи Telegram Mini App (мобильные)
**Ключевые характеристики**: Современный, минималистичный, тёмный, с яркими акцентами

---

## 🎯 Дизайн-токены

### Цветовая палитра

```css
/* Основные цвета (темная тема) */
--bg-primary: #0a0a0a        /* Главный фон */
--bg-secondary: #111111      /* Вторичный фон */
--bg-tertiary: #1a1a1a       /* Третичный фон */
--bg-card: #161616           /* Фон карточек */

/* Текст */
--text-primary: #ffffff       /* Основной текст */
--text-secondary: #a0a0a0    /* Вторичный текст */
--text-muted: #666666        /* Мутный текст */

/* Акцентные цвета */
--accent: #6366f1            /* Индиго (primary) */
--accent-hover: #818cf8      /* Hover акцент */
--accent-subtle: rgba(99, 102, 241, 0.1)  /* Подсветка */

/* Семантические цвета */
--success: #10b981           /* Зелёный */
--warning: #f59e0b           /* Жёлтый */
--error: #ef4444             /* Красный */

/* Границы */
--border: rgba(255, 255, 255, 0.08)         /* Основная граница */
--border-hover: rgba(255, 255, 255, 0.15)  /* Hover граница */
```

### Градиенты

```css
/* Логотип */
logo-gradient: linear-gradient(135deg, #6366f1, #a855f7)

/* Кнопка primary */
btn-primary-gradient: linear-gradient(135deg, #6366f1, #8b5cf6)

/* Статистика */
stat-work-gradient: linear-gradient(90deg, #3b82f6, #60a5fa)
stat-study-gradient: linear-gradient(90deg, #10b981, #34d399)
stat-sport-gradient: linear-gradient(90deg, #f59e0b, #fbbf24)
stat-leisure-gradient: linear-gradient(90deg, #a855f7, #c084fc)
```

### Размеры и отступы

```css
/* Border radius */
--radius-sm: 8px      /* Маленькие элементы (кнопки, бейджи) */
--radius-md: 12px     /* Средние элементы (карточки, инпуты) */
--radius-lg: 16px     /* Большие элементы (модальные окна) */
--radius-xl: 20px     /* Очень большие элементы (hero секции) */

/* Отступы (8px система) */
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
--spacing-2xl: 48px
```

### Тени

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.3)
```

### Анимации

```css
/* Длительность */
--duration-fast: 150ms
--duration-base: 200ms
--duration-slow: 300ms

/* Easing */
--ease-out: ease-out
--ease-in: ease-in
--ease-in-out: ease-in-out
```

---

## 📱 Компоненты

### 1. Header (Шапка)

```tsx
<header class="header">
  <div class="header-content">
    <div class="logo">
      <div class="logo-icon">📅</div>
      TimeAgree
    </div>
    <div class="user-info">
      <span>👤</span>
      <span>Имя пользователя</span>
    </div>
  </div>
</header>
```

**Стили**:
- Position: sticky
- Background: rgba(10, 10, 10, 0.8) с backdrop-blur(20px)
- Border-bottom: 1px solid var(--border)
- Padding: 16px 24px
- Z-index: 100

### 2. Sidebar (Боковая навигация)

```tsx
<nav class="sidebar">
  <div class="nav-item active">
    <span class="nav-icon">📊</span>
    Моё время
  </div>
  <div class="nav-item">
    <span class="nav-icon">🔍</span>
    Найти время
  </div>
  <div class="nav-item">
    <span class="nav-icon">⚙️</span>
    Настройки
  </div>
</nav>
```

**Стили**:
- Position: sticky (top: 100px)
- Gap: 12px между элементами
- Hover: background var(--bg-tertiary)
- Active: background var(--accent-subtle) + color var(--accent-hover)

### 3. Calendar (Календарь)

```tsx
<div class="calendar">
  <div class="calendar-header">
    <h2 class="month-title">Март 2026</h2>
    <div class="month-navigation">
      <button class="nav-btn">‹</button>
      <span class="month-label">Март 2026</span>
      <button class="nav-btn">›</button>
    </div>
  </div>
  <div class="weekdays">
    <div class="weekday">Пн</div>
    <div class="weekday">Вт</div>
    <!-- ... -->
  </div>
  <div class="calendar-grid">
    <div class="day-cell has-slots selected">12</div>
    <!-- ... -->
  </div>
</div>
```

**Стили**:
- Grid: 7 колонок
- Aspect ratio: 1:1 для ячеек
- Border radius: var(--radius-md)
- Hover: transform scale(1.05) + border var(--accent)
- Selected: background var(--accent)
- Has slots: точка внизу (6x6px circle)

### 4. Quick Templates (Быстрые шаблоны)

```tsx
<div class="templates-grid">
  <div class="template-card">
    <div class="template-icon">💼</div>
    <div class="template-name">Рабочий день</div>
    <div class="template-time">09:00 - 18:00</div>
  </div>
  <!-- ... -->
</div>
```

**Стили**:
- Grid: 4 колонки (mobile: 2 колонки, mobile-sm: 1 колонка)
- Padding: 16px
- Border: 1px solid var(--border)
- Hover: transform translateY(-2px) + shadow

### 5. Time Slot Card (Карточка времени)

```tsx
<div class="slot-card">
  <div class="slot-icon work">💼</div>
  <div class="slot-content">
    <div class="slot-title">Встреча с командой</div>
    <div class="slot-time">09:00 - 10:00</div>
  </div>
  <div class="slot-actions">
    <button class="slot-action-btn">📋</button>
    <button class="slot-action-btn delete">✕</button>
  </div>
</div>
```

**Стили**:
- Flex layout
- Gap: 16px
- Icon: 44x44px
- Hover: background var(--bg-card) + shadow

### 6. Statistics Card (Карточка статистики)

```tsx
<div class="stat-card">
  <div class="stat-header">
    <div class="stat-icon work">💼</div>
    <span class="stat-label">Работа</span>
  </div>
  <div class="stat-value">42ч</div>
  <div class="stat-bar">
    <div class="stat-bar-fill work" style="width: 60%"></div>
  </div>
</div>
```

**Стили**:
- Progress bar: height 6px, radius 3px
- Gradient fill
- Animation: transition width 0.5s ease-out

---

## 🎨 Варианты дизайна

### Вариант 1: Dark Neon (выбранный)
- Тёмный фон (#0a0a0a)
- Индиго/фиолетовые акценты
- Минималистичный UI
- Тонкие границы
- Прозрачные элементы

### Вариант 2: Minimal Light
- Светлый фон (#ffffff)
- Серые текста (#1f2937, #6b7280)
- Синие акценты (#3b82f6)
- Карточки с лёгкими тенями
- Чистый, профессиональный вид

### Вариант 3: Colorful Gradient
- Тёмный фон (#0f172a)
- Многоцветные градиенты
- Яркие акценты
- Анимированные градиентные кнопки
- Энергичный, игривый стиль

---

## 📐 Адаптивность

### Desktop (> 1024px)
- Sidebar: 280px слева
- Main content: остальное пространство
- Calendar: 7 колонок
- Templates: 4 колонки

### Tablet (768px - 1024px)
- Sidebar: горизонтальная навигация
- Calendar: 7 колонок
- Templates: 2 колонки

### Mobile (< 768px)
- Sidebar: горизонтальный scroll
- Calendar: 7 колонок (тоже)
- Templates: 1 колонка
- Slot actions: скрыты

---

## ✨ Микро-интеракции

### Hover эффекты
- Кнопки: translateY(-1px) + shadow усиление
- Карточки: translateY(-2px) + shadow
- Навигация: background shift
- Календарь: scale(1.05) + border highlight

### Focus состояния
- Input: border var(--accent) + box-shadow var(--accent-subtle)
- Button: outline 2px solid var(--accent)
- Отступ: 3px от границы

### Transitions
- Длительность: 200ms
- Easing: ease-out
- Свойства: transform, background, border, box-shadow, color

---

## 🎯 Отличия от текущего дизайна

### Текущий дизайн:
- Слишком много белого/светлого
- Грубые границы
- Перегруженный интерфейс
- Нет чёткой иерархии
- Слишком много цветов

### Новый дизайн:
- Тёмная тема (сохраняет батарею)
- Минималистичный UI
- Чёткая иерархия (размеры, цвета, отступы)
- Сдержанная цветовая палитра
- Прозрачные элементы с blur
- Плавные анимации
- Профессиональный вид

---

## 📝 Следующие шаги

1. ✅ Создан HTML preview (design-preview.html)
2. ✅ Создана документация (DESIGN.md)
3. ⏳ Создать визуальные концепции (изображения)
4. ⏳ Получить обратную связь
5. ⏳ Утвердить дизайн
6. ⏳ Реализовать в production

---

## 🔗 Связанные файлы

- `/design-preview.html` - Live preview нового дизайна
- `/src/app/page.tsx` - Текущая реализация (будет заменена)
- `/src/app/globals.css` - Глобальные стили (будут обновлены)
- `/tailwind.config.ts` - Tailwind конфигурация (будет обновлена)
