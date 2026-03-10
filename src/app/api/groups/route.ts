import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/groups - Get user's groups or all available groups
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramId = searchParams.get('telegramId')
    const all = searchParams.get('all')

    // If all=true, return all groups (for user to join)
    if (all === 'true') {
      const groups = await db.group.findMany({
        include: {
          _count: {
            select: { members: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return NextResponse.json({
        groups: groups.map(g => ({
          id: g.id,
          telegramChatId: g.telegramChatId.toString(),
          telegramTitle: g.telegramTitle,
          telegramPhotoUrl: g.telegramPhotoUrl,
          tier: g.tier,
          memberCount: g._count.members,
        }))
      })
    }

    if (!telegramId) {
      return NextResponse.json(
        { error: 'telegramId is required' },
        { status: 400 }
      )
    }

    // Find user by telegram ID - try string first (SQLite), then BigInt (PostgreSQL)
    let user = await db.user.findUnique({
      where: { telegramId: telegramId }
    }).catch(async () => {
      try {
        return await db.user.findUnique({
          where: { telegramId: BigInt(telegramId) as any }
        })
      } catch {
        return null
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user's groups with member count
    const memberships = await db.groupMember.findMany({
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

    console.log('📥 Group creation/update request:', {
      telegramChatId,
      telegramTitle,
      telegramUserId,
    })

    if (!telegramChatId || !telegramTitle) {
      return NextResponse.json(
        { error: 'telegramChatId and telegramTitle are required' },
        { status: 400 }
      )
    }

    // Find or create the group - try string first, then BigInt
    let group
    try {
      group = await db.group.upsert({
        where: { telegramChatId: String(telegramChatId) },
        update: {
          telegramTitle,
          telegramPhotoUrl,
        },
        create: {
          telegramChatId: String(telegramChatId),
          telegramTitle,
          telegramPhotoUrl,
          tier: 'FREE',
        },
      })
    } catch (e) {
      // Fallback to BigInt for PostgreSQL
      group = await db.group.upsert({
        where: { telegramChatId: BigInt(telegramChatId) as any },
        update: {
          telegramTitle,
          telegramPhotoUrl,
        },
        create: {
          telegramChatId: BigInt(telegramChatId) as any,
          telegramTitle,
          telegramPhotoUrl,
          tier: 'FREE',
        },
      })
    }

    console.log('✅ Group created/updated:', group.id)

    // If telegramUserId provided, add user to group
    let user = null
    if (telegramUserId) {
      try {
        user = await db.user.findUnique({
          where: { telegramId: String(telegramUserId) }
        })

        if (user) {
          // Add user to group (if not already a member)
          await db.groupMember.upsert({
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
          console.log('✅ User added to group:', user.id, '→', group.id)
        }
      } catch (err: any) {
        console.error('Error adding user to group:', err)
      }
    }

    return NextResponse.json({
      group: {
        id: group.id,
        telegramChatId: group.telegramChatId.toString(),
        telegramTitle: group.telegramTitle,
        telegramPhotoUrl: group.telegramPhotoUrl,
        tier: group.tier,
      },
      user: user ? { id: user.id, telegramId: user.telegramId.toString() } : null,
    })
  } catch (error: any) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      { error: 'Failed to create group', details: error.message },
      { status: 500 }
    )
  }
}
