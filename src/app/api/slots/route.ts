import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/slots - Get slots for a group
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const userId = searchParams.get('userId')

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 }
      )
    }

    let query = `
      SELECT
        s.*,
        u."id" as "user_id",
        u."firstName",
        u."lastName",
        u."username",
        u."photoUrl"
      FROM "Slot" s
      LEFT JOIN "User" u ON s."userId" = u."id"
      WHERE s."groupId" = ${groupId}
    `

    if (userId) {
      query += ` AND s."userId" = ${userId}`
    }

    query += ` ORDER BY s."createdAt" DESC`

    const slots = await db.$queryRaw(query) as any[]

    // Format slots with user info
    const formattedSlots = slots.map((slot: any) => ({
      id: slot.id,
      userId: slot.userId,
      groupId: slot.groupId,
      type: slot.type,
      description: slot.description,
      startAt: slot.startAt,
      endAt: slot.endAt,
      dayOfWeek: slot.dayOfWeek,
      startTimeLocal: slot.startTimeLocal,
      endTimeLocal: slot.endTimeLocal,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
      user: {
        id: slot.user_id,
        firstName: slot.firstName,
        lastName: slot.lastName,
        username: slot.username,
        photoUrl: slot.photoUrl,
      },
    }))

    return NextResponse.json(formattedSlots)
  } catch (error: any) {
    console.error('Error fetching slots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch slots', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/slots - Create a new slot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      groupId,
      type,
      description,
      startAt,
      endAt,
      dayOfWeek,
      startTimeLocal,
      endTimeLocal,
    } = body

    if (!userId || !groupId || !type) {
      return NextResponse.json(
        { error: 'userId, groupId, and type are required' },
        { status: 400 }
      )
    }

    if (type !== 'ONE_TIME' && type !== 'CYCLIC_WEEKLY') {
      return NextResponse.json(
        { error: 'Invalid slot type' },
        { status: 400 }
      )
    }

    // Create slot using raw SQL
    const slots = await db.$queryRaw`
      INSERT INTO "Slot" ("id", "userId", "groupId", "type", "description", "startAt", "endAt", "dayOfWeek", "startTimeLocal", "endTimeLocal", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${userId},
        ${groupId},
        ${type},
        ${description || null},
        ${startAt ? new Date(startAt) : null},
        ${endAt ? new Date(endAt) : null},
        ${dayOfWeek || null},
        ${startTimeLocal || null},
        ${endTimeLocal || null},
        NOW(),
        NOW()
      )
      RETURNING *
    ` as any[]

    const slot = slots[0]

    // Serialize BigInt to string
    const serialized = JSON.stringify(slot, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )

    return NextResponse.json(JSON.parse(serialized), { status: 201 })
  } catch (error: any) {
    console.error('Error creating slot:', error)
    return NextResponse.json(
      { error: 'Failed to create slot', details: error.message },
      { status: 500 }
    )
  }
}
