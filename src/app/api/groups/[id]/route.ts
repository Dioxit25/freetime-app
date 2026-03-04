import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/groups/[id] - Get group details with members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        _count: {
          select: { members: true, slots: true },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    const members = group.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      user: {
        id: m.user.id,
        telegramId: m.user.telegramId,
        username: m.user.username,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        photoUrl: m.user.photoUrl,
      },
      joinedAt: m.joinedAt,
    }))

    await prisma.$disconnect()

    return NextResponse.json({
      group: {
        id: group.id,
        telegramChatId: group.telegramChatId.toString(),
        telegramTitle: group.telegramTitle,
        telegramPhotoUrl: group.telegramPhotoUrl,
        tier: group.tier,
        memberCount: group._count.members,
        slotCount: group._count.slots,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
      members,
    })
  } catch (error: any) {
    console.error('Error fetching group:', error)
    await prisma.$disconnect()
    return NextResponse.json(
      { error: 'Failed to fetch group', details: error.message },
      { status: 500 }
    )
  }
}
