import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // This will create/update tables based on schema
    // For production, we typically use migrations, but for quick fixes:
    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL,
      "telegramId" BIGINT NOT NULL,
      "username" TEXT,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT,
      "timezone" TEXT NOT NULL DEFAULT 'UTC',
      "languageCode" TEXT DEFAULT 'en',
      "photoUrl" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    )`

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "Group" (
      "id" TEXT NOT NULL,
      "telegramChatId" BIGINT NOT NULL,
      "telegramTitle" TEXT NOT NULL,
      "telegramPhotoUrl" TEXT,
      "tier" TEXT NOT NULL DEFAULT 'FREE',
      "memberCount" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
    )`

    // Add memberCount column if it doesn't exist
    try {
      await db.$executeRaw`ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "memberCount" INTEGER NOT NULL DEFAULT 1`
    } catch (e: any) {
      console.log('memberCount column already exists or error:', e.message)
    }

    return NextResponse.json({ success: true, message: 'Migration completed' })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
