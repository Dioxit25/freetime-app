import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/slots - Get slots for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const groupId = searchParams.get('groupId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    console.log('📂 Fetching slots for user:', { userId, groupId })

    // Handle demo user
    if (userId === 'demo-user') {
      console.log('📝 Returning empty slots for demo user')
      return NextResponse.json([])
    }

    // Fetch slots for user with Prisma Client
    const slots = await db.slot.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`✅ Found ${slots.length} slots in database`)

    return NextResponse.json(slots)
  } catch (error: any) {
    console.error('❌ Error fetching slots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch slots', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/slots - Create a new slot
export async function POST(request: NextRequest) {
  console.log('=== SLOT CREATION STARTED ===')

  try {
    const body = await request.json()
    const {
      userId,
      telegramId,  // Alternative: find user by telegram ID (for bot)
      type,
      description,
      startAt,
      endAt,
      dayOfWeek,
      startTimeLocal,
      endTimeLocal,
      timezone,  // Timezone пользователя
    } = body

    console.log('📥 Slot creation request:', {
      userId,
      telegramId,
      type,
      description,
      startAt,
      endAt,
      dayOfWeek,
      startTimeLocal,
      endTimeLocal,
      timezone,
    })

    // Determine userId - either provided directly or via telegramId
    let effectiveUserId = userId

    if (!effectiveUserId && telegramId) {
      // Find user by telegram ID (for bot requests)
      const userByTelegram = await db.user.findFirst({
        where: { telegramId: telegramId.toString() },
        select: { id: true }
      })
      if (userByTelegram) {
        effectiveUserId = userByTelegram.id
        console.log('✅ Found user by telegramId:', telegramId, '-> userId:', effectiveUserId)
      }
    }

    if (!effectiveUserId || !type) {
      console.log('❌ Validation failed: missing required fields', { userId, telegramId, effectiveUserId, type })
      return NextResponse.json(
        { error: 'userId (or telegramId) and type are required', received: { userId, telegramId, type } },
        { status: 400 }
      )
    }

    // Handle demo user
    if (effectiveUserId === 'demo-user') {
      return NextResponse.json({
        id: `demo-slot-${Date.now()}`,
        userId: effectiveUserId,
        type,
        description,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        dayOfWeek,
        startTimeLocal,
        endTimeLocal,
        timezone,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { status: 201 })
    }

    if (type !== 'ONE_TIME' && type !== 'CYCLIC_WEEKLY') {
      console.log('❌ Validation failed: invalid slot type', { type })
      return NextResponse.json(
        { error: 'Invalid slot type', received: type, valid: ['ONE_TIME', 'CYCLIC_WEEKLY'] },
        { status: 400 }
      )
    }

    console.log('✅ Validation passed, creating slot...')

    // Verify user exists and get their timezone
    const user = await db.user.findUnique({
      where: { id: effectiveUserId },
      select: { id: true, firstName: true, timezone: true }
    })

    if (!user) {
      console.log('❌ User not found in database:', effectiveUserId)
      return NextResponse.json(
        { error: 'User not found', details: `User with id ${effectiveUserId} does not exist` },
        { status: 404 }
      )
    }

    // Используем timezone из запроса или из профиля пользователя, или UTC как fallback
    const slotTimezone = timezone || user.timezone || 'UTC'

    console.log('✅ User verified, creating slot...')
    console.log('📝 Description to save:', description)
    console.log('📝 Timezone for slot:', slotTimezone)

    // Create slot using Prisma Client
    const slot = await db.slot.create({
      data: {
        userId: effectiveUserId,
        type,
        description: description || null,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        dayOfWeek: dayOfWeek ?? null,
        startTimeLocal: startTimeLocal || null,
        endTimeLocal: endTimeLocal || null,
        timezone: slotTimezone,
      }
    })

    console.log('✅ Slot created successfully:', {
      id: slot.id,
      userId: slot.userId,
      type: slot.type,
      description: slot.description,
      timezone: slot.timezone,
    })

    console.log('=== SLOT CREATION COMPLETED ===')
    return NextResponse.json(slot, { status: 201 })
  } catch (error: any) {
    console.error('❌ Error creating slot:', error)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)

    let errorMessage = error.message || 'Failed to create slot'
    let errorDetails = error.name || 'Unknown error'

    console.log('=== SLOT CREATION FAILED ===')
    return NextResponse.json(
      { error: errorMessage, details: errorDetails, code: error.code },
      { status: 500 }
    )
  }
}
