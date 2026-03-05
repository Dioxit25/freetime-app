import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('=== INITIALIZING DATABASE ===')

    // Try to create the WebhookLog table using raw SQL
    try {
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS "WebhookLog" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "updateId" BIGINT,
          "eventType" TEXT,
          "telegramUserId" BIGINT,
          "telegramChatId" BIGINT,
          "payload" TEXT NOT NULL,
          "response" TEXT,
          "error" TEXT,
          "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `
      console.log('✅ WebhookLog table created or already exists')
    } catch (tableError: any) {
      console.error('Failed to create WebhookLog table:', tableError.message)
      throw new Error(`Failed to create table: ${tableError.message}`)
    }

    // Create indexes separately
    try {
      await db.$executeRaw`
        CREATE INDEX IF NOT EXISTS "WebhookLog_telegramChatId_idx" ON "WebhookLog"("telegramChatId")
      `
      console.log('✅ Index telegramChatId created')
    } catch (e) {
      console.log('ℹ️ Index telegramChatId might already exist or failed')
    }

    try {
      await db.$executeRaw`
        CREATE INDEX IF NOT EXISTS "WebhookLog_eventType_idx" ON "WebhookLog"("eventType")
      `
      console.log('✅ Index eventType created')
    } catch (e) {
      console.log('ℹ️ Index eventType might already exist or failed')
    }

    try {
      await db.$executeRaw`
        CREATE INDEX IF NOT EXISTS "WebhookLog_processedAt_idx" ON "WebhookLog"("processedAt")
      `
      console.log('✅ Index processedAt created')
    } catch (e) {
      console.log('ℹ️ Index processedAt might already exist or failed')
    }

    console.log('=== DATABASE INITIALIZED SUCCESSFULLY ===')

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
    })
  } catch (error: any) {
    console.error('=== DATABASE INITIALIZATION FAILED ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
