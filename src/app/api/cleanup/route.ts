import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/cleanup - Get cleanup status
export async function GET(request: NextRequest) {
  try {
    // Count slots in database
    const slotCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "Slot"
    ` as any[]

    // Count inactive groups
    const inactiveGroupsCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "Group" WHERE "telegramChatId" IS NULL
    ` as any[]

    // Count total groups
    const totalGroupsCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "Group"
    ` as any[]

    // Count members
    const membersCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "GroupMember"
    ` as any[]

    // Count users
    const usersCount = await db.$queryRaw`
      SELECT COUNT(*) as count FROM "User"
    ` as any[]

    return NextResponse.json({
      success: true,
      stats: {
        slots: parseInt(slotCount[0].count || '0'),
        inactiveGroups: parseInt(inactiveGroupsCount[0].count || '0'),
        totalGroups: parseInt(totalGroupsCount[0].count || '0'),
        members: parseInt(membersCount[0].count || '0'),
        users: parseInt(usersCount[0].count || '0'),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get cleanup status',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

// POST /api/cleanup - Clean up old data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deleteInactiveGroups = false, confirm = false } = body

    if (!confirm) {
      return NextResponse.json({
        success: false,
        error: 'Confirmation required',
        message: 'Set confirm=true to proceed with cleanup',
      }, { status: 400 })
    }

    console.log('=== CLEANUP STARTED ===')
    console.log('deleteInactiveGroups:', deleteInactiveGroups)

    let results: any = {
      inactiveGroupsDeleted: 0,
    }

    // Delete inactive groups if requested
    if (deleteInactiveGroups) {
      console.log('🗑️ Deleting inactive groups...')
      
      // First, delete slots for inactive groups
      const deletedSlots = await db.$queryRaw`
        DELETE FROM "Slot"
        WHERE "groupId" IN (
          SELECT "id" FROM "Group" WHERE "telegramChatId" IS NULL
        )
        RETURNING "id"
      ` as any[]

      console.log(`✅ Deleted ${deletedSlots.length} slots from inactive groups`)

      // Then, delete group members for inactive groups
      const deletedMembers = await db.$queryRaw`
        DELETE FROM "GroupMember"
        WHERE "groupId" IN (
          SELECT "id" FROM "Group" WHERE "telegramChatId" IS NULL
        )
        RETURNING "id"
      ` as any[]

      console.log(`✅ Deleted ${deletedMembers.length} group members from inactive groups`)

      // Finally, delete inactive groups
      const deletedGroups = await db.$queryRaw`
        DELETE FROM "Group" WHERE "telegramChatId" IS NULL
        RETURNING "id"
      ` as any[]

      results.inactiveGroupsDeleted = deletedGroups.length
      console.log(`✅ Deleted ${deletedGroups.length} inactive groups`)
    }

    console.log('=== CLEANUP COMPLETED ===')

    return NextResponse.json({
      success: true,
      results,
      message: deleteInactiveGroups
        ? `Удалено: ${results.inactiveGroupsDeleted} неактивных групп`
        : 'Очистка не выполнена (deleteInactiveGroups=false)',
    })
  } catch (error: any) {
    console.error('=== CLEANUP FAILED ===')
    console.error('Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup failed',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
