# Проект Freetime App

Это веб-приложение с использованием React и TypeScript. Проект также включает интеграцию с Telegram ботом через Telegraf, работу с базой данных Supabase и использование Tailwind CSS для стилизации.

## Стек технологий

- React 18.2.0
- TypeScript 5.0.2
- Vite 4.4.5
- Tailwind CSS 3.3.3
- Supabase 2.39.0
- Telegraf 4.16.3
- Dotenv 16.4.5

## Установка и запуск

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Настройте переменные окружения в файле `.env.local`, указав необходимые ключи API

3. Запустите приложение в режиме разработки:
   ```bash
   npm run dev
   ```

## Структура проекта

- `api/bot.ts` - код для Telegram бота
- `index.html` - основной HTML файл
- `index.tsx` - главный компонент React
- `package.json` - зависимости и скрипты
- `tsconfig.json` - конфигурация TypeScript
- `vite.config.ts` - конфигурация Vite
- `tailwind.config.js` - конфигурация Tailwind CSS
- `vercel.json` - конфигурация для деплоя на Vercel
