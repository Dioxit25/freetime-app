/**
 * Event API - Operations for a specific event
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkNewEventConflicts, shouldBlockConflict } from '@/lib/conflict-detector'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const result = await db.$queryRaw`
      SELECT
        e.*,
        u."firstName" as "userFirstName",
        u."lastName" as "userLastName"
      FROM "Event" e
      JOIN "User" u ON e."userId" = u."id"
      WHERE e."id" = ${id}
    ` as any[]

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const event = result[0]

    // Serialize response
    const serializedEvent = {
      ...event,
      startAt: event.startAt ? event.startAt.toISOString() : null,
      endAt: event.endAt ? event.endAt.toISOString() : null,
      recurrenceUntil: event.recurrenceUntil ? event.recurrenceUntil.toISOString() : null,
      lastModifiedAt: event.lastModifiedAt ? event.lastModifiedAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
    }

    const response = JSON.stringify(serializedEvent, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )

    return new NextResponse(response, {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const {
      userId,
      status,
      description,
      isAllDay,
      startAt,
      endAt,
      dayOfWeek,
      startTime,
      endTime,
      recurrenceRule,
      recurrenceDays,
      recurrenceUntil,
      category,
      version
    } = body

    // Get current event
    const currentEventResult = await db.$queryRaw`
      SELECT * FROM "Event" WHERE "id" = ${id}
    ` as any[]

    if (currentEventResult.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const currentEvent = currentEventResult[0]

    // Check version for optimistic locking
    if (version !== undefined && currentEvent.version !== version) {
      return NextResponse.json(
        {
          error: 'Event was modified by another user',
          currentVersion: currentEvent.version,
          yourVersion: version
        },
        { status: 409 }
      )
    }

    // Get user's conflict mode
    const userResult = await db.$queryRaw`
      SELECT "conflictMode" FROM "User" WHERE "id" = ${userId || currentEvent.userId}
    ` as any[]

    const conflictMode = userResult[0]?.conflictMode || 'SOFT'

    // Check for conflicts if times are changing
    if (startAt && endAt && (currentEvent.startAt?.toISOString() !== new Date(startAt).toISOString() ||
                               currentEvent.endAt?.toISOString() !== new Date(endAt).toISOString())) {
      const existingEvents = await db.$queryRaw`
        SELECT
          e."id",
          e."userId",
          e."groupId",
          e."startAt",
          e."endAt",
          e."isAllDay",
          e."status"
        FROM "Event" e
        WHERE e."userId" = ${userId || currentEvent.userId}
          AND e."groupId" = ${currentEvent.groupId}
          AND e."status" != 'CANCELLED'
          AND e."status" != 'ARCHIVED'
          AND e."isGenerated" = false
          AND e."id" != ${id}
      ` as any[]

      const updatedEvent = {
        id,
        userId: userId || currentEvent.userId,
        groupId: currentEvent.groupId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        isAllDay: isAllDay !== undefined ? isAllDay : currentEvent.isAllDay,
        status: status || currentEvent.status
      }

      const conflicts = checkNewEventConflicts(updatedEvent, existingEvents, conflictMode)

      // Block if any conflict should be blocked
      const blockingConflict = conflicts.find(c => shouldBlockConflict(c, conflictMode))
      if (blockingConflict) {
        return NextResponse.json(
          {
            error: 'Conflict detected',
            conflict: blockingConflict,
            message: blockingConflict.message
          },
          { status: 409 }
        )
      }
    }

    // Update the event
    const result = await db.$queryRaw`
      UPDATE "Event"
      SET
        "status" = ${status || currentEvent.status},
        "description" = ${description !== undefined ? description : currentEvent.description},
        "isAllDay" = ${isAllDay !== undefined ? isAllDay : currentEvent.isAllDay},
        "startAt" = ${startAt !== undefined ? (startAt ? new Date(startAt) : null) : currentEvent.startAt},
        "endAt" = ${endAt !== undefined ? (endAt ? new Date(endAt) : null) : currentEvent.endAt},
        "dayOfWeek" = ${dayOfWeek !== undefined ? (dayOfWeek !== null ? dayOfWeek : null) : currentEvent.dayOfWeek},
        "startTime" = ${startTime !== undefined ? startTime : currentEvent.startTime},
        "endTime" = ${endTime !== undefined ? endTime : currentEvent.endTime},
        "recurrenceRule" = ${recurrenceRule !== undefined ? recurrenceRule : currentEvent.recurrenceRule},
        "recurrenceDays" = ${recurrenceDays !== undefined ? recurrenceDays : currentEvent.recurrenceDays},
        "recurrenceUntil" = ${recurrenceUntil !== undefined ? (recurrenceUntil ? new Date(recurrenceUntil) : null) : currentEvent.recurrenceUntil},
        "category" = ${category !== undefined ? category : currentEvent.category},
        "version" = ${currentEvent.version + 1},
        "lastModifiedBy" = ${userId || currentEvent.userId},
        "lastModifiedAt" = ${new Date()},
        "updatedAt" = ${new Date()}
      WHERE "id" = ${id}
      RETURNING *
    ` as any[]

    const event = result[0]

    // Serialize response
    const serializedEvent = {
      ...event,
      startAt: event.startAt ? event.startAt.toISOString() : null,
      endAt: event.endAt ? event.endAt.toISOString() : null,
      recurrenceUntil: event.recurrenceUntil ? event.recurrenceUntil.toISOString() : null,
      lastModifiedAt: event.lastModifiedAt ? event.lastModifiedAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
    }

    const response = JSON.stringify(serializedEvent, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )

    return new NextResponse(response, {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Check if event exists
    const existingEvent = await db.$queryRaw`
      SELECT * FROM "Event" WHERE "id" = ${id}
    ` as any[]

    if (existingEvent.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Delete the event (cascade will delete related exceptions and reminders)
    await db.$queryRaw`
      DELETE FROM "Event" WHERE "id" = ${id}
    `

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
