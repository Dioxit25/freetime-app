import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper function to save webhook log
async function saveWebhookLog(data: {
  updateId?: bigint
  eventType?: string
  telegramUserId?: bigint
  telegramChatId?: bigint
  payload: string
  response?: string
  error?: string
}) {
  try {
    await db.webhookLog.create({
      data,
    })
  } catch (logError: any) {
    console.error('Failed to save webhook log:', logError.message)
  }
}

// Helper function to get or create user
async function getOrCreateUser(telegramUser: any): Promise<any> {
  const user = await db.user.upsert({
    where: { telegramId: BigInt(telegramUser.id) },
    update: {
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      photoUrl: telegramUser.photo_url,
      languageCode: telegramUser.language_code,
    },
    create: {
      telegramId: BigInt(telegramUser.id),
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      photoUrl: telegramUser.photo_url,
      languageCode: telegramUser.language_code,
      timezone: 'Europe/Moscow',
    },
  })
  return user
}

// Helper function to create or update group using raw SQL only
async function createOrUpdateGroup(chat: any, addedByUserId: string): Promise<any> {
  // Upsert group using raw SQL
  await db.$executeRaw`
    INSERT INTO "Group" ("id", "telegramChatId", "telegramTitle", "telegramPhotoUrl", "tier", "memberCount", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${BigInt(chat.id)}, ${chat.title || 'Группа'}, ${chat.photo_url || null}, 'FREE', 1, NOW(), NOW())
    ON CONFLICT ("telegramChatId")
    DO UPDATE SET
      "telegramTitle" = ${chat.title || 'Группа'},
      "telegramPhotoUrl" = ${chat.photo_url || null},
      "memberCount" = 1,
      "updatedAt" = NOW()
  `

  // Get the group ID
  const groups = await db.$queryRaw`
    SELECT "id", "telegramChatId" FROM "Group" WHERE "telegramChatId" = ${BigInt(chat.id)} LIMIT 1
  ` as any[]

  const groupId = groups[0]?.id

  if (!groupId) {
    throw new Error('Failed to get group ID')
  }

  // Add user as member using raw SQL
  await db.$executeRaw`
    INSERT INTO "GroupMember" ("id", "userId", "groupId", "joinedAt")
    VALUES (gen_random_uuid()::text, ${addedByUserId}, ${groupId}, NOW())
    ON CONFLICT ("userId", "groupId")
    DO NOTHING
  `

  // Return the group
  const result = await db.$queryRaw`
    SELECT * FROM "Group" WHERE "telegramChatId" = ${BigInt(chat.id)} LIMIT 1
  ` as any[]

  // Serialize BigInt to string
  const serialized = JSON.stringify(result[0], (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )

  return JSON.parse(serialized)
}

// POST /api/webhook - Telegram webhook with full logging
export async function POST(request: NextRequest) {
  let responseData: any = { ok: true }
  let errorText: string | undefined = undefined

  try {
    const body = await request.json()
    const payloadStr = JSON.stringify(body)

    console.log('=== WEBHOOK RECEIVED v2 ===')
    console.log('Update ID:', body.update_id)
    console.log('Has message:', !!body.message)
    console.log('Has callback_query:', !!body.callback_query)
    console.log('Has my_chat_member:', !!body.my_chat_member)

    // Determine event type and extract IDs
    let eventType: string | undefined = undefined
    let telegramUserId: bigint | undefined = undefined
    let telegramChatId: bigint | undefined = undefined

    if (body.message) {
      eventType = 'message'
      telegramUserId = body.message.from?.id
      telegramChatId = body.message.chat?.id
    } else if (body.callback_query) {
      eventType = 'callback_query'
      telegramUserId = body.callback_query.from?.id
      telegramChatId = body.callback_query.message?.chat?.id
    } else if (body.my_chat_member) {
      eventType = 'my_chat_member'
      telegramUserId = body.my_chat_member.from?.id
      telegramChatId = body.my_chat_member.chat?.id
    } else if (body.new_chat_members) {
      eventType = 'new_chat_members'
      telegramUserId = body.message?.from?.id
      telegramChatId = body.message?.chat?.id
    } else if (body.left_chat_member) {
      eventType = 'left_chat_member'
      telegramUserId = body.message?.from?.id
      telegramChatId = body.message?.chat?.id
    }

    console.log('Event Type:', eventType)
    console.log('User ID:', telegramUserId?.toString())
    console.log('Chat ID:', telegramChatId?.toString())
    console.log('Is group chat:', body.message?.chat?.type === 'group' || body.message?.chat?.type === 'supergroup')

    const WEB_APP_URL = process.env.WEB_APP_URL || 'https://freetime-app-jy3k.vercel.app'

    // Handle my_chat_member event (bot added/removed from group)
    if (body.my_chat_member) {
      const myChatMember = body.my_chat_member
      const chat = myChatMember.chat
      const from = myChatMember.from
      const oldStatus = myChatMember.old_chat_member.status
      const newStatus = myChatMember.new_chat_member.status

      console.log('my_chat_member event:', { chatId: chat.id, oldStatus, newStatus })

      // Bot was added to a group
      if (oldStatus === 'left' && (newStatus === 'member' || newStatus === 'administrator')) {
        console.log('🎉 Bot was added to group:', chat.title || chat.id)

        // Get or create the user who added the bot
        const user = await getOrCreateUser(from)

        // Create or update the group
        const group = await createOrUpdateGroup(chat, user.id)

        console.log('✅ Group created/updated:', group.id, group.telegramTitle)

        // Send welcome message to the group (without web_app button)
        await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat.id,
            text: `🎉 Бот добавлен в группу "${chat.title || 'Группа'}"!\n\n📱 Нажмите на имя бота и выберите "Открыть WebApp" или используйте приложение из личных сообщений с ботом.`,
          }),
        })

        responseData = {
          ok: true,
          action: 'bot_added_to_group',
          groupId: group.id,
        }
      }
      // Bot was removed from group
      else if (newStatus === 'left' && (oldStatus === 'member' || oldStatus === 'administrator')) {
        console.log('👋 Bot was removed from group:', chat.title || chat.id)

        // Optionally: mark group as inactive or keep it in database
        responseData = {
          ok: true,
          action: 'bot_removed_from_group',
        }
      }

      await saveWebhookLog({
        updateId: body.update_id ? BigInt(body.update_id) : undefined,
        eventType,
        telegramUserId: telegramUserId ? BigInt(telegramUserId) : undefined,
        telegramChatId: telegramChatId ? BigInt(telegramChatId) : undefined,
        payload: payloadStr,
        response: JSON.stringify(responseData),
      })

      return NextResponse.json(responseData)
    }

    // Handle messages
    if (body.message && body.message.text) {
      const text = body.message.text
      const chatId = body.message.chat.id
      const chatType = body.message.chat.type
      const from = body.message.from

      console.log('Command:', text)
      console.log('Chat type:', chatType)

      // Get or create user
      const user = await getOrCreateUser(from)

      // If in a group chat, create/update group and add user as member
      if (chatType === 'group' || chatType === 'supergroup') {
        const chat = body.message.chat
        await createOrUpdateGroup(chat, user.id)
        console.log('✅ User added to group:', chat.title || chat.id)
      }

      if (text === '/start') {
        console.log('Sending /start welcome message...')

        const isPrivate = chatType === 'private'

        const messageBody: any = {
          chat_id: chatId,
          text: isPrivate
            ? '👋 Добро пожаловать в TimeAgree!\n\n📱 Это бот для управления вашим временем и поиска общих свободных моментов с группой.\n\n🔹 Добавьте бота в группу, чтобы начать совместное планирование\n🔹 Откройте приложение, чтобы управлять своим временем'
            : `👋 Привет, ${from.first_name}!\n\n📱 Бот TimeAgree успешно работает в этой группе!\n\n💡 Чтобы начать, откройте приложение:\n• Нажмите на имя бота и выберите "Открыть WebApp"\n• Или перейдите в личные сообщения с ботом и нажмите кнопку "Открыть TimeAgree"`,
        }

        // Only add web_app button for private chats
        if (isPrivate) {
          messageBody.reply_markup = {
            inline_keyboard: [[{
              text: '🌐 Открыть TimeAgree',
              web_app: { url: WEB_APP_URL }
            }]]
          }
        }

        const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageBody),
        })

        const responseText = await response.text()
        console.log('Telegram response:', response.ok, response.status)
        console.log('Response body:', responseText)

        responseData = {
          ok: true,
          command: '/start',
          chatType,
          telegramResponse: { ok: response.ok, status: response.status, body: responseText }
        }

        await saveWebhookLog({
          updateId: body.update_id ? BigInt(body.update_id) : undefined,
          eventType,
          telegramUserId: telegramUserId ? BigInt(telegramUserId) : undefined,
          telegramChatId: telegramChatId ? BigInt(telegramChatId) : undefined,
          payload: payloadStr,
          response: JSON.stringify(responseData),
        })
      } else if (text === '/test' || text === '/setup2') {
        const isTest = text === '/test'

        console.log('Sending message to Telegram...')

        const messageBody: any = {
          chat_id: chatId,
          text: isTest ? '✅ Бот работает!' : '🎉 Кнопка для открытия приложения:',
        }

        // Only add web_app button for private chats
        if (!isTest && chatType === 'private') {
          messageBody.reply_markup = {
            inline_keyboard: [[{
              text: '🌐 Открыть TimeAgree',
              web_app: { url: WEB_APP_URL }
            }]]
          }
        } else if (!isTest) {
          messageBody.text = '🎉 Бот работает! Откройте приложение через меню бота.'
        }

        const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageBody),
        })

        const responseText = await response.text()
        console.log('Telegram response:', response.ok, response.status)
        console.log('Response body:', responseText)

        responseData = {
          ok: true,
          command: text,
          telegramResponse: { ok: response.ok, status: response.status, body: responseText }
        }

        await saveWebhookLog({
          updateId: body.update_id ? BigInt(body.update_id) : undefined,
          eventType,
          telegramUserId: telegramUserId ? BigInt(telegramUserId) : undefined,
          telegramChatId: telegramChatId ? BigInt(telegramChatId) : undefined,
          payload: payloadStr,
          response: JSON.stringify(responseData),
        })
      } else {
        console.log('Unknown command:', text)

        responseData = {
          ok: true,
          command: text,
          action: 'ignored'
        }

        await saveWebhookLog({
          updateId: body.update_id ? BigInt(body.update_id) : undefined,
          eventType,
          telegramUserId: telegramUserId ? BigInt(telegramUserId) : undefined,
          telegramChatId: telegramChatId ? BigInt(telegramChatId) : undefined,
          payload: payloadStr,
          response: JSON.stringify(responseData),
        })
      }
    } else if (body.message && (body.message.new_chat_members || body.message.left_chat_member)) {
      // Handle new/leaving members in group
      const message = body.message
      const chatId = message.chat.id
      const chat = message.chat

      if (chat.type === 'group' || chat.type === 'supergroup') {
        const from = message.from
        const user = await getOrCreateUser(from)

        // Ensure group exists
        const group = await createOrUpdateGroup(chat, user.id)

        // Handle new members joining
        if (message.new_chat_members) {
          for (const member of message.new_chat_members) {
            if (!member.is_bot) {
              const memberUser = await getOrCreateUser(member)

              // Add member to group
              await db.$executeRaw`
                INSERT INTO "GroupMember" ("id", "userId", "groupId", "joinedAt")
                VALUES (gen_random_uuid()::text, ${memberUser.id}, ${group.id}, NOW())
                ON CONFLICT ("userId", "groupId")
                DO NOTHING
              `

              console.log(`✅ Added member ${memberUser.firstName} to group ${chat.title}`)
            }
          }
        }

        // Handle member leaving
        if (message.left_chat_member && !message.left_chat_member.is_bot) {
          const leavingMember = message.left_chat_member
          const leavingUser = await getOrCreateUser(leavingMember)

          // Remove member from group
          await db.$executeRaw`
            DELETE FROM "GroupMember" WHERE "userId" = ${leavingUser.id} AND "groupId" = ${group.id}
          `

          console.log(`✅ Removed member ${leavingUser.firstName} from group ${chat.title}`)
        }

        responseData = {
          ok: true,
          action: 'member_changed',
        }
      }

      await saveWebhookLog({
        updateId: body.update_id ? BigInt(body.update_id) : undefined,
        eventType,
        telegramUserId: telegramUserId ? BigInt(telegramUserId) : undefined,
        telegramChatId: telegramChatId ? BigInt(telegramChatId) : undefined,
        payload: payloadStr,
        response: JSON.stringify(responseData),
      })
    } else {
      console.log('No text message to process')

      responseData = {
        ok: true,
        action: 'no_text_message',
        eventType
      }

      await saveWebhookLog({
        updateId: body.update_id ? BigInt(body.update_id) : undefined,
        eventType,
        telegramUserId: telegramUserId ? BigInt(telegramUserId) : undefined,
        telegramChatId: telegramChatId ? BigInt(telegramChatId) : undefined,
        payload: payloadStr,
        response: JSON.stringify(responseData),
      })
    }

    console.log('=== WEBHOOK DONE ===')

    return NextResponse.json(responseData)
  } catch (error: any) {
    errorText = error.message
    console.error('=== WEBHOOK ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    console.error('======================')

    // Save error log if we have the request body
    try {
      const body = await request.clone().json()
      await saveWebhookLog({
        updateId: body.update_id ? BigInt(body.update_id) : undefined,
        eventType: 'error',
        payload: JSON.stringify(body),
        error: errorText,
      })
    } catch (e) {
      // Can't save log without body
    }

    return NextResponse.json(
      { ok: false, error: errorText },
      { status: 500 }
    )
  }
}
