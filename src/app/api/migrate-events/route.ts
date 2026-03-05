/**
 * Migration API - Apply calendar logic updates to database
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check if Event table exists
    const eventTableExists = await db.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'Event'
      ) as exists
    ` as any[]

    // Check if EventException table exists
    const exceptionTableExists = await db.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'EventException'
      ) as exists
    ` as any[]

    // Check if Reminder table exists
    const reminderTableExists = await db.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'Reminder'
      ) as exists
    ` as any[]

    // Check if conflictMode column exists in User table
    const conflictModeColumnExists = await db.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'User'
        AND column_name = 'conflictMode'
      ) as exists
    ` as any[]

    // Count existing Slot records (for migration planning)
    const slotCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "Slot"
    ` as any[]

    return NextResponse.json({
      status: 'ok',
      tables: {
        Event: eventTableExists[0].exists,
        EventException: exceptionTableExists[0].exists,
        Reminder: reminderTableExists[0].exists
      },
      columns: {
        conflictMode: conflictModeColumnExists[0].exists
      },
      migration: {
        slotCount: slotCount[0].count,
        canMigrate: eventTableExists[0].exists
      }
    })
  } catch (error) {
    console.error('Error checking migration status:', error)
    return NextResponse.json(
      { error: 'Failed to check migration status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { confirm = false, migrateSlots = false } = body

    if (!confirm) {
      return NextResponse.json(
        { error: 'Please set confirm=true to apply migration' },
        { status: 400 }
      )
    }

    const results: any = {}

    // Add conflictMode column to User table
    try {
      await db.$queryRaw`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "conflictMode" VARCHAR(20) DEFAULT 'SOFT'
      `
      results.conflictMode = 'added'
    } catch (error) {
      results.conflictMode = 'failed'
      results.conflictModeError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Create Event table (if not exists)
    try {
      await db.$queryRaw`
        CREATE TABLE IF NOT EXISTS "Event" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "groupId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
          "type" TEXT NOT NULL,
          "description" TEXT,
          "isAllDay" BOOLEAN NOT NULL DEFAULT false,
          "startAt" TIMESTAMP(3),
          "endAt" TIMESTAMP(3),
          "dayOfWeek" INTEGER,
          "startTime" TEXT,
          "endTime" TEXT,
          "recurrenceRule" TEXT,
          "recurrenceDays" TEXT,
          "recurrenceUntil" TIMESTAMP(3),
          "version" INTEGER NOT NULL DEFAULT 0,
          "lastModifiedBy" TEXT,
          "lastModifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "isGenerated" BOOLEAN NOT NULL DEFAULT false,
          "category" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY ("id"),
          CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Event_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `
      results.Event = 'created'
    } catch (error) {
      results.Event = 'failed'
      results.EventError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Create indexes for Event table
    try {
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "Event_userId_idx" ON "Event"("userId")`
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "Event_groupId_idx" ON "Event"("groupId")`
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "Event_startAt_idx" ON "Event"("startAt")`
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "Event_status_idx" ON "Event"("status")`
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "Event_type_idx" ON "Event"("type")`
      results.EventIndexes = 'created'
    } catch (error) {
      results.EventIndexes = 'failed'
      results.EventIndexesError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Create EventException table
    try {
      await db.$queryRaw`
        CREATE TABLE IF NOT EXISTS "EventException" (
          "id" TEXT NOT NULL,
          "eventId" TEXT NOT NULL,
          "originalDate" TIMESTAMP(3) NOT NULL,
          "originalStart" TIMESTAMP(3),
          "originalEnd" TIMESTAMP(3),
          "newDate" TIMESTAMP(3),
          "newStart" TIMESTAMP(3),
          "newEnd" TIMESTAMP(3),
          "isCancelled" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY ("id"),
          CONSTRAINT "EventException_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `
      results.EventException = 'created'
    } catch (error) {
      results.EventException = 'failed'
      results.EventExceptionError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Create indexes for EventException table
    try {
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "EventException_eventId_idx" ON "EventException"("eventId")`
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "EventException_originalDate_idx" ON "EventException"("originalDate")`
      results.EventExceptionIndexes = 'created'
    } catch (error) {
      results.EventExceptionIndexes = 'failed'
      results.EventExceptionIndexesError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Create Reminder table
    try {
      await db.$queryRaw`
        CREATE TABLE IF NOT EXISTS "Reminder" (
          "id" TEXT NOT NULL,
          "eventId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "minutesBefore" INTEGER NOT NULL DEFAULT 30,
          "isSent" BOOLEAN NOT NULL DEFAULT false,
          "sentAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY ("id"),
          CONSTRAINT "Reminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `
      results.Reminder = 'created'
    } catch (error) {
      results.Reminder = 'failed'
      results.ReminderError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Create indexes for Reminder table
    try {
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "Reminder_eventId_idx" ON "Reminder"("eventId")`
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "Reminder_userId_idx" ON "Reminder"("userId")`
      await db.$queryRaw`CREATE INDEX IF NOT EXISTS "Reminder_isSent_idx" ON "Reminder"("isSent")`
      results.ReminderIndexes = 'created'
    } catch (error) {
      results.ReminderIndexes = 'failed'
      results.ReminderIndexesError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Add relations to Group table
    try {
      await db.$queryRaw`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'Group' AND column_name = 'conflicts'
          ) THEN
            -- Update existing relation
            ALTER TABLE "Group" DROP CONSTRAINT IF EXISTS "Group_conflicts_fkey";
            ALTER TABLE "Group" ADD CONSTRAINT "Group_conflicts_fkey"
              FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `
      results.GroupRelations = 'updated'
    } catch (error) {
      results.GroupRelations = 'skipped'
      results.GroupRelationsError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Migrate slots to events if requested
    if (migrateSlots) {
      try {
        const migrationResult = await db.$queryRaw`
          INSERT INTO "Event" (
            "id", "userId", "groupId", "status", "type", "description",
            "isAllDay", "startAt", "endAt", "dayOfWeek", "startTime", "endTime",
            "category", "version", "lastModifiedAt", "createdAt", "updatedAt"
          )
          SELECT
            s."id",
            s."userId",
            s."groupId",
            'CONFIRMED',
            s."type",
            s."description",
            false,
            s."startAt",
            s."endAt",
            s."dayOfWeek",
            s."startTimeLocal",
            s."endTimeLocal",
            NULL,
            1,
            s."updatedAt",
            s."createdAt",
            s."updatedAt"
          FROM "Slot" s
          ON CONFLICT ("id") DO NOTHING
          RETURNING COUNT(*) as count
        ` as any[]

        results.migratedSlots = migrationResult[0]?.count || 0
      } catch (error) {
        results.migratedSlots = 'failed'
        results.migratedSlotsError = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error applying migration:', error)
    return NextResponse.json(
      { error: 'Failed to apply migration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
