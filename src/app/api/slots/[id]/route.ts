import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/slots/[id] - Delete a slot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete slot using raw SQL
    const result = await db.$queryRaw`
      DELETE FROM "Slot" WHERE "id" = ${id}
      RETURNING "id"
    ` as any[]

    if (result.length === 0) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, deleted: 1 })
  } catch (error: any) {
    console.error('Error deleting slot:', error)
    return NextResponse.json(
      { error: 'Failed to delete slot', details: error.message },
      { status: 500 }
    )
  }
}
