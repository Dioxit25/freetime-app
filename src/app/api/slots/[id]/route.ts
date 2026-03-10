import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/slots/[id] - Delete a slot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🗑️ Slot deletion started')

  try {
    const { id } = await params

    console.log('🗑️ Deleting slot:', id)

    // Handle demo user
    if (id.startsWith('demo-slot-')) {
      console.log('✅ Demo slot deletion simulated')
      return NextResponse.json({ success: true, message: 'Demo slot deleted' })
    }

    // Check if slot exists
    const existingSlot = await db.slot.findUnique({
      where: { id }
    })

    if (!existingSlot) {
      console.log('❌ Slot not found:', id)
      return NextResponse.json(
        { error: 'Slot not found' },
        { status: 404 }
      )
    }

    // Delete slot
    await db.slot.delete({
      where: { id }
    })

    console.log('✅ Slot deleted:', id)

    return NextResponse.json({ success: true, message: 'Slot deleted' })
  } catch (error: any) {
    console.error('❌ Error deleting slot:', error)
    return NextResponse.json(
      { error: 'Failed to delete slot', details: error.message },
      { status: 500 }
    )
  }
}

// GET /api/slots/[id] - Get a single slot
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const slot = await db.slot.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            timezone: true,
          }
        }
      }
    })

    if (!slot) {
      return NextResponse.json(
        { error: 'Slot not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(slot)
  } catch (error: any) {
    console.error('❌ Error fetching slot:', error)
    return NextResponse.json(
      { error: 'Failed to fetch slot', details: error.message },
      { status: 500 }
    )
  }
}
