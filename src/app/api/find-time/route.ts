import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TimeFinderService } from '@/lib/time-finder'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { groupId, userIds, daysToLookAhead = 7, minDuration = 30 } = body

    console.log('=== FIND TIME STARTED ===')
    console.log('groupId:', groupId)
    console.log('userIds:', userIds)
    console.log('daysToLookAhead:', daysToLookAhead)
    console.log('minDuration:', minDuration)

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 }
      )
    }

    // Get group members (excluding bots) using raw SQL
    const members = await db.$queryRaw`
      SELECT
        gm."userId",
        u."id" as "user_id",
        u."firstName",
        u."isBot"
      FROM "GroupMember" gm
      JOIN "User" u ON gm."userId" = u."id"
      WHERE gm."groupId" = ${groupId}
        AND (u."isBot" IS NULL OR u."isBot" = false)
    ` as any[]

    console.log('Group members found:', members.length)
    console.log('Members:', members.map(m => ({ id: m.userId, name: m.firstName, isBot: m.isBot })))

    if (members.length === 0) {
      return NextResponse.json(
        { error: 'No members in group' },
        { status: 400 }
      )
    }

    // Use all members if userIds not provided, otherwise filter
    const targetUserIds = userIds
      ? members
          .filter((m) => userIds.includes(m.userId))
          .map((m) => m.userId)
      : members.map((m) => m.userId)

    console.log('Target user IDs:', targetUserIds)

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 404 }
      )
    }

    // Fetch slots for all users using raw SQL
    const allUsersSlots = await Promise.all(
      targetUserIds.map(async (userId) => {
        const slots = await db.$queryRaw`
          SELECT
            "type",
            "startAt",
            "endAt",
            "dayOfWeek",
            "startTimeLocal",
            "endTimeLocal"
          FROM "Slot"
          WHERE "userId" = ${userId}
            AND "groupId" = ${groupId}
          ORDER BY "createdAt" DESC
        ` as any[]

        console.log(`User ${userId} has ${slots.length} slots`)
        slots.forEach(s => {
          console.log(`  - ${s.type}: ${s.startTimeLocal || s.startAt} - ${s.endTimeLocal || s.endAt}, dayOfWeek: ${s.dayOfWeek}`)
        })

        return slots
      })
    )

    // Convert to SlotData format
    const slotsData = allUsersSlots.map((slots) =>
      slots.map((slot) => ({
        type: slot.type as 'ONE_TIME' | 'CYCLIC_WEEKLY',
        startAt: slot.startAt ? new Date(slot.startAt) : undefined,
        endAt: slot.endAt ? new Date(slot.endAt) : undefined,
        dayOfWeek: slot.dayOfWeek ?? undefined,
        startTimeLocal: slot.startTimeLocal ?? undefined,
        endTimeLocal: slot.endTimeLocal ?? undefined,
      }))
    )

    console.log('Total slots to process:', slotsData.reduce((acc, arr) => acc + arr.length, 0))

    // Find common free time
    const commonSlots = TimeFinderService.findCommonFreeTime(
      slotsData,
      daysToLookAhead,
      minDuration
    )

    console.log('Found common free slots:', commonSlots.length)
    commonSlots.forEach((slot, i) => {
      console.log(`  ${i + 1}. ${slot.start.toISOString()} - ${slot.end.toISOString()}`)
    })

    console.log('=== FIND TIME COMPLETED ===')

    return NextResponse.json({
      slots: commonSlots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        durationMinutes: Math.round(
          (slot.end.getTime() - slot.start.getTime()) / 60000
        ),
      })),
      count: commonSlots.length,
      userIds: targetUserIds,
    })
  } catch (error: any) {
    console.error('Error finding common time:', error)
    console.error('Stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to find common time', details: error.message },
      { status: 500 }
    )
  }
}
