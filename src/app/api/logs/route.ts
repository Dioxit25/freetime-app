import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const chatId = searchParams.get('chatId')

    const where = chatId ? { telegramChatId: BigInt(chatId) } : {}

    const logs = await db.webhookLog.findMany({
      where,
      orderBy: { processedAt: 'desc' },
      take: limit,
    })

    const formattedLogs = logs.map(log => ({
      id: log.id,
      updateId: log.updateId?.toString(),
      eventType: log.eventType,
      telegramUserId: log.telegramUserId?.toString(),
      telegramChatId: log.telegramChatId?.toString(),
      payload: log.payload,
      response: log.response,
      error: log.error,
      processedAt: log.processedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      count: formattedLogs.length,
      logs: formattedLogs,
    })
  } catch (error: any) {
    console.error('Logs API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
