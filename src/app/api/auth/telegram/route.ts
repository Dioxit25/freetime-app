import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// POST /api/auth/telegram - Authenticate user via Telegram
export async function POST(request: NextRequest) {
  console.log('========================================')
  console.log('🔐 AUTH REQUEST STARTED')
  console.log('========================================')

  try {
    const body = await request.json()
    const {
      id,
      firstName,
      lastName,
      username,
      photoUrl,
      languageCode,
      timezone,
      chatId,
    } = body

    console.log('📥 Request body received:')
    console.log(JSON.stringify({
      userId: id,
      firstName,
      lastName,
      username,
      photoUrl,
      languageCode,
      timezone,
      chatId: chatId || 'NOT PROVIDED',
      allKeys: Object.keys(body),
      allBody: body,
    }, null, 2))

    if (!id || !firstName) {
      console.log('❌ Validation failed: missing id or firstName')
      return NextResponse.json(
        { error: 'id and firstName are required' },
        { status: 400 }
      )
    }

    console.log('✅ Validation passed')
    console.log(`👤 User ID: ${id}, Name: ${firstName} ${lastName || ''}`)

    // Find or create user
    console.log('🔍 Looking up/creating user in database...')
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: {
        firstName,
        lastName: lastName || null,
        username: username || null,
        photoUrl: photoUrl || null,
        languageCode: languageCode || 'en',
        timezone: timezone || 'UTC',
      },
      create: {
        telegramId: BigInt(id),
        firstName,
        lastName: lastName || null,
        username: username || null,
        photoUrl: photoUrl || null,
        languageCode: languageCode || 'en',
        timezone: timezone || 'UTC',
      },
    })

    console.log(`✅ User found/created: ${user.id} (Telegram ID: ${user.telegramId})`)

    // Try to get chat ID from WebApp initData (if opened from group)
    // The client can optionally send chatId from Telegram.WebApp.initDataUnsafe.chat
    if (chatId) {
      try {
        console.log(`🔍 Looking for group with chat ID: ${chatId}`)
        console.log(`🔍 Chat ID type: ${typeof chatId}, value: ${chatId}`)

        // Find group by telegram chat ID
        const group = await prisma.group.findUnique({
          where: { telegramChatId: BigInt(chatId) },
        })

        if (group) {
          console.log(`✅ Group found: ${group.id} (${group.telegramTitle})`)
          // Add user to group if not already a member
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
          console.log(`✅ Added user ${user.id} to group ${group.id} (${group.telegramTitle})`)
        } else {
          console.log(`⚠️ Group not found for chat ID: ${chatId}`)
          console.log('ℹ️ Existing groups in database:')
          const allGroups = await prisma.group.findMany({
            select: {
              id: true,
              telegramChatId: true,
              telegramTitle: true,
            },
          })
          console.log(JSON.stringify(allGroups, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, 2))
        }
      } catch (err: any) {
        console.error('❌ Error adding user to group:', err)
        // Don't fail auth if group addition fails
      }
    } else {
      console.log('ℹ️ No chatId provided - app opened from private chat or WebApp not in group')
    }

    // Get user's groups
    console.log('🔍 Fetching user groups from database...')
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

    console.log(`✅ User has ${groups.length} groups:`, groups.map(g => g.telegramTitle))

    await prisma.$disconnect()

    const responseData = {
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
        timezone: user.timezone,
      },
      groups,
    }

    console.log('📤 Sending response:')
    console.log(JSON.stringify(responseData, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2))
    console.log('========================================')
    console.log('🔐 AUTH REQUEST COMPLETED')
    console.log('========================================')

    return NextResponse.json(responseData)
  } catch (error: any) {
    console.error('❌ Error authenticating user:')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    console.error('========================================')
    await prisma.$disconnect()
    return NextResponse.json(
      { error: 'Authentication failed', details: error.message },
      { status: 500 }
    )
  }
}
