import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const slotSchema = {
  type: ['ONE_TIME', 'CYCLIC_WEEKLY'],
}

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

    const slots = await prisma.slot.findMany({
      where: {
        groupId,
        ...(userId && { userId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    })

    await prisma.$disconnect()

    return NextResponse.json(slots)
  } catch (error) {
    console.error('Error fetching slots:', error)
    await prisma.$disconnect()
    return NextResponse.json(
      { error: 'Failed to fetch slots' },
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

    if (!slotSchema.type.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid slot type' },
        { status: 400 }
      )
    }

    const slot = await prisma.slot.create({
      data: {
        userId,
        groupId,
        type,
        description,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        dayOfWeek,
        startTimeLocal,
        endTimeLocal,
      },
    })

    await prisma.$disconnect()

    return NextResponse.json(slot, { status: 201 })
  } catch (error) {
    console.error('Error creating slot:', error)
    await prisma.$disconnect()
    return NextResponse.json(
      { error: 'Failed to create slot' },
      { status: 500 }
    )
  }
}
