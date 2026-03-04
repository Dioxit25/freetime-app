import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { chatId, title, userId } = await request.json()

    // Create or update group using raw SQL
    const result = await db.$executeRaw`
      INSERT INTO "Group" ("id", "telegramChatId", "telegramTitle", "tier", "memberCount", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${BigInt(chatId)}, ${title}, 'FREE', 1, NOW(), NOW())
      ON CONFLICT ("telegramChatId")
      DO UPDATE SET
        "telegramTitle" = ${title},
        "memberCount" = 1,
        "updatedAt" = NOW()
      RETURNING "id"
    `

    // Get the group
    const group = await db.$queryRaw`
      SELECT * FROM "Group" WHERE "telegramChatId" = ${BigInt(chatId)}
      LIMIT 1
    `

    return NextResponse.json({ success: true, group })
  } catch (error: any) {
    console.error('Test group error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
