import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper function to get or create user
async function getOrCreateUser(telegramUser: any): Promise<any> {
  const telegramId = String(telegramUser.id)
  
  // Try to find existing user
  let user = await db.user.findUnique({
    where: { telegramId }
  })
  
  if (!user) {
    // Try with BigInt for PostgreSQL
    try {
      user = await db.user.findUnique({
        where: { telegramId: BigInt(telegramUser.id) as any }
      })
    } catch (e) {
      // Ignore, will create new user
    }
  }
  
  if (!user) {
    // Create new user
    user = await db.user.create({
      data: {
        telegramId,
        firstName: telegramUser.first_name || 'User',
        lastName: telegramUser.last_name || '',
        username: telegramUser.username || '',
        photoUrl: telegramUser.photo_url || null,
        languageCode: telegramUser.language_code || 'en',
        isBot: telegramUser.is_bot || false,
        timezone: 'UTC',
      }
    })
  } else {
    // Update user info
    user = await db.user.update({
      where: { id: user.id },
      data: {
        firstName: telegramUser.first_name || user.firstName,
        lastName: telegramUser.last_name || user.lastName,
        username: telegramUser.username || user.username,
      }
    })
  }
  
  return user
}

// Helper function to get or create group
async function getOrCreateGroup(telegramChatId: string, telegramTitle: string, userId: string): Promise<any> {
  const chatId = String(telegramChatId)
  
  // Try to find existing group
  let group = await db.group.findUnique({
    where: { telegramChatId: chatId }
  })
  
  if (!group) {
    // Try with BigInt for PostgreSQL
    try {
      group = await db.group.findUnique({
        where: { telegramChatId: BigInt(telegramChatId) as any }
      })
    } catch (e) {
      // Ignore, will create new group
    }
  }
  
  if (!group) {
    // Create new group
    group = await db.group.create({
      data: {
        telegramChatId: chatId,
        telegramTitle: telegramTitle || 'Group',
        tier: 'FREE',
        memberCount: 1,
      }
    })
    
    // Add user as member
    await db.groupMember.create({
      data: {
        userId,
        groupId: group.id,
      }
    })
  } else {
    // Check if user is already a member
    const existingMember = await db.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId: group.id
        }
      }
    })
    
    if (!existingMember) {
      // Add user as member
      await db.groupMember.create({
        data: {
          userId,
          groupId: group.id,
        }
      })
      
      // Update member count
      await db.group.update({
        where: { id: group.id },
        data: { memberCount: { increment: 1 } }
      })
    }
  }
  
  return group
}

// POST /api/webhook - Telegram webhook handler
export async function POST(request: NextRequest) {
  const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  const WEB_APP_URL = process.env.WEB_APP_URL || 'https://freetime-app-jy3k.vercel.app'
  
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN not configured')
    return NextResponse.json({ error: 'BOT_TOKEN not configured' }, { status: 500 })
  }
  
  try {
    const body = await request.json()
    console.log('=== WEBHOOK RECEIVED ===')
    console.log('Update ID:', body.update_id)
    
    // Handle my_chat_member event (bot added/removed from group)
    if (body.my_chat_member) {
      const myChatMember = body.my_chat_member
      const chat = myChatMember.chat
      const from = myChatMember.from
      const oldStatus = myChatMember.old_chat_member?.status
      const newStatus = myChatMember.new_chat_member?.status
      
      console.log('my_chat_member event:', { chatId: chat.id, oldStatus, newStatus })
      
      // Bot was added to a group
      if (oldStatus === 'left' && (newStatus === 'member' || newStatus === 'administrator')) {
        console.log('🎉 Bot was added to group:', chat.title || chat.id)
        
        // Get or create user
        const user = await getOrCreateUser(from)
        
        // Get or create group
        const group = await getOrCreateGroup(String(chat.id), chat.title || 'Group', user.id)
        
        console.log('✅ Group created/updated:', group.id, group.telegramTitle)
        
        // Send welcome message
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat.id,
            text: `🎉 Бот добавлен в группу "${chat.title || 'Группа'}"!\n\n📱 Нажмите на имя бота и выберите "Открыть WebApp" или используйте команды:\n• /initgroup - инициализировать группу\n• /find - найти общее время\n• /add - добавить занятое время`,
          }),
        })
        
        return NextResponse.json({ ok: true, action: 'bot_added_to_group' })
      }
      
      return NextResponse.json({ ok: true, action: 'my_chat_member_ignored' })
    }
    
    // Handle messages
    if (body.message && body.message.text) {
      const text = body.message.text
      const chatId = body.message.chat.id
      const chatType = body.message.chat.type
      const from = body.message.from
      
      // Normalize command (remove @BotName suffix)
      const normalizeCommand = (cmd: string) => {
        const atIndex = cmd.indexOf('@')
        return atIndex > 0 ? cmd.substring(0, atIndex) : cmd
      }
      
      const command = normalizeCommand(text.split(' ')[0])
      
      console.log('Command:', text, '-> Normalized:', command)
      console.log('Chat type:', chatType)
      
      // Get or create user
      const user = await getOrCreateUser(from)
      
      // If in a group, create/update group and add user as member
      let group = null
      if (chatType === 'group' || chatType === 'supergroup') {
        group = await getOrCreateGroup(String(chatId), body.message.chat.title || 'Group', user.id)
      }
      
      // Handle /start command
      if (command === '/start') {
        const isPrivate = chatType === 'private'
        const messageBody: any = {
          chat_id: chatId,
          text: isPrivate
            ? '👋 Добро пожаловать в TimeAgree!\n\n📱 Это бот для управления временем и поиска общих свободных моментов.\n\n🔹 Добавьте бота в группу\n🔹 Используйте /help для списка команд'
            : `👋 Привет, ${from.first_name}!\n\n📱 Бот TimeAgree работает в этой группе!\n\n💡 Команды:\n• /initgroup - инициализировать\n• /find - найти общее время\n• /add - добавить занятость`,
        }
        
        if (isPrivate) {
          messageBody.reply_markup = {
            inline_keyboard: [[{
              text: '🌐 Открыть TimeAgree',
              web_app: { url: WEB_APP_URL }
            }]]
          }
        }
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageBody),
        })
        
        return NextResponse.json({ ok: true, command: '/start' })
      }
      
      // Handle /help command
      if (command === '/help') {
        const helpText = `📖 *Справка TimeAgree*

Команды:
/start - Начать работу
/help - Эта справка

🏢 В группах:
/initgroup - Инициализировать группу
/find [дней] - Найти общее время (1-30)
/add YYYY-MM-DD HH:MM HH:MM описание

💡 Откройте WebApp через меню бота.`
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: helpText,
            parse_mode: 'Markdown',
          }),
        })
        
        return NextResponse.json({ ok: true, command: '/help' })
      }
      
      // Handle /initgroup command
      if (command === '/initgroup') {
        if (chatType === 'private') {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '❌ Эта команда работает только в группах.',
            }),
          })
        } else {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ Группа "${body.message.chat.title}" инициализирована!\n\n📱 Теперь участники могут:\n• /find - найти общее время\n• /add - добавить занятость\n\n💡 Откройте WebApp через меню бота.`,
            }),
          })
        }
        
        return NextResponse.json({ ok: true, command: '/initgroup' })
      }
      
      // Handle /find command
      if (command === '/find' || text.startsWith('/find ')) {
        if (chatType === 'private') {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '❌ Эта команда работает только в группах.',
            }),
          })
          return NextResponse.json({ ok: true, command: '/find', error: 'private_chat' })
        }
        
        const args = text.split(' ').slice(1)
        const daysToLookAhead = args[0] ? parseInt(args[0]) : 7
        
        if (isNaN(daysToLookAhead) || daysToLookAhead < 1 || daysToLookAhead > 30) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '❌ Укажите количество дней от 1 до 30.\nПример: /find 14',
            }),
          })
          return NextResponse.json({ ok: true, command: '/find', error: 'invalid_days' })
        }
        
        // Send searching message
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🔍 Ищем общее свободное время на ${daysToLookAhead} дней...`,
          }),
        })
        
        // Call find-time API
        try {
          const findResponse = await fetch(`${WEB_APP_URL}/api/find-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              groupId: group?.id,
              daysToLookAhead,
              minDuration: 30,
            }),
          })
          
          if (findResponse.ok) {
            const data = await findResponse.json()
            
            if (!data.slots || data.slots.length === 0) {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `😔 Общего свободного времени на ${daysToLookAhead} дней не найдено.\n\n💡 Попробуйте:\n• Увеличить период поиска\n• Добавить участников`,
                }),
              })
            } else {
              let message = `✨ *Найдено ${data.count || data.slots.length} слотов:*\n\n`
              
              message += data.slots.slice(0, 5).map((slot: any) => {
                const start = new Date(slot.start)
                const end = new Date(slot.end)
                const dateStr = start.toLocaleDateString('ru-RU', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })
                const timeStr = `${start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — ${end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
                return `📅 ${dateStr}\n⏰ ${timeStr}`
              }).join('\n\n')
              
              if (data.slots.length > 5) {
                message += `\n\n...и ещё ${data.slots.length - 5}`
              }
              
              message += '\n\n💡 Для подробностей откройте WebApp.'
              
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: message,
                  parse_mode: 'Markdown',
                }),
              })
            }
          } else {
            const errorText = await findResponse.text()
            console.error('Find time API error:', findResponse.status, errorText)
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: '❌ Ошибка при поиске времени. Попробуйте позже.',
              }),
            })
          }
        } catch (findError) {
          console.error('Find time error:', findError)
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '❌ Произошла ошибка при поиске.',
            }),
          })
        }
        
        return NextResponse.json({ ok: true, command: '/find' })
      }
      
      // Handle /add command
      if (command === '/add' || text.startsWith('/add ')) {
        if (chatType === 'private') {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '❌ Эта команда работает только в группах.',
            }),
          })
          return NextResponse.json({ ok: true, command: '/add', error: 'private_chat' })
        }
        
        const args = text.split(' ').slice(1)
        
        if (args.length < 4) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `📝 *Добавление занятости*\n\nФормат:\n/add YYYY-MM-DD HH:MM HH:MM описание\n\nПример:\n/add 2025-03-10 09:00 18:00 Работа`,
              parse_mode: 'Markdown',
            }),
          })
          return NextResponse.json({ ok: true, command: '/add', hint: true })
        }
        
        const datePart = args[0]
        const startTime = args[1]
        const endTime = args[2]
        const description = args.slice(3).join(' ')
        
        // Validate format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        const timeRegex = /^\d{2}:\d{2}$/
        
        if (!dateRegex.test(datePart) || !timeRegex.test(startTime) || !timeRegex.test(endTime)) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '❌ Неверный формат.\n\n📅 Дата: ГГГГ-ММ-ДД\n⏰ Время: ЧЧ:ММ',
            }),
          })
          return NextResponse.json({ ok: true, command: '/add', error: 'invalid_format' })
        }
        
        const startDateTime = new Date(`${datePart}T${startTime}:00`)
        const endDateTime = new Date(`${datePart}T${endTime}:00`)
        
        if (startDateTime >= endDateTime) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '❌ Время начала должно быть раньше времени окончания.',
            }),
          })
          return NextResponse.json({ ok: true, command: '/add', error: 'invalid_time' })
        }
        
        // Create slot
        try {
          await db.slot.create({
            data: {
              userId: user.id,
              type: 'ONE_TIME',
              description: description || 'Занятое время',
              startAt: startDateTime,
              endAt: endDateTime,
              startTimeLocal: startTime,
              endTimeLocal: endTime,
            }
          })
          
          const dateStr = startDateTime.toLocaleDateString('ru-RU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `✅ *Добавлено!*\n\n📅 ${dateStr}\n⏰ ${startTime} — ${endTime}\n📝 ${description || 'Занятое время'}`,
              parse_mode: 'Markdown',
            }),
          })
        } catch (slotError) {
          console.error('Error creating slot:', slotError)
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '❌ Не удалось добавить. Попробуйте позже.',
            }),
          })
        }
        
        return NextResponse.json({ ok: true, command: '/add' })
      }
      
      // Unknown command
      console.log('Unknown command:', command)
      return NextResponse.json({ ok: true, action: 'unknown_command', command })
    }
    
    // No text message
    return NextResponse.json({ ok: true, action: 'no_text' })
    
  } catch (error: any) {
    console.error('=== WEBHOOK ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    ok: true, 
    message: 'TimeAgree Telegram Webhook',
    timestamp: new Date().toISOString()
  })
}
