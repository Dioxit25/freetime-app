import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { TimeFinderService } from '@/lib/time-finder'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { groupId, userIds, daysToLookAhead = 7, minDuration = 30 } = body

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 }
      )
    }

    // Get group members
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: true },
    })

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

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 404 }
      )
    }

    // Fetch slots for all users
    const allUsersSlots = await Promise.all(
      targetUserIds.map((userId) =>
        prisma.slot.findMany({
          where: { userId, groupId },
          orderBy: { createdAt: 'desc' },
        })
      )
    )

    await prisma.$disconnect()

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

    // Find common free time
    const commonSlots = TimeFinderService.findCommonFreeTime(
      slotsData,
      daysToLookAhead,
      minDuration
    )

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
  } catch (error) {
    console.error('Error finding common time:', error)
    await prisma.$disconnect()
    return NextResponse.json(
      { error: 'Failed to find common time' },
      { status: 500 }
    )
  }
}
