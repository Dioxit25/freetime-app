import { Telegraf, Context } from 'telegraf'
import { message } from 'telegraf/filters'

// Bot token from environment
const BOT_TOKEN = process.env.BOT_TOKEN || '8588760442:AAEIHS1Pfomhp6VGqtbIFCS3WwBY_dVZ4i0'

// API base URL for the main app
const API_BASE = process.env.API_BASE || 'http://localhost:3000'

// Types
interface User {
  id: string
  telegramId: string
  firstName: string
  lastName?: string
  username?: string
  timezone?: string
}

interface Group {
  id: string
  telegramChatId: string
  telegramTitle: string
}

interface Slot {
  id: string
  start: string
  end: string
  durationMinutes: number
}

interface FindTimeResponse {
  slots: Slot[]
  participants: { id: string; firstName: string; lastName?: string; timezone?: string }[]
  count: number
  timezones?: string[]
}

// Initialize bot
const bot = new Telegraf(BOT_TOKEN)

// Helper: Get or create user
async function getOrCreateUser(tgUser: any): Promise<User | null> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: tgUser.id,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
        languageCode: tgUser.language_code,
        timezone: 'UTC', // Default, will be updated from app
      }),
    })

    if (response.ok) {
      const data = await response.json()
      return data.user
    }
    return null
  } catch (error) {
    console.error('Error getting/creating user:', error)
    return null
  }
}

// Helper: Get group by chat ID
async function getGroupByChatId(chatId: string): Promise<Group | null> {
  try {
    const response = await fetch(`${API_BASE}/api/groups?telegramChatId=${chatId}`)
    if (response.ok) {
      const groups = await response.json()
      return groups.length > 0 ? groups[0] : null
    }
    return null
  } catch (error) {
    console.error('Error getting group:', error)
    return null
  }
}

// Helper: Create or update group
async function createOrUpdateGroup(chatId: string, title: string): Promise<Group | null> {
  try {
    const response = await fetch(`${API_BASE}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramChatId: chatId,
        telegramTitle: title,
      }),
    })

    if (response.ok) {
      return await response.json()
    }
    return null
  } catch (error) {
    console.error('Error creating/updating group:', error)
    return null
  }
}

// Command: /start
bot.command('start', async (ctx) => {
  const chatType = ctx.chat?.type
  const isGroup = chatType === 'group' || chatType === 'supergroup'

  if (isGroup) {
    await ctx.reply(
      '👋 Привет! Я TimeAgreeBot - помогу найти общее свободное время в вашей группе.\n\n' +
      '📌 Команды:\n' +
      '/initgroup - Инициализировать группу\n' +
      '/find [дней] - Найти свободное время (по умолчанию 7 дней)\n' +
      '/add [дата] [время] - Добавить занятое время\n' +
      '/help - Справка\n\n' +
      '💡 Для полноценной работы откройте Mini App через кнопку меню.'
    )
  } else {
    const user = ctx.from
    await getOrCreateUser(user)

    await ctx.reply(
      '👋 Добро пожаловать в TimeAgree!\n\n' +
      'Это приложение для поиска общего свободного времени в группах.\n\n' +
      '📌 Чтобы начать:\n' +
      '1. Добавьте бота в группу\n' +
      '2. Используйте /initgroup для инициализации\n' +
      '3. Откройте Mini App для управления расписанием\n\n' +
      '🔗 Откройте Mini App через кнопку меню или перейдите в группу.'
    )
  }
})

// Command: /help
bot.command('help', async (ctx) => {
  await ctx.reply(
    '📖 Справка TimeAgreeBot\n\n' +
    '📌 Команды бота:\n' +
    '/start - Начать работу\n' +
    '/help - Эта справка\n' +
    '/initgroup - Инициализировать группу (в групповом чате)\n' +
    '/find [дней] - Найти свободное время (по умолчанию 7 дней)\n' +
    '/add [дата] [время] - Добавить занятое время\n\n' +
    '💡 Примеры:\n' +
    '/find 14 - найти время на 14 дней\n' +
    '/add сегодня 10:00-18:00 работа\n' +
    '/add завтра 14:00-16:00 встреча\n\n' +
    '🔗 Mini App позволяет:\n' +
    '• Управлять расписанием занятости\n' +
    '• Настраивать повторяющиеся слоты\n' +
    '• Искать общее свободное время'
  )
})

// Command: /initgroup
bot.command('initgroup', async (ctx) => {
  const chatType = ctx.chat?.type

  if (chatType !== 'group' && chatType !== 'supergroup') {
    await ctx.reply('⚠️ Эту команду можно использовать только в групповом чате.')
    return
  }

  const chatId = ctx.chat?.id.toString()
  const chatTitle = ctx.chat?.title || 'Группа'

  if (!chatId) {
    await ctx.reply('❌ Ошибка: не удалось определить ID чата.')
    return
  }

  // Create or update group
  const group = await createOrUpdateGroup(chatId, chatTitle)

  if (group) {
    // Add user to group members
    const user = ctx.from
    if (user) {
      await getOrCreateUser(user)
    }

    await ctx.reply(
      `✅ Группа "${chatTitle}" инициализирована!\n\n` +
      '📌 Теперь участники могут:\n' +
      '• Открыть Mini App через кнопку меню\n' +
      '• Добавить свои занятые слоты\n' +
      '• Использовать /find для поиска общего времени\n\n' +
      '💡 Бот автоматически зарегистрирует участников при использовании команд.'
    )
  } else {
    await ctx.reply('❌ Не удалось инициализировать группу. Попробуйте позже.')
  }
})

// Command: /find
bot.command('find', async (ctx) => {
  const chatType = ctx.chat?.type
  const isGroup = chatType === 'group' || chatType === 'supergroup'

  // Parse days argument
  const args = ctx.message?.text?.split(' ').slice(1) || []
  const days = parseInt(args[0]) || 7

  if (isGroup) {
    // Group chat - find common time for all members
    const chatId = ctx.chat?.id.toString()
    const group = await getGroupByChatId(chatId || '')

    if (!group) {
      await ctx.reply(
        '⚠️ Группа не инициализирована.\n\n' +
        'Используйте /initgroup для начала работы.'
      )
      return
    }

    await ctx.reply(`🔍 Ищу общее свободное время на ${days} дней...`)

    try {
      const response = await fetch(`${API_BASE}/api/find-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.id,
          daysToLookAhead: days,
          minDuration: 60,
        }),
      })

      if (response.ok) {
        const data: FindTimeResponse = await response.json()

        if (data.slots && data.slots.length > 0) {
          const slotsText = data.slots.slice(0, 10).map((slot, i) => {
            const start = new Date(slot.start)
            const end = new Date(slot.end)
            const dayName = start.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
            const timeStart = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            const timeEnd = end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            const duration = slot.durationMinutes >= 60
              ? `${Math.floor(slot.durationMinutes / 60)}ч ${slot.durationMinutes % 60}м`
              : `${slot.durationMinutes}м`

            return `${i + 1}. ${dayName} ${timeStart}-${timeEnd} (${duration})`
          }).join('\n')

          const moreText = data.slots.length > 10 ? `\n... и ещё ${data.slots.length - 10} слотов` : ''

          await ctx.reply(
            `✅ Найдено ${data.count} свободных слотов:\n\n${slotsText}${moreText}\n\n` +
            `👥 Участники: ${data.participants.map(p => p.firstName).join(', ')}\n` +
            `🌍 Часовые пояса: ${data.timezones?.join(', ') || 'UTC'}`
          )
        } else {
          await ctx.reply(
            '😔 Общего свободного времени не найдено.\n\n' +
            '💡 Участникам нужно добавить свои занятые слоты через Mini App.'
          )
        }
      } else {
        await ctx.reply('❌ Ошибка при поиске. Попробуйте позже.')
      }
    } catch (error) {
      console.error('Find time error:', error)
      await ctx.reply('❌ Ошибка при поиске. Попробуйте позже.')
    }
  } else {
    // Private chat - redirect to group
    await ctx.reply(
      '⚠️ Поиск общего времени работает только в группах.\n\n' +
      'Добавьте бота в группу и используйте:\n' +
      '1. /initgroup - для инициализации\n' +
      '2. /find [дней] - для поиска времени'
    )
  }
})

// Command: /add
bot.command('add', async (ctx) => {
  const user = ctx.from
  if (!user) {
    await ctx.reply('❌ Не удалось определить пользователя.')
    return
  }

  // Parse arguments
  const text = ctx.message?.text || ''
  const args = text.split(' ').slice(1)

  if (args.length < 2) {
    await ctx.reply(
      '📝 Добавление занятого времени:\n\n' +
      'Формат: /add [дата] [время] [описание]\n\n' +
      'Примеры:\n' +
      '/add сегодня 10:00-18:00 работа\n' +
      '/add завтра 14:00-16:00 встреча\n' +
      '/add 15.03 09:00-12:00'
    )
    return
  }

  // Ensure user exists
  await getOrCreateUser(user)

  // Parse date
  const dateStr = args[0].toLowerCase()
  const timeStr = args[1]
  const description = args.slice(2).join(' ') || undefined

  let targetDate: Date

  if (dateStr === 'сегодня' || dateStr === 'today') {
    targetDate = new Date()
  } else if (dateStr === 'завтра' || dateStr === 'tomorrow') {
    targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 1)
  } else {
    // Try to parse as DD.MM or DD.MM.YY
    const parts = dateStr.split('.')
    if (parts.length >= 2) {
      const day = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      const year = parts.length >= 3 ? 2000 + parseInt(parts[2]) : new Date().getFullYear()
      targetDate = new Date(year, month, day)
    } else {
      targetDate = new Date()
    }
  }

  // Parse time
  const timeParts = timeStr.split('-')
  if (timeParts.length !== 2) {
    await ctx.reply('❌ Неверный формат времени. Используйте: ЧЧ:ММ-ЧЧ:ММ\nПример: 10:00-18:00')
    return
  }

  const startTime = timeParts[0]
  const endTime = timeParts[1]

  // Validate time format
  const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    await ctx.reply('❌ Неверный формат времени. Используйте: ЧЧ:ММ\nПример: 09:00-18:00')
    return
  }

  // Create slot
  const dateIso = targetDate.toISOString().split('T')[0]
  const startIso = new Date(`${dateIso}T${startTime}:00`)
  const endIso = new Date(`${dateIso}T${endTime}:00`)

  try {
    const response = await fetch(`${API_BASE}/api/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId: user.id.toString(),
        type: 'ONE_TIME',
        description,
        startAt: startIso.toISOString(),
        endAt: endIso.toISOString(),
        startTimeLocal: startTime,
        endTimeLocal: endTime,
        timezone: 'UTC',
      }),
    })

    if (response.ok) {
      const dayName = targetDate.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
      await ctx.reply(
        `✅ Добавлено занятое время:\n\n` +
        `📅 ${dayName}\n` +
        `⏰ ${startTime} - ${endTime}` +
        (description ? `\n📝 ${description}` : '') +
        `\n\n💡 Откройте Mini App для управления расписанием.`
      )
    } else {
      const errorText = await response.text()
      console.error('Failed to add slot:', errorText)
      await ctx.reply('❌ Не удалось добавить. Попробуйте через Mini App.')
    }
  } catch (error) {
    console.error('Add slot error:', error)
    await ctx.reply('❌ Ошибка при добавлении. Попробуйте позже.')
  }
})

// Handle new chat members
bot.on(message('new_chat_members'), async (ctx) => {
  const newMembers = ctx.message?.new_chat_members || []
  const botInfo = ctx.botInfo

  for (const member of newMembers) {
    if (member.id === botInfo?.id) {
      await ctx.reply(
        '👋 Привет! Я TimeAgreeBot.\n\n' +
        'Помогу найти общее свободное время для всех участников группы.\n\n' +
        'Используйте /initgroup для начала работы.'
      )
    }
  }
})

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err)
  ctx.reply('❌ Произошла ошибка. Попробуйте позже.').catch(() => {})
})

// Start bot with polling
const PORT = 3001
console.log(`🤖 Starting TimeAgreeBot on port ${PORT}...`)

// Launch bot with better error handling
bot.launch()
  .then(() => {
    console.log('✅ Bot started successfully with polling')
    console.log('📌 Commands available:')
    console.log('   /start - Start the bot')
    console.log('   /help - Show help')
    console.log('   /initgroup - Initialize group')
    console.log('   /find [days] - Find free time')
    console.log('   /add [date] [time] - Add busy slot')
  })
  .catch((err) => {
    // Ignore redaction errors - they don't affect bot operation
    if (err.message && err.message.includes('redact')) {
      console.log('✅ Bot started (ignoring redaction warning)')
      return
    }
    console.error('❌ Failed to start bot:', err)
    process.exit(1)
  })

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('Received SIGINT, stopping bot...')
  bot.stop('SIGINT')
})

process.once('SIGTERM', () => {
  console.log('Received SIGTERM, stopping bot...')
  bot.stop('SIGTERM')
})
