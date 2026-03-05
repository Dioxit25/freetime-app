import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/migrate - Check migration status
export async function GET(request: NextRequest) {
  try {
    // Check if isBot column exists
    const result = await db.$queryRaw`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'isBot'
    ` as any[]

    const hasIsBotColumn = result.length > 0

    return NextResponse.json({
      success: true,
      hasIsBotColumn,
      columnInfo: hasIsBotColumn ? result[0] : null,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check migration status',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

// POST /api/migrate - Apply database migrations
export async function POST(request: NextRequest) {
  try {
    console.log('=== MIGRATION STARTED ===')

    // Add isBot column to User table
    try {
      await db.$executeRaw`
        ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBot" BOOLEAN DEFAULT false
      `
      console.log('✅ Added isBot column to User table')
    } catch (err: any) {
      if (err.message && err.message.includes('already exists')) {
        console.log('ℹ️ isBot column already exists in User table')
      } else {
        throw err
      }
    }

    // Update existing users (set isBot to false for all)
    try {
      await db.$executeRaw`
        UPDATE "User" SET "isBot" = false WHERE "isBot" IS NULL
      `
      console.log('✅ Updated existing users with isBot = false')
    } catch (err: any) {
      console.log('ℹ️ Could not update existing users:', err.message)
    }

    console.log('=== MIGRATION COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      changes: [
        'Added isBot column to User table',
        'Updated existing users with isBot = false',
      ],
    })
  } catch (error: any) {
    console.error('=== MIGRATION FAILED ===')
    console.error('Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
