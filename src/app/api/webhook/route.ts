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

// POST /api/webhook - Telegram webhook with full logging
export async function POST(request: NextRequest) {
  let responseData: any = { ok: true }
  let errorText: string | undefined = undefined

  try {
    const body = await request.json()
    const payloadStr = JSON.stringify(body)

    console.log('=== WEBHOOK RECEIVED ===')
    console.log('Update ID:', body.update_id)
    console.log('Has message:', !!body.message)
    console.log('Has callback_query:', !!body.callback_query)

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
    }

    console.log('Event Type:', eventType)
    console.log('User ID:', telegramUserId?.toString())
    console.log('Chat ID:', telegramChatId?.toString())

    // Handle messages
    if (body.message && body.message.text) {
      const text = body.message.text
      const chatId = body.message.chat.id

      console.log('Command:', text)
      console.log('Processing command...')

      const WEB_APP_URL = process.env.WEB_APP_URL || 'https://freetime-app-jy3k.vercel.app'

      if (text === '/test' || text === '/setup2') {
        const isTest = text === '/test'

        console.log('Sending message to Telegram...')

        const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: isTest ? '✅ Бот работает!' : '🎉 Кнопка для открытия приложения:',
            reply_markup: isTest ? undefined : {
              inline_keyboard: [[{
                text: '🌐 Открыть TimeAgree',
                web_app: { url: WEB_APP_URL }
              }]]
            }
          }),
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
