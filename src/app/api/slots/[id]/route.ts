import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/slots/[id] - Delete a slot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // For MVP, use a demo user ID
    const userId = 'demo-user-id'

    // Verify slot belongs to user and delete it
    const result = await db.slot.deleteMany({
      where: {
        id,
        userId,
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('Error deleting slot:', error)
    return NextResponse.json(
      { error: 'Failed to delete slot', details: String(error) },
      { status: 500 }
    )
  }
}
