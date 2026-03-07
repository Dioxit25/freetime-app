/**
 * Conflict Detector - Detects time conflicts between events
 */

import { intervalsOverlap } from './timezone'

export interface ConflictEvent {
  id: string
  userId: string
  groupId: string
  startAt: Date | null
  endAt: Date | null
  isAllDay: boolean
  status: 'CONFIRMED' | 'CANCELLED' | 'DRAFT' | 'ARCHIVED'
}

export interface Conflict {
  eventId1: string
  eventId2: string
  userId: string
  groupId: string
  startTime: Date
  endTime: Date
  severity: 'WARNING' | 'ERROR'
  message: string
}

/**
 * Check for conflicts between events
 * @param events - Events to check for conflicts
 * @param mode - Conflict mode: 'HARD' (error) or 'SOFT' (warning)
 * @returns Array of conflicts
 */
export function detectConflicts(
  events: ConflictEvent[],
  mode: 'HARD' | 'SOFT' = 'SOFT'
): Conflict[] {
  const conflicts: Conflict[] = []

  // Filter out cancelled and archived events
  const activeEvents = events.filter(
    event => event.status !== 'CANCELLED' && event.status !== 'ARCHIVED'
  )

  // Group by user
  const eventsByUser = new Map<string, ConflictEvent[]>()
  for (const event of activeEvents) {
    if (!eventsByUser.has(event.userId)) {
      eventsByUser.set(event.userId, [])
    }
    eventsByUser.get(event.userId)!.push(event)
  }

  // Check conflicts for each user
  for (const [userId, userEvents] of eventsByUser) {
    const userConflicts = checkUserConflicts(userEvents, mode)
    conflicts.push(...userConflicts)
  }

  return conflicts
}

/**
 * Check conflicts for a single user's events
 */
function checkUserConflicts(
  events: ConflictEvent[],
  mode: 'HARD' | 'SOFT'
): Conflict[] {
  const conflicts: Conflict[] = []

  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => {
    if (!a.startAt || !b.startAt) return 0
    return a.startAt.getTime() - b.startAt.getTime()
  })

  // Check each event against all subsequent events
  for (let i = 0; i < sortedEvents.length; i++) {
    const event1 = sortedEvents[i]

    if (!event1.startAt || !event1.endAt) continue

    for (let j = i + 1; j < sortedEvents.length; j++) {
      const event2 = sortedEvents[j]

      if (!event2.startAt || !event2.endAt) continue

      // If event2 starts after event1 ends, no more conflicts possible
      if (event2.startAt >= event1.endAt) break

      // Check for overlap
      if (intervalsOverlap(event1.startAt, event1.endAt, event2.startAt, event2.endAt)) {
        // Check if either event is all-day
        const allDayConflict = event1.isAllDay || event2.isAllDay

        // In HARD mode, all conflicts are errors
        // In SOFT mode, all-day conflicts are warnings, others are errors
        const severity = mode === 'HARD' ? 'ERROR' : (allDayConflict ? 'WARNING' : 'ERROR')

        conflicts.push({
          eventId1: event1.id,
          eventId2: event2.id,
          userId: event1.userId,
          groupId: event1.groupId,
          startTime: event1.startAt < event2.startAt ? event1.startAt : event2.startAt,
          endTime: event1.endAt > event2.endAt ? event1.endAt : event2.endAt,
          severity,
          message: getConflictMessage(event1, event2, severity)
        })
      }
    }
  }

  return conflicts
}

/**
 * Generate a human-readable conflict message
 */
function getConflictMessage(
  event1: ConflictEvent,
  event2: ConflictEvent,
  severity: 'WARNING' | 'ERROR'
): string {
  if (event1.isAllDay && event2.isAllDay) {
    return 'Оба события занимают весь день'
  } else if (event1.isAllDay || event2.isAllDay) {
    return 'Одно из событий занимает весь день'
  } else {
    return 'Время событий пересекается'
  }
}

/**
 * Check if a new event conflicts with existing events
 * @param newEvent - New event to check
 * @param existingEvents - Existing events in the same group
 * @param mode - Conflict mode
 * @returns Array of conflicts
 */
export function checkNewEventConflicts(
  newEvent: ConflictEvent,
  existingEvents: ConflictEvent[],
  mode: 'HARD' | 'SOFT' = 'SOFT'
): Conflict[] {
  // Combine new event with existing events
  const allEvents = [...existingEvents, newEvent]

  // Find conflicts involving the new event
  const allConflicts = detectConflicts(allEvents, mode)

  return allConflicts.filter(
    conflict => conflict.eventId1 === newEvent.id || conflict.eventId2 === newEvent.id
  )
}

/**
 * Check if a specific time slot is free for a user
 * @param userId - User ID
 * @param groupId - Group ID
 * @param startTime - Start of time slot
 * @param endTime - End of time slot
 * @param existingEvents - Existing events
 * @param excludeEventId - Event ID to exclude from check (for updates)
 * @returns True if slot is free
 */
export function isTimeSlotFree(
  userId: string,
  groupId: string,
  startTime: Date,
  endTime: Date,
  existingEvents: ConflictEvent[],
  excludeEventId?: string
): boolean {
  for (const event of existingEvents) {
    // Skip excluded event
    if (excludeEventId && event.id === excludeEventId) continue

    // Skip if different user or group
    if (event.userId !== userId || event.groupId !== groupId) continue

    // Skip cancelled or archived events
    if (event.status === 'CANCELLED' || event.status === 'ARCHIVED') continue

    // Skip events without times
    if (!event.startAt || !event.endAt) continue

    // Check for overlap
    if (intervalsOverlap(startTime, endTime, event.startAt, event.endAt)) {
      return false
    }
  }

  return true
}

/**
 * Get conflicting events for a specific time range
 * @param userId - User ID
 * @param groupId - Group ID
 * @param startTime - Start of time range
 * @param endTime - End of time range
 * @param existingEvents - Existing events
 * @returns Array of conflicting events
 */
export function getConflictingEventsInRange(
  userId: string,
  groupId: string,
  startTime: Date,
  endTime: Date,
  existingEvents: ConflictEvent[]
): ConflictEvent[] {
  return existingEvents.filter(event => {
    // Filter by user and group
    if (event.userId !== userId || event.groupId !== groupId) return false

    // Skip cancelled or archived events
    if (event.status === 'CANCELLED' || event.status === 'ARCHIVED') return false

    // Skip events without times
    if (!event.startAt || !event.endAt) return false

    // Check for overlap
    return intervalsOverlap(startTime, endTime, event.startAt, event.endAt)
  })
}

/**
 * Check if two specific events conflict
 * @param event1 - First event
 * @param event2 - Second event
 * @returns True if events conflict
 */
export function eventsConflict(event1: ConflictEvent, event2: ConflictEvent): boolean {
  // Skip if either is cancelled or archived
  if (event1.status === 'CANCELLED' || event1.status === 'ARCHIVED') return false
  if (event2.status === 'CANCELLED' || event2.status === 'ARCHIVED') return false

  // Skip if either has no time
  if (!event1.startAt || !event1.endAt || !event2.startAt || !event2.endAt) return false

  // Check for overlap
  return intervalsOverlap(event1.startAt, event1.endAt, event2.startAt, event2.endAt)
}

/**
 * Get the overlap duration between two events
 * @param event1 - First event
 * @param event2 - Second event
 * @returns Overlap duration in minutes, or 0 if no overlap
 */
export function getOverlapDuration(event1: ConflictEvent, event2: ConflictEvent): number {
  if (!eventsConflict(event1, event2) || !event1.startAt || !event1.endAt || !event2.startAt || !event2.endAt) {
    return 0
  }

  const overlapStart = event1.startAt > event2.startAt ? event1.startAt : event2.startAt
  const overlapEnd = event1.endAt < event2.endAt ? event1.endAt : event2.endAt

  return Math.max(0, overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60)
}

/**
 * Check if a conflict should be blocked based on severity and mode
 * @param conflict - Conflict to check
 * @param mode - Conflict mode
 * @returns True if conflict should block the action
 */
export function shouldBlockConflict(
  conflict: Conflict,
  mode: 'HARD' | 'SOFT' = 'SOFT'
): boolean {
  if (mode === 'HARD') {
    // HARD mode: block all conflicts
    return true
  } else {
    // SOFT mode: block only ERROR severity
    return conflict.severity === 'ERROR'
  }
}
