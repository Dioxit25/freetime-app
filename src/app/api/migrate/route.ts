import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Create default group for existing slots
    const defaultGroup = await prisma.group.upsert({
      where: { telegramChatId: BigInt(0) },
      update: {},
      create: {
        telegramChatId: BigInt(0),
        telegramTitle: 'Personal',
        tier: 'FREE',
      },
    })

    console.log('Default group created:', defaultGroup.id)

    // Update all existing slots to use this group
    const result = await prisma.slot.updateMany({
      where: { groupId: null },
      data: { groupId: defaultGroup.id },
    })

    console.log('Updated slots:', result.count)

    await prisma.$disconnect()

    return NextResponse.json({
      success: true,
      groupId: defaultGroup.id,
      updatedSlots: result.count,
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    await prisma.$disconnect()
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    )
  }
}
