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

    console.log('📥 Request body received:', {
      userId: id,
      firstName,
      lastName,
      username,
      chatId: chatId || 'NOT PROVIDED',
      timezone,
    })

    if (!id || !firstName) {
      console.log('❌ Validation failed: missing id or firstName')
      return NextResponse.json(
        { error: 'id and firstName are required' },
        { status: 400 }
      )
    }

    console.log('✅ Validation passed')

    // Find or create user using Prisma Client
    console.log('🔍 Looking up/creating user in database...')
    
    const telegramIdStr = String(id)
    
    // Try to find user by string first (SQLite), then by BigInt (PostgreSQL)
    let user = await db.user.findUnique({
      where: { telegramId: telegramIdStr }
    }).catch(async () => {
      // If string fails, try BigInt for PostgreSQL
      try {
        return await db.user.findUnique({
          where: { telegramId: BigInt(id) as any }
        })
      } catch {
        return null
      }
    })

    if (!user) {
      // Create new user - try string first, then BigInt
      try {
        user = await db.user.create({
          data: {
            telegramId: telegramIdStr,
            firstName,
            lastName: lastName || null,
            username: username || null,
            photoUrl: photoUrl || null,
            languageCode: languageCode || 'en',
            timezone: timezone || 'UTC',
          }
        })
      } catch (createError: any) {
        // If string fails, try BigInt for PostgreSQL
        if (createError.code === 'P2025' || createError.message?.includes('BigInt')) {
          user = await db.user.create({
            data: {
              telegramId: BigInt(id) as any,
              firstName,
              lastName: lastName || null,
              username: username || null,
              photoUrl: photoUrl || null,
              languageCode: languageCode || 'en',
              timezone: timezone || 'UTC',
            }
          })
        } else {
          throw createError
        }
      }
      console.log(`✅ User created: ${user.id}`)
    } else {
      // Update existing user
      user = await db.user.update({
        where: { id: user.id },
        data: {
          firstName,
          lastName: lastName || null,
          username: username || null,
          photoUrl: photoUrl || null,
          languageCode: languageCode || 'en',
          timezone: timezone || user.timezone, // Сохраняем новый timezone если передан
        }
      })
      console.log(`✅ User updated: ${user.id}`)
    }

    console.log(`✅ User found/created: ${user.id} (Telegram ID: ${user.telegramId}, Timezone: ${user.timezone})`)

    // Try to add user to group if chatId provided
    if (chatId) {
      try {
        console.log(`🔍 Looking for group with chat ID: ${chatId}`)
        
        const chatIdStr = String(chatId)
        // Try string first (SQLite), then BigInt (PostgreSQL)
        let group = await db.group.findFirst({
          where: { telegramChatId: chatIdStr }
        }).catch(async () => {
          try {
            return await db.group.findFirst({
              where: { telegramChatId: BigInt(chatId) as any }
            })
          } catch {
            return null
          }
        })

        if (group) {
          console.log(`✅ Group found: ${group.id} (${group.telegramTitle})`)
          
          // Add user to group if not already a member
          const existingMembership = await db.groupMember.findUnique({
            where: {
              userId_groupId: {
                userId: user.id,
                groupId: group.id
              }
            }
          })

          if (!existingMembership) {
            await db.groupMember.create({
              data: {
                userId: user.id,
                groupId: group.id,
              }
            })
            console.log(`✅ Added user ${user.id} to group ${group.id}`)
          }
        } else {
          console.log(`⚠️ Group not found for chat ID: ${chatId}`)
        }
      } catch (err: any) {
        console.error('❌ Error adding user to group:', err)
      }
    }

    // Get user's groups
    console.log('🔍 Fetching user groups from database...')
    
    const memberships = await db.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: true
      }
    })

    const groups = memberships
      .filter(m => m.group.telegramChatId)
      .map(m => ({
        id: m.group.id,
        telegramChatId: m.group.telegramChatId.toString(),
        telegramTitle: m.group.telegramTitle,
        telegramPhotoUrl: m.group.telegramPhotoUrl,
        tier: m.group.tier,
        joinedAt: m.joinedAt,
      }))

    console.log(`✅ User has ${groups.length} groups:`, groups.map(g => g.telegramTitle))

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

    console.log('📤 Sending response')
    console.log('========================================')
    console.log('🔐 AUTH REQUEST COMPLETED')
    console.log('========================================')

    return NextResponse.json(responseData)
  } catch (error: any) {
    console.error('❌ Error authenticating user:', error.message)
    console.error('========================================')
    return NextResponse.json(
      { error: 'Authentication failed', details: error.message },
      { status: 500 }
    )
  }
}
