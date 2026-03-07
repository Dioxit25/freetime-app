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

// Check if URL is valid for Telegram buttons
const isValidTelegramUrl = (url: string): boolean => {
  return url.startsWith('https://') || url.includes('.')
}

// Start command
bot.start((ctx) => {
  if (ctx.chat.type === 'private') {
    if (isValidTelegramUrl(WEB_APP_URL)) {
      ctx.reply(
        '👋 Привет! Я *TimeAgree Bot* — бот для поиска общего времени.\n\n' +
        '📅 Что я умею:\n' +
        '• Создавать календари для групп\n' +
        '• Искать общее свободное время\n' +
        '• Управлять занятостью\n\n' +
        '🚀 Как начать:\n' +
        '1. Добавь меня в группу\n' +
        '2. Открой веб-приложение\n\n' +
        '⬇️ Нажми кнопку ниже для открытия приложения:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🌐 Открыть TimeAgree',
                  url: WEB_APP_URL,
                },
              ],
              [
                {
                  text: '➕ Добавить в группу',
                  url: `https://t.me/${ctx.botInfo?.username || 'bot'}?startgroup=true`,
                },
              ],
            ],
          },
        }
      )
    } else {
      ctx.reply(
        '👋 Привет! Я *TimeAgree Bot* — бот для поиска общего времени.\n\n' +
        '📅 Что я умею:\n' +
        '• Создавать календари для групп\n' +
        '• Искать общее свободное время\n' +
        '• Управлять занятостью\n\n' +
        '🚀 Как начать:\n' +
        '1. Добавь меня в группу\n' +
        '2. Открой веб-приложение\n\n' +
        '⬇️ Добавьте меня в группу:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '➕ Добавить в группу',
                  url: `https://t.me/${ctx.botInfo?.username || 'bot'}?startgroup=true`,
                },
              ],
            ],
          },
        }
      )
    }
  }
})

// Help command
bot.help((ctx) => {
  ctx.reply(
    '📖 *Справка TimeAgree*\n\n' +
    'Команды:\n' +
    '/start - Начать работу\n' +
    '/help - Эта справка\n\n' +
    'В группах:\n' +
    'Добавьте бота в группу, чтобы создать календарь.',
    { parse_mode: 'Markdown' }
  )
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
            telegramChatId: chatId,
            telegramTitle: chatTitle,
            telegramPhotoUrl: ctx.chat.photo?.small_file_id || null,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('Group created:', data.group.id)

          if (isValidTelegramUrl(WEB_APP_URL)) {
            ctx.reply(
              `🎉 Группа "${chatTitle}" успешно создана!\n\n` +
              '📱 Теперь участники могут открыть приложение и начать добавлять своё занятое время.\n\n' +
              '⬇️ Нажмите кнопку ниже:',
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: '🌐 Открыть TimeAgree',
                        url: `${WEB_APP_URL}?groupId=${data.group.id}`,
                      },
                    ],
                  ],
                },
              }
            )
          } else {
            ctx.reply(
              `🎉 Группа "${chatTitle}" успешно создана!\n\n` +
              '📱 Теперь участники могут открыть приложение.\n\n' +
              '⚠️ Веб-приложение находится на локальном сервере.\n' +
              'Для доступа через Telegram нужен публичный URL.'
            )
          }
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
        telegramChatId: chatId,
        telegramTitle: newTitle,
      }),
    })

    console.log(`Group ${chatId} renamed to: ${newTitle}`)
  } catch (error) {
    console.error('Error updating group title:', error)
  }
})

// Find command for groups
bot.command('find', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('Эта команда работает только в группах.')
  }

  const chatId = ctx.chat.id

  ctx.reply('🔍 Ищем общее свободное время...')

  try {
    const response = await fetch(`${WEB_APP_URL}/api/find-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramChatId: chatId,
      }),
    })

    if (response.ok) {
      const data = await response.json()

      if (data.slots.length === 0) {
        ctx.reply(
          '😔 Общего свободного времени не найдено.\n\n' +
          'Попробуйте добавить больше свободного времени или расширить период поиска.'
        )
      } else {
        const message =
          '✨ *Найдено общее время:*\n\n' +
          data.slots
            .slice(0, 5)
            .map((slot: any) => {
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
              return `📅 ${dateStr}\n⏰ ${timeStr}`
            })
            .join('\n\n')

        if (isValidTelegramUrl(WEB_APP_URL)) {
          ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🌐 Открыть календарь',
                    url: WEB_APP_URL,
                  },
                ],
              ],
            },
          })
        } else {
          ctx.reply(message, { parse_mode: 'Markdown' })
        }
      }
    } else {
      ctx.reply('❌ Не удалось найти время. Попробуйте позже.')
    }
  } catch (error) {
    console.error('Error finding time:', error)
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.')
  }
})

// Webhook support
if (process.env.WEBHOOK_URL) {
  bot.telegram.setWebhook(process.env.WEBHOOK_URL)
}

// Start bot
bot.launch().then(() => {
  console.log(`🤖 Telegram bot started on port ${PORT}`)
  console.log(`📱 Web App URL: ${WEB_APP_URL}`)
  console.log(`🔗 Bot username: @TimeAgreeBot`)
})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
