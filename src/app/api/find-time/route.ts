import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TimeFinderService } from '@/lib/time-finder'

export async function POST(request: NextRequest) {
  console.log('=== FIND TIME STARTED ===')

  try {
    const body = await request.json()
    const { groupId, userIds, daysToLookAhead = 7, minDuration = 30 } = body

    console.log('📥 Request parameters:', {
      groupId,
      userIds,
      daysToLookAhead,
      minDuration
    })

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 }
      )
    }

    // Get group members using Prisma
    const members = await db.groupMember.findMany({
      where: { groupId },
      include: {
        user: true
      }
    })

    // Filter out bots
    const humanMembers = members.filter(m => !m.user?.isBot)

    console.log('👥 Group members found:', humanMembers.length)
    humanMembers.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.user?.firstName} (${m.user?.timezone || 'no tz'})`)
    })

    if (humanMembers.length === 0) {
      return NextResponse.json(
        { error: 'No members in group', details: 'Group may not exist or has no human members' },
        { status: 400 }
      )
    }

    // Use all members if userIds not provided, otherwise filter
    const targetMembers = userIds
      ? humanMembers.filter((m) => userIds.includes(m.userId))
      : humanMembers

    const targetUserIds = targetMembers.map((m) => m.userId)

    console.log('🎯 Target user IDs:', targetUserIds)

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 404 }
      )
    }

    // Create user info map for later use
    const userInfoMap = new Map<string, { 
      firstName: string; 
      lastName?: string; 
      username?: string;
      timezone?: string;
    }>()
    
    targetMembers.forEach(m => {
      if (m.user) {
        userInfoMap.set(m.userId, {
          firstName: m.user.firstName,
          lastName: m.user.lastName || undefined,
          username: m.user.username || undefined,
          timezone: m.user.timezone || 'UTC',
        })
      }
    })

    // Fetch slots for all users using Prisma
    const allUsersSlots = await Promise.all(
      targetUserIds.map(async (userId) => {
        const slots = await db.slot.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        })

        const userInfo = userInfoMap.get(userId)
        const userTimezone = userInfo?.timezone || 'UTC'

        console.log(`📦 User ${userId} has ${slots.length} slots (tz: ${userTimezone})`)
        
        return slots.map(s => ({
          type: s.type as 'ONE_TIME' | 'CYCLIC_WEEKLY',
          startAt: s.startAt || undefined,
          endAt: s.endAt || undefined,
          dayOfWeek: s.dayOfWeek ?? undefined,
          startTimeLocal: s.startTimeLocal ?? undefined,
          endTimeLocal: s.endTimeLocal ?? undefined,
          timezone: s.timezone || userTimezone,  // Используем timezone слота или пользователя
        }))
      })
    )

    console.log('📊 Total slots to process:', allUsersSlots.reduce((acc, arr) => acc + arr.length, 0))

    // Find common free time using updated algorithm with timezone support
    const commonSlots = TimeFinderService.findCommonFreeTime(
      allUsersSlots,
      daysToLookAhead,
      minDuration,
      'UTC'  // Server timezone
    )

    console.log('✨ Found common free slots:', commonSlots.length)

    // Sort by start time (nearest first)
    commonSlots.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Log results
    commonSlots.forEach((slot, i) => {
      const durationMinutes = Math.round((slot.end.getTime() - slot.start.getTime()) / 60000)
      console.log(`  ${i + 1}. ${slot.start.toISOString()} - ${slot.end.toISOString()} (${durationMinutes}min)`)
    })

    console.log('=== FIND TIME COMPLETED ===')

    // Build response with user info
    const participants = targetUserIds.map(userId => {
      const info = userInfoMap.get(userId)
      return {
        id: userId,
        firstName: info?.firstName || 'Unknown',
        lastName: info?.lastName,
        username: info?.username,
        timezone: info?.timezone,
      }
    })

    // Get unique timezones from participants
    const timezones = [...new Set(participants.map(p => p.timezone).filter(Boolean))]

    return NextResponse.json({
      slots: commonSlots.map((slot) => {
        const durationMinutes = Math.round(
          (slot.end.getTime() - slot.start.getTime()) / 60000
        )
        return {
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          durationMinutes,
          spansMultipleDays: durationMinutes > 24 * 60
        }
      }),
      count: commonSlots.length,
      participants,
      userIds: targetUserIds,
      timezones,  // Список всех timezone участников
      searchParams: {
        daysToLookAhead,
        minDuration,
      }
    })
  } catch (error: any) {
    console.error('❌ Error finding common time:', error)
    console.error('Stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to find common time', details: error.message },
      { status: 500 }
    )
  }
}
