import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    // Find or create user using raw SQL
    console.log('🔍 Looking up/creating user in database...')
    const users = await db.$queryRaw`
      SELECT * FROM "User" WHERE "telegramId" = ${BigInt(id)} LIMIT 1
    ` as any[]

    let user: any
    if (users.length === 0) {
      // Create new user
      const newUsers = await db.$queryRaw`
        INSERT INTO "User" ("id", "telegramId", "firstName", "lastName", "username", "photoUrl", "languageCode", "timezone", "isBot", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${BigInt(id)}, ${firstName}, ${lastName || null}, ${username || null}, ${photoUrl || null}, ${languageCode || 'en'}, ${timezone || 'UTC'}, false, NOW(), NOW())
        RETURNING *
      ` as any[]
      user = newUsers[0]
    } else {
      // Update existing user
      await db.$executeRaw`
        UPDATE "User" SET
          "firstName" = ${firstName},
          "lastName" = ${lastName || null},
          "username" = ${username || null},
          "photoUrl" = ${photoUrl || null},
          "languageCode" = ${languageCode || 'en'},
          "timezone" = ${timezone || 'UTC'},
          "isBot" = COALESCE("isBot", false),
          "updatedAt" = NOW()
        WHERE "telegramId" = ${BigInt(id)}
      `
      user = users[0]
    }

    console.log(`✅ User found/created: ${user.id} (Telegram ID: ${user.telegramId})`)

    // Try to get chat ID from WebApp initData (if opened from group)
    // The client can optionally send chatId from Telegram.WebApp.initDataUnsafe.chat
    if (chatId) {
      try {
        console.log(`🔍 Looking for group with chat ID: ${chatId}`)
        console.log(`🔍 Chat ID type: ${typeof chatId}, value: ${chatId}`)

        // Find group by telegram chat ID
        const groups = await db.$queryRaw`
          SELECT * FROM "Group" WHERE "telegramChatId" = ${BigInt(chatId)} LIMIT 1
        ` as any[]

        if (groups.length > 0) {
          const group = groups[0]
          console.log(`✅ Group found: ${group.id} (${group.telegramTitle})`)
          // Add user to group if not already a member
          await db.$executeRaw`
            INSERT INTO "GroupMember" ("id", "userId", "groupId", "joinedAt")
            VALUES (gen_random_uuid()::text, ${user.id}, ${group.id}, NOW())
            ON CONFLICT ("userId", "groupId")
            DO NOTHING
          `
          console.log(`✅ Added user ${user.id} to group ${group.id} (${group.telegramTitle})`)
        } else {
          console.log(`⚠️ Group not found for chat ID: ${chatId}`)
        }
      } catch (err: any) {
        console.error('❌ Error adding user to group:', err)
        // Don't fail auth if group addition fails
      }
    } else {
      console.log('ℹ️ No chatId provided - app opened from private chat or WebApp not in group')
    }

    // Get user's groups using raw SQL
    console.log('🔍 Fetching user groups from database...')
    const memberships = await db.$queryRaw`
      SELECT
        gm."groupId",
        g.*,
        (SELECT COUNT(*)
         FROM "GroupMember" gm2
         JOIN "User" u2 ON gm2."userId" = u2."id"
         WHERE gm2."groupId" = g."id"
           AND (u2."isBot" IS NULL OR u2."isBot" = false)
        ) as "memberCount"
      FROM "GroupMember" gm
      JOIN "Group" g ON gm."groupId" = g."id"
      WHERE gm."userId" = ${user.id}
    ` as any[]

    const groups = memberships.map((m: any) => ({
      id: m.id,
      telegramChatId: m.telegramChatId?.toString() || m.telegramChatId,
      telegramTitle: m.telegramTitle,
      telegramPhotoUrl: m.telegramPhotoUrl,
      tier: m.tier,
      memberCount: parseInt(m.memberCount || '0'),
      joinedAt: m.joinedAt || new Date(),
    }))

    console.log(`✅ User has ${groups.length} groups:`, groups.map(g => g.telegramTitle))

    const responseData = {
      user: {
        id: user.id,
        telegramId: user.telegramId?.toString() || user.telegramId,
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
    return NextResponse.json(
      { error: 'Authentication failed', details: error.message },
      { status: 500 }
    )
  }
}
