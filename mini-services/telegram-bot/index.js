import { Telegraf } from 'telegraf'

// Configuration
const BOT_TOKEN = process.env.BOT_TOKEN
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3000'
const PORT = 3001

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)

// Clear webhook and pending updates to prevent 409 conflict error
async function clearWebhookAndUpdates() {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`
    )
    const data = await response.json()
    console.log('Cleared webhook and pending updates:', data)
  } catch (error) {
    console.error('Error clearing webhook:', error)
  }
}

// Check if URL is valid for Telegram buttons
const isValidTelegramUrl = (url) => {
  return url.startsWith('https://') || url.includes('.')
}

// Start command
bot.start((ctx) => {
  if (ctx.chat.type === 'private') {
    ctx.reply(
      '👋 Привет! Я *TimeAgree Bot* — бот для поиска общего времени.\n\n' +
      '📅 Что я умею:\n' +
      '• Создавать календари для групп\n' +
      '• Искать общее свободное время\n' +
      '• Управлять занятостью\n\n' +
      '🚀 Как начать:\n' +
      '1. Добавь меня в группу\n' +
      '2. Открой мини-приложение\n\n' +
      '📱 Как открыть приложение:\n' +
      '• В группе: Нажми на имя бота → "Открыть WebApp"\n' +
      '• Или в личном чате: Меню бота → "Открыть WebApp"',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '➕ Добавить в группу',
                url: `https://t.me/${ctx.botInfo?.username || 'TimeAgreeBot'}?startgroup=true`,
              },
            ],
          ],
        },
      }
    )
  }
})

// Help command
bot.help((ctx) => {
  ctx.reply(
    '📖 *Справка TimeAgree*\n\n' +
    '📌 Основные команды:\n' +
    '/start - Начать работу с ботом\n' +
    '/help - Эта справка\n\n' +
    '🏢 В группах:\n' +
    '/initgroup - Инициализировать группу для работы бота\n' +
    '/find - Найти общее свободное время\n' +
    '/find [дней] - Найти время на указанное количество дней\n' +
    '/add - Добавить занятое время через бота\n' +
    '/add [дата] [время-начала] [время-конца] [описание] - Быстрое добавление\n\n' +
    '💡 Совет: Для удобного управления откройте мини-приложение!',
    { parse_mode: 'Markdown' }
  )
})

// Initialize group command
bot.command('initgroup', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('Эта команда работает только в группах.')
  }

  const chatId = ctx.chat.id
  const chatTitle = ctx.chat.title || 'Группа'

  ctx.reply('⏳ Инициализация группы...')

  try {
    const response = await fetch(`${WEB_APP_URL}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramChatId: String(chatId),
        telegramTitle: chatTitle,
        telegramPhotoUrl: null,
      }),
    })

    if (response.ok) {
      const data = await response.json()

      ctx.reply(
        `✅ Группа "${chatTitle}" успешно инициализирована!\n\n` +
        `🆔 ID группы: ${data.group.id}\n\n` +
        '📱 Теперь участники могут:\n' +
        '• Добавлять занятое время через бота (/add)\n' +
        '• Искать общее свободное время (/find)\n' +
        '• Использовать мини-приложение для полного управления\n\n' +
        '📱 Как открыть приложение:\n' +
        'Нажмите на имя бота в этой группе → "Открыть WebApp"',
        {
          parse_mode: 'Markdown',
        }
      )
    } else if (response.status === 409) {
      ctx.reply('ℹ️ Группа уже инициализирована. Используйте /find и /add для работы с ботом.')
    } else {
      const errorText = await response.text()
      console.error('Group init error:', errorText)
      ctx.reply('❌ Не удалось инициализировать группу. Попробуйте позже.')
    }
  } catch (error) {
    console.error('Error initializing group:', error)
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.')
  }
})

// Find command with optional days parameter
bot.command('find', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('Эта команда работает только в группах.')
  }

  const chatId = ctx.chat.id
  const args = ctx.message.text.split(' ').slice(1)
  const daysToLookAhead = args[0] ? parseInt(args[0]) : 7

  if (isNaN(daysToLookAhead) || daysToLookAhead < 1 || daysToLookAhead > 30) {
    return ctx.reply('❌ Укажите корректное количество дней (1-30).\nПример: /find 14')
  }

  ctx.reply(`🔍 Ищем общее свободное время на ближайшие ${daysToLookAhead} дней...`)

  try {
    // First, check if group exists
    const groupResponse = await fetch(`${WEB_APP_URL}/api/groups/by-telegram/${chatId}`)
    
    if (!groupResponse.ok) {
      return ctx.reply('❌ Группа не инициализирована. Используйте /initgroup для инициализации.')
    }

    const groupData = await groupResponse.json()
    const groupId = groupData.group?.id

    if (!groupId) {
      return ctx.reply('❌ Группа не найдена. Используйте /initgroup для инициализации.')
    }

    // Find common time
    const response = await fetch(`${WEB_APP_URL}/api/find-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: groupId,
        daysToLookAhead,
        minDuration: 30,
      }),
    })

    if (response.ok) {
      const data = await response.json()

      if (data.slots && data.slots.length === 0) {
        ctx.reply(
          `😔 Общего свободного времени на ближайшие ${daysToLookAhead} дней не найдено.\n\n` +
          '💡 Попробуйте:\n' +
          '• Увеличить период поиска (/find 14)\n' +
          '• Уменьшить минимальную длительность\n' +
          '• Добавить больше участников'
        )
      } else if (data.slots) {
        let message =
          `✨ *Найдено ${data.count || data.slots.length} слотов свободного времени на ${daysToLookAhead} дней:*\n\n` +
          data.slots
            .slice(0, 5)
            .map((slot) => {
              const start = new Date(slot.start)
              const end = new Date(slot.end)
              const dateStr = start.toLocaleDateString('ru-RU', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })
              const timeStr = `${start.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })} — ${end.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
              const participants = slot.participants?.length || 0
              const duration = Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000)
              return `📅 ${dateStr}\n⏰ ${timeStr}\n👥 ${participants} участников\n⌛ ${duration} мин`
            })
            .join('\n\n---\n\n')

        if (data.slots.length > 5) {
          message += `\n\n...и ещё ${data.slots.length - 5} слотов`
        }

        message += '\n\n💡 Для подробностей и управления используйте мини-приложение.\n\n' +
                   '📱 Как открыть приложение: Нажмите на имя бота → "Открыть WebApp"'

        ctx.reply(message, { parse_mode: 'Markdown' })
      } else {
        ctx.reply('❌ Неверный формат ответа от сервера.')
      }
    } else {
      const errorText = await response.text()
      console.error('Find time API error:', response.status, errorText)
      ctx.reply('❌ Не удалось найти время. Попробуйте позже.')
    }
  } catch (error) {
    console.error('Error finding time:', error)
    ctx.reply('❌ Произошла ошибка при поиске. Попробуйте позже.')
  }
})

// Add slot command - opens interactive dialog
bot.command('add', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('Эта команда работает только в группах.')
  }

  const chatId = ctx.chat.id

  // Try to get user ID from the message
  const userId = ctx.from?.id?.toString()

  if (!userId) {
    return ctx.reply('❌ Не удалось определить пользователя. Пожалуйста, используйте мини-приложение.')
  }

  // Check if group exists
  try {
    const groupResponse = await fetch(`${WEB_APP_URL}/api/groups/by-telegram/${chatId}`)
    
    if (!groupResponse.ok) {
      return ctx.reply('❌ Группа не инициализирована. Используйте /initgroup для инициализации.')
    }

    ctx.reply(
      '📝 *Добавление занятого времени*\n\n' +
      '📌 Формат команды:\n' +
      '/add [дата] [начало] [конец] [описание]\n\n' +
      '💡 Примеры:\n' +
      '/add 2025-03-10 09:00 18:00 Работа\n' +
      '/add 2025-03-11 14:00 16:00 Встреча с командой\n\n' +
      '📅 Формат даты: ГГГГ-ММ-ДД\n' +
      '⏰ Формат времени: ЧЧ:ММ\n\n' +
      '💡 Или используйте мини-приложение для удобного управления.',
      { parse_mode: 'Markdown' }
    )
  } catch (error) {
    console.error('Error checking group:', error)
    ctx.reply('❌ Не удалось проверить группу. Попробуйте позже.')
  }
})

// Quick add command with parameters
bot.on('text', async (ctx) => {
  if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return
  if (!ctx.message.text?.startsWith('/add ')) return

  const chatId = ctx.chat.id
  const userId = ctx.from?.id?.toString()
  const parts = ctx.message.text.split(' ').slice(1)

  if (parts.length < 4) {
    // The /add command without parameters is handled by bot.command('add')
    return
  }

  // Format: /add YYYY-MM-DD HH:MM HH:MM description
  const datePart = parts[0]
  const startTime = parts[1]
  const endTime = parts[2]
  const description = parts.slice(3).join(' ')

  // Validate date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const timeRegex = /^\d{2}:\d{2}$/

  if (!dateRegex.test(datePart)) {
    return ctx.reply('❌ Неверный формат даты. Используйте ГГГГ-ММ-ДД')
  }

  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return ctx.reply('❌ Неверный формат времени. Используйте ЧЧ:ММ')
  }

  // Validate time values
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  if (startHour > 23 || startMin > 59 || endHour > 23 || endMin > 59) {
    return ctx.reply('❌ Неверное время. Часы: 0-23, Минуты: 0-59')
  }

  const startDateTime = new Date(`${datePart}T${startTime}:00`)
  const endDateTime = new Date(`${datePart}T${endTime}:00`)

  if (startDateTime >= endDateTime) {
    return ctx.reply('❌ Время начала должно быть меньше времени окончания.')
  }

  try {
    // Get group
    const groupResponse = await fetch(`${WEB_APP_URL}/api/groups/by-telegram/${chatId}`)
    
    if (!groupResponse.ok) {
      return ctx.reply('❌ Группа не инициализирована. Используйте /initgroup для инициализации.')
    }

    // Check if user exists or create
    const userResponse = await fetch(`${WEB_APP_URL}/api/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: userId,
        firstName: ctx.from.first_name || 'Пользователь',
        lastName: ctx.from.last_name || '',
        username: ctx.from.username || '',
        photoUrl: null,
        languageCode: 'ru',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        chatId: chatId,
      }),
    })

    if (!userResponse.ok) {
      return ctx.reply('❌ Не удалось создать пользователя.')
    }

    const userData = await userResponse.json()

    // Create slot (без groupId - слоты привязаны только к пользователю)
    const slotResponse = await fetch(`${WEB_APP_URL}/api/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userData.user.id,
        type: 'ONE_TIME',
        description: description || 'Занятое время',
        startAt: startDateTime.toISOString(),
        endAt: endDateTime.toISOString(),
        startTimeLocal: startTime,
        endTimeLocal: endTime,
      }),
    })

    if (slotResponse.ok) {
      const dateStr = startDateTime.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      
      ctx.reply(
        `✅ *Время успешно добавлено!*\n\n` +
        `📅 ${dateStr}\n` +
        `⏰ ${startTime} — ${endTime}\n` +
        `📝 ${description}\n\n` +
        '💡 Для управления используйте мини-приложение.',
        { parse_mode: 'Markdown' }
      )
    } else {
      ctx.reply('❌ Не удалось добавить время. Попробуйте позже.')
    }
  } catch (error) {
    console.error('Error adding slot:', error)
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.')
  }
})

// Handle when bot is added to a group
bot.on('new_chat_members', async (ctx) => {
  if (ctx.message && 'new_chat_members' in ctx.message) {
    const newMembers = ctx.message.new_chat_members
    const botMember = newMembers.find((member) => member.is_bot)

    if (botMember && botMember.id === ctx.botInfo?.id) {
      // Bot was added to a group
      const chatId = ctx.chat.id
      const chatTitle = ctx.chat.title || 'Группа'

      // Create group in database
      try {
        const response = await fetch(`${WEB_APP_URL}/api/groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramChatId: String(chatId),
            telegramTitle: chatTitle,
            telegramPhotoUrl: null,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('Group created:', data.group.id)

          // Create inline keyboard with WebApp button
          const webAppUrl = isValidTelegramUrl(WEB_APP_URL) 
            ? WEB_APP_URL 
            : `https://freetime-app-jy3k.vercel.app`

          ctx.reply(
            `🎉 Группа "${chatTitle}" успешно создана!\n\n` +
            '📱 Чтобы начать пользоваться приложением, нажмите кнопку ниже:',
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '📱 Открыть мини-приложение',
                      web_app: { url: `${webAppUrl}?startapp=${chatId}` }
                    }
                  ]
                ]
              }
            }
          )
        } else {
          ctx.reply('❌ Не удалось создать группу. Попробуйте позже.')
        }
      } catch (error) {
        console.error('Error creating group:', error)
        ctx.reply('❌ Произошла ошибка. Попробуйте позже.')
      }
    }
  }
})

// Handle group title changes
bot.on('chat_title', async (ctx) => {
  const chatId = ctx.chat.id
  const newTitle = ctx.chat.title || 'Группа'

  try {
    await fetch(`${WEB_APP_URL}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramChatId: String(chatId),
        telegramTitle: newTitle,
      }),
    })

    console.log(`Group ${chatId} renamed to: ${newTitle}`)
  } catch (error) {
    console.error('Error updating group title:', error)
  }
})

// Start bot with error handling
async function startBot() {
  console.log('Starting bot initialization...')
  
  // Clear webhook and pending updates first
  await clearWebhookAndUpdates()
  console.log('Webhook cleared.')
  
  // Wait longer to ensure cleanup is complete (Telegram may need time)
  console.log('Waiting 15 seconds for Telegram to clear state...')
  await new Promise(resolve => setTimeout(resolve, 15000))
  console.log('About to launch bot...')

  try {
    await bot.launch()
    console.log(`🤖 Telegram bot started on port ${PORT}`)
    console.log(`📱 Web App URL: ${WEB_APP_URL}`)
    console.log(`🔗 Bot username: @TimeAgreeBot`)
  } catch (error) {
    console.error('Bot launch error:', error)
    if (error.code === 409 || String(error).includes('409')) {
      console.error('⚠️ 409 Conflict error - another bot instance may be running')
      console.log('Please wait and restart manually. Exiting...')
      process.exit(1)
    } else {
      console.error('Failed to start bot:', error)
      process.exit(1)
    }
  }
}

// Enable graceful stop
process.once('SIGINT', () => {
  console.log('Stopping bot (SIGINT)...')
  bot.stop('SIGINT')
})
process.once('SIGTERM', () => {
  console.log('Stopping bot (SIGTERM)...')
  bot.stop('SIGTERM')
})

// Start the bot
console.log('=== Telegram Bot Service Starting ===')
startBot().catch(err => {
  console.error('Fatal error starting bot:', err)
  process.exit(1)
})
