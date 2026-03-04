import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/groups - Get user's groups
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramId = searchParams.get('telegramId')

    if (!telegramId) {
      return NextResponse.json(
        { error: 'telegramId is required' },
        { status: 400 }
      )
    }

    // Find user by telegram ID
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user's groups with member count
    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    })

    const groups = memberships.map((m) => ({
      id: m.group.id,
      telegramChatId: m.group.telegramChatId.toString(),
      telegramTitle: m.group.telegramTitle,
      telegramPhotoUrl: m.group.telegramPhotoUrl,
      tier: m.group.tier,
      memberCount: m.group._count.members,
      joinedAt: m.joinedAt,
    }))

    return NextResponse.json({ groups })
  } catch (error: any) {
    console.error('Error fetching groups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch groups', details: error.message },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// POST /api/groups - Create or get a group (from Telegram)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      telegramChatId,
      telegramTitle,
      telegramPhotoUrl,
      telegramUserId,
    } = body

    if (!telegramChatId || !telegramTitle) {
      return NextResponse.json(
        { error: 'telegramChatId and telegramTitle are required' },
        { status: 400 }
      )
    }

    // Find or create the group
    const group = await prisma.group.upsert({
      where: { telegramChatId: BigInt(telegramChatId) },
      update: {
        telegramTitle,
        telegramPhotoUrl,
      },
      create: {
        telegramChatId: BigInt(telegramChatId),
        telegramTitle,
        telegramPhotoUrl,
        tier: 'FREE',
      },
    })

    // If telegramUserId provided, add user to group
    let user = null
    if (telegramUserId) {
      user = await prisma.user.upsert({
        where: { telegramId: parseInt(telegramUserId) },
        update: {},
        create: {
          telegramId: parseInt(telegramUserId),
          firstName: 'User',
          timezone: 'UTC',
        },
      })

      // Add user to group (if not already a member)
      await prisma.groupMember.upsert({
        where: {
          userId_groupId: {
            userId: user.id,
            groupId: group.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          groupId: group.id,
        },
      })
    }

    await prisma.$disconnect()

    return NextResponse.json({
      group: {
        id: group.id,
        telegramChatId: group.telegramChatId.toString(),
        telegramTitle: group.telegramTitle,
        telegramPhotoUrl: group.telegramPhotoUrl,
        tier: group.tier,
      },
      user: user ? { id: user.id, telegramId: user.telegramId } : null,
    })
  } catch (error: any) {
    console.error('Error creating group:', error)
    await prisma.$disconnect()
    return NextResponse.json(
      { error: 'Failed to create group', details: error.message },
      { status: 500 }
    )
  }
}
