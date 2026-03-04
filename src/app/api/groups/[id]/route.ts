import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/groups/[id] - Get group details with members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get group using raw SQL
    const groups = await db.$queryRaw`
      SELECT * FROM "Group" WHERE "id" = ${id} LIMIT 1
    ` as any[]

    if (!groups || groups.length === 0) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    const group = groups[0]

    // Get group members with user details
    const members = await db.$queryRaw`
      SELECT
        gm."id",
        gm."userId",
        gm."joinedAt",
        u."id" as "user_id",
        u."telegramId",
        u."username",
        u."firstName",
        u."lastName",
        u."photoUrl"
      FROM "GroupMember" gm
      JOIN "User" u ON gm."userId" = u."id"
      WHERE gm."groupId" = ${id}
      ORDER BY gm."joinedAt" ASC
    ` as any[]

    // Count members
    const memberCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "GroupMember" WHERE "groupId" = ${id}
    ` as any[]

    // Format members
    const formattedMembers = members.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      user: {
        id: m.user_id,
        telegramId: m.telegramId?.toString() || m.telegramId,
        username: m.username,
        firstName: m.firstName,
        lastName: m.lastName,
        photoUrl: m.photoUrl,
      },
      joinedAt: m.joinedAt,
    }))

    // Serialize BigInt to string for group
    const serializedGroup = JSON.stringify(group, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )

    return NextResponse.json({
      group: {
        ...JSON.parse(serializedGroup),
        memberCount: parseInt(memberCount[0]?.count || '0'),
      },
      members: formattedMembers,
    })
  } catch (error: any) {
    console.error('Error fetching group:', error)
    return NextResponse.json(
      { error: 'Failed to fetch group', details: error.message },
      { status: 500 }
    )
  }
}
