/**
 * Events API - CRUD operations for Event model
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  detectConflicts,
  checkNewEventConflicts,
  shouldBlockConflict
} from '@/lib/conflict-detector'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const groupId = searchParams.get('groupId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')
    const includeGenerated = searchParams.get('includeGenerated') === 'true'
    const timezone = searchParams.get('timezone') || 'UTC'

    // Build query conditions
    let query = `
      SELECT
        e."id",
        e."userId",
        e."groupId",
        e."status",
        e."type",
        e."description",
        e."isAllDay",
        e."startAt",
        e."endAt",
        e."dayOfWeek",
        e."startTime",
        e."endTime",
        e."recurrenceRule",
        e."recurrenceDays",
        e."recurrenceUntil",
        e."version",
        e."lastModifiedBy",
        e."lastModifiedAt",
        e."isGenerated",
        e."category",
        e."createdAt",
        e."updatedAt",
        u."firstName" as "userFirstName",
        u."lastName" as "userLastName"
      FROM "Event" e
      JOIN "User" u ON e."userId" = u."id"
      WHERE 1=1
    `

    const params: any[] = []
    let paramIndex = 1

    if (userId) {
      query += ` AND e."userId" = $${paramIndex++}`
      params.push(userId)
    }

    if (groupId) {
      query += ` AND e."groupId" = $${paramIndex++}`
      params.push(groupId)
    }

    if (startDate) {
      query += ` AND e."startAt" >= $${paramIndex++}`
      params.push(startDate)
    }

    if (endDate) {
      query += ` AND e."endAt" <= $${paramIndex++}`
      params.push(endDate)
    }

    if (status) {
      query += ` AND e."status" = $${paramIndex++}`
      params.push(status)
    }

    if (!includeGenerated) {
      query += ` AND e."isGenerated" = false`
    }

    query += ` ORDER BY e."startAt" ASC`

    const events = await db.$queryRawUnsafe(query, ...params) as any[]

    // Convert BigInt and Date to strings
    const serializedEvents = events.map(event => ({
      ...event,
      startAt: event.startAt ? event.startAt.toISOString() : null,
      endAt: event.endAt ? event.endAt.toISOString() : null,
      recurrenceUntil: event.recurrenceUntil ? event.recurrenceUntil.toISOString() : null,
      lastModifiedAt: event.lastModifiedAt ? event.lastModifiedAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
    }))

    // Serialize BigInt values
    const response = JSON.stringify(serializedEvents, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )

    return new NextResponse(response, {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      groupId,
      type,
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
      status = 'CONFIRMED'
    } = body

    // Validation
    if (!userId || !groupId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, groupId, type' },
        { status: 400 }
      )
    }

    // Validate event type
    if (!['ONE_TIME', 'CYCLIC_WEEKLY', 'CYCLIC_CUSTOM'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      )
    }

    // Validate ONE_TIME events
    if (type === 'ONE_TIME' && (!startAt || !endAt)) {
      return NextResponse.json(
        { error: 'ONE_TIME events require startAt and endAt' },
        { status: 400 }
      )
    }

    // Validate CYCLIC_WEEKLY events
    if (type === 'CYCLIC_WEEKLY' && (dayOfWeek === null || !startTime || !endTime)) {
      return NextResponse.json(
        { error: 'CYCLIC_WEEKLY events require dayOfWeek, startTime, and endTime' },
        { status: 400 }
      )
    }

    // Validate status
    if (!['CONFIRMED', 'CANCELLED', 'DRAFT', 'ARCHIVED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Get user's conflict mode
    const userResult = await db.$queryRaw`
      SELECT "conflictMode" FROM "User" WHERE "id" = ${userId}
    ` as any[]

    const conflictMode = userResult[0]?.conflictMode || 'SOFT'

    // Check for conflicts
    if (type === 'ONE_TIME' && startAt && endAt) {
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
        WHERE e."userId" = ${userId}
          AND e."groupId" = ${groupId}
          AND e."status" != 'CANCELLED'
          AND e."status" != 'ARCHIVED'
          AND e."isGenerated" = false
      ` as any[]

      const newEvent = {
        id: 'new',
        userId,
        groupId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        isAllDay: isAllDay || false,
        status
      }

      const conflicts = checkNewEventConflicts(newEvent, existingEvents, conflictMode)

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

    // Create the event
    const result = await db.$queryRaw`
      INSERT INTO "Event" (
        "userId",
        "groupId",
        "status",
        "type",
        "description",
        "isAllDay",
        "startAt",
        "endAt",
        "dayOfWeek",
        "startTime",
        "endTime",
        "recurrenceRule",
        "recurrenceDays",
        "recurrenceUntil",
        "category",
        "version",
        "lastModifiedAt"
      ) VALUES (
        ${userId},
        ${groupId},
        ${status},
        ${type},
        ${description || null},
        ${isAllDay || false},
        ${startAt ? new Date(startAt) : null},
        ${endAt ? new Date(endAt) : null},
        ${dayOfWeek !== null ? dayOfWeek : null},
        ${startTime || null},
        ${endTime || null},
        ${recurrenceRule || null},
        ${recurrenceDays || null},
        ${recurrenceUntil ? new Date(recurrenceUntil) : null},
        ${category || null},
        1,
        ${new Date()}
      )
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
      headers: { 'Content-Type': 'application/json' },
      status: 201
    })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
