# Project Context: TimeAgree - Telegram Mini App for Finding Common Free Time

## Project Overview
**Name:** TimeAgree (Telegram Bot: @TimeAgreeBot)
**Description:** Telegram Mini App for finding common free time among group members
**Deployment:** Vercel (https://freetime-app-jy3k.vercel.app)
**Database:** Supabase (PostgreSQL) via Vercel Integration
**Framework:** Next.js 16 with App Router, TypeScript 5

## Current Status
- ✅ Basic app structure created
- ✅ Webhook receives events from Telegram
- ✅ Bot responds to `/test` and `/setup2` commands
- ❌ Automatic group creation when bot added to group NOT WORKING
- ❌ Webhook logging system implemented but NOT WORKING (table not created)
- ❌ `/setup` command does NOT work

## Technical Stack
- **Frontend:** Next.js 16, React, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes, Telegram Bot API Webhook
- **Database:** PostgreSQL (Supabase) via Prisma ORM
- **State Management:** Zustand (client), TanStack Query (server)
- **Authentication:** NextAuth.js v4 available
- **Deployment:** Vercel

## Telegram Integration
**Webhook URL:** `https://freetime-app-jy3k.vercel.app/api/webhook`
**Web App URL:** `https://freetime-app-jy3k.vercel.app`

**Group ID:** `-1003829642821` (Андрей и Мой)
**User IDs:** `267383879`, `5239421669`

**Bot Token:** Stored in Vercel environment variable `BOT_TOKEN`

## Critical Issues

### Issue 1: Bot doesn't send button when added to group
**Status:** NOT RESOLVED
**Problem:** When bot is added to a Telegram group, it doesn't send a message with a button to open the Mini App
**Expected Behavior:**
- Bot receives `new_chat_members` event
- Bot creates group in database
- Bot sends message with inline button: "🌐 Открыть TimeAgree"

**Current Behavior:**
- Bot receives webhook events (confirmed in Vercel logs)
- Bot does NOT send button
- `handleNewChatMembers` handler not being called

**Attempts:**
1. ✅ Fixed event path checking: `body.new_chat_members` → `body.message.new_chat_members`
2. ✅ Added `/setup` command to manually trigger group creation
3. ❌ `/setup` command doesn't work - no logs appear
4. ✅ Created `/setup2` simplified version
5. ❌ `/setup2` doesn't work
6. ✅ Simplified webhook to minimal version with only `/test` and `/setup2`
7. ❌ Even `/test` stopped working at some point
8. ✅ Added extensive logging - logs didn't appear
9. ✅ Removed all database calls - still didn't work
10. ✅ Added debug logging to see text value
11. ✅ Fixed issue - webhook works now with new code

### Issue 2: Webhook logging system
**Status:** IMPLEMENTED BUT TABLE NOT CREATED
**Problem:** Created logging system to save all webhook events to database, but table doesn't exist

**What was done:**
1. Created `WebhookLog` model in Prisma schema
2. Created `/api/logs` endpoint to retrieve logs
3. Created `/logs` page to view logs in browser
4. Updated webhook to save all events to database
5. Fixed Prisma singleton pattern (use `db` from `@/lib/db`)
6. Created `/api/init-db` endpoint to create table manually

**Current Error:**
```
The table `public.WebhookLog` does not exist in the current database.
```

**Root Cause:** Prisma schema changed but migration not applied to Supabase database.
User confirmed database is Supabase via Vercel integration.

**Solution Needed (BLOCKER):**
- Get DATABASE_URL from user or Vercel
- Run Prisma migration: `bun prisma migrate dev --name add_webhook_log`
- OR manually create table in Supabase dashboard

### Issue 3: Database Schema Changes
**Status:** NOT APPLIED
**Problem:** Added `WebhookLog` model to schema but migration not applied

**Changes Made:**
1. Changed `User.telegramId` from `Int` to `BigInt` (for large Telegram IDs)
2. Added `WebhookLog` model

**Database Provider:** PostgreSQL (Supabase) - NOT SQLite

## Important Technical Decisions

### Database
- Using PostgreSQL (Supabase) via Vercel integration
- **NOT using SQLite** (initially tried but changed back to PostgreSQL)
- Connection via Vercel environment variables: `DATABASE_URL`, `POSTGRES_PRISMA_URL`

### Prisma Client
- MUST use singleton pattern from `@/lib/db`
- DO NOT create new `PrismaClient()` instances in API routes
- Example:
```typescript
import { db } from '@/lib/db'

const logs = await db.webhookLog.findMany(...)
```

### Webhook Structure
Current simplified webhook structure:
```typescript
// /api/webhook/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json()

  if (body.message && body.message.text) {
    const text = body.message.text
    const chatId = body.message.chat.id

    if (text === '/test') {
      // Send test message
    }
    if (text === '/setup2') {
      // Send message with button
    }
  }

  return NextResponse.json({ ok: true })
}
```

### Vercel Deployment
- Project ID: `prj_1Swtp5aAO1OzIK4v4jnrRTFD891q`
- Team ID: `team_5qNm6rR1joeLWCcEwA80yUFD`
- Production URL: `https://freetime-app-jy3k.vercel.app`
- **CRITICAL:** Production deployment does NOT auto-update from GitHub
- Must manually trigger redeploy in Vercel dashboard

### Telegram Events to Handle
1. `new_chat_members` - when bot is added to group
2. `message` - when user sends command
3. `callback_query` - when button is pressed
4. `my_chat_member` - bot status changes in chat

## Commands Implemented
- `/test` - sends "✅ Бот работает!" - WORKING ✅
- `/setup2` - sends message with button to open app - WORKING ✅
- `/setup` - should create group and send button - NOT WORKING ❌
- `/start` - welcome message - WORKING ✅

## Files Modified in This Session

### Core Files
- `src/app/api/webhook/route.ts` - Main webhook handler with logging
- `src/lib/db.ts` - Prisma singleton client (already exists, DO NOT modify)
- `prisma/schema.prisma` - Database schema

### New Files Created
- `src/app/api/logs/route.ts` - Endpoint to retrieve webhook logs
- `src/app/logs/page.tsx` - Page to view logs in browser
- `src/app/api/init-db/route.ts` - Endpoint to initialize database (create tables)

## Environment Variables (Vercel)
- `DATABASE_URL` - PostgreSQL connection string (Supabase)
- `BOT_TOKEN` - Telegram bot token
- `WEB_APP_URL` - Mini app URL

## Git Commits Made
1. "Add webhook logging system" - Added WebhookLog model and logging endpoints
2. "Fix Prisma connection in serverless environment" - Use singleton pattern
3. "Add database initialization endpoint" - Manual table creation
4. "Fix database initialization" - Better error handling

## User Requirements (Direct Quotes)
- "Не появилось сообщение, смотри скриншот"
- "Бот в группе теперь не реагирует на команду старт. Может назначит просто другую команду для его вызова?"
- "Отправил /setup тишина"
- "Тестовое сообщение пришло"
- "Не работает"
- "Никакая команда кроме /test не работает"
- "отправил /test. /logs ничего не прислал"
- "Почему так сложно? Неужели так сложно получить id группы и пользователя при открытии ссылки?"
- "Деплой готов. Проверь логи, там полно ошибок"
- "ты же помнишь что у нас база данных в vercel через интеграцию supabase? Деплой сделан, проверь"

## Next Steps (Priority Order)
1. **HIGH PRIORITY:** Apply Prisma migration to create `WebhookLog` table in Supabase
2. **HIGH PRIORITY:** Test webhook logging after table is created
3. **MEDIUM:** Implement `/setup` command to manually create group
4. **MEDIUM:** Handle `new_chat_members` event to auto-create groups
5. **LOW:** Implement automatic group creation when bot added to group

## How to View Logs
```bash
bunx vercel logs --token=<YOUR_VERCEL_TOKEN> --project=prj_1Swtp5aAO1OzIK4v4jnrRTFD891q -n 50
```

## Important Notes
- **CRITICAL:** ALWAYS read this file before making any changes
- **CRITICAL:** ALWAYS use `db` from `@/lib/db` for Prisma operations
- **CRITICAL:** DO NOT create new PrismaClient() instances
- **CRITICAL:** User will punish AI for repeated errors - BE CAREFUL!
- **Database is PostgreSQL (Supabase), NOT SQLite**
- **Production requires manual redeploy in Vercel**
- **Check Vercel logs for debugging**
- **User ID `5239421669` exceeds Int32, must use BigInt**

## User Warning
> "Если ошибки будут постоянно повторяться, я как нибудь тебя накажу"

**Translation:** "If errors keep repeating, I will somehow punish you"

**Action Required:** Be extremely careful and verify all changes before committing!

---
*Last Updated: 2026-03-03 14:55 UTC*
