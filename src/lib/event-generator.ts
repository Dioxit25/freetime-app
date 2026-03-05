/**
 * Event Generator - Generates event instances from recurrence rules
 */

import {
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  displayDayToJsDay,
  jsDayToDisplayDay,
  getDurationMinutes,
  toUtcISOString,
  fromUtcISOString
} from './timezone'

export interface GeneratedEvent {
  id: string // Use original event ID + date for uniqueness
  originalEventId: string
  type: 'ONE_TIME' | 'CYCLIC_WEEKLY' | 'CYCLIC_CUSTOM'
  description: string | null
  status: 'CONFIRMED' | 'CANCELLED' | 'DRAFT' | 'ARCHIVED'
  isAllDay: boolean
  startAt: Date | null
  endAt: Date | null
  dayOfWeek: number | null
  startTime: string | null
  endTime: string | null
  category: string | null
  isGenerated: true
  generatedDate: Date // The date this instance was generated for
}

export interface RecurrenceRule {
  type: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'
  days?: number[] // For WEEKLY: [0, 1, 2, 3, 4] for weekdays
  interval?: number // Every N days/weeks/months
  until?: Date // End date for recurrence
}

export interface Event {
  id: string
  userId: string
  groupId: string
  status: 'CONFIRMED' | 'CANCELLED' | 'DRAFT' | 'ARCHIVED'
  type: 'ONE_TIME' | 'CYCLIC_WEEKLY' | 'CYCLIC_CUSTOM'
  description: string | null
  isAllDay: boolean
  startAt: Date | null
  endAt: Date | null
  dayOfWeek: number | null
  startTime: string | null
  endTime: string | null
  recurrenceRule: string | null
  recurrenceDays: string | null
  recurrenceUntil: Date | null
  version: number
  category: string | null
  isGenerated: boolean
}

export interface EventException {
  id: string
  eventId: string
  originalDate: Date
  originalStart: Date | null
  originalEnd: Date | null
  newDate: Date | null
  newStart: Date | null
  newEnd: Date | null
  isCancelled: boolean
}

/**
 * Generate event instances from a recurring event
 * @param event - The recurring event to generate instances for
 * @param startDate - Start of date range to generate for
 * @param endDate - End of date range to generate for
 * @param exceptions - Exceptions for this event
 * @param timezone - User's timezone
 * @returns Array of generated event instances
 */
export function generateEventInstances(
  event: Event,
  startDate: Date,
  endDate: Date,
  exceptions: EventException[] = [],
  timezone: string = 'UTC'
): GeneratedEvent[] {
  const generatedEvents: GeneratedEvent[] = []

  // Only generate for recurring events
  if (event.type === 'ONE_TIME' || !event.recurrenceRule) {
    return generatedEvents
  }

  // Parse recurrence rule
  const rule = parseRecurrenceRule(event.recurrenceRule, event.recurrenceDays, event.recurrenceUntil)

  // Generate instances based on rule type
  switch (rule.type) {
    case 'WEEKLY':
      generatedEvents.push(...generateWeeklyInstances(event, startDate, endDate, rule, timezone))
      break
    case 'BIWEEKLY':
      generatedEvents.push(...generateBiweeklyInstances(event, startDate, endDate, rule, timezone))
      break
    case 'DAILY':
      generatedEvents.push(...generateDailyInstances(event, startDate, endDate, rule, timezone))
      break
    case 'MONTHLY':
      generatedEvents.push(...generateMonthlyInstances(event, startDate, endDate, rule, timezone))
      break
    case 'YEARLY':
      generatedEvents.push(...generateYearlyInstances(event, startDate, endDate, rule, timezone))
      break
    case 'CUSTOM':
      // For custom rules, use recurrenceDays JSON
      generatedEvents.push(...generateCustomInstances(event, startDate, endDate, rule, timezone))
      break
  }

  // Apply exceptions
  return applyExceptions(generatedEvents, exceptions)
}

/**
 * Parse recurrence rule from database format
 */
function parseRecurrenceRule(
  rule: string | null,
  days: string | null,
  until: Date | null
): RecurrenceRule {
  const baseRule: RecurrenceRule = {
    type: rule as RecurrenceRule['type'] || 'WEEKLY',
    interval: 1,
    until: until || undefined
  }

  // Parse days if provided (JSON array)
  if (days) {
    try {
      baseRule.days = JSON.parse(days)
    } catch {
      // Invalid JSON, ignore
    }
  }

  return baseRule
}

/**
 * Generate instances for weekly recurrence
 */
function generateWeeklyInstances(
  event: Event,
  startDate: Date,
  endDate: Date,
  rule: RecurrenceRule,
  timezone: string
): GeneratedEvent[] {
  const instances: GeneratedEvent[] = []
  const days = rule.days || [event.dayOfWeek || 0] // Default to event's day of week

  // Start from the beginning of the range
  let currentDate = new Date(startDate)
  const end = new Date(endDate)

  // Iterate through each week in the range
  while (currentDate <= end) {
    for (const day of days) {
      // Convert display day (0=Monday) to JS day (0=Sunday)
      const jsDay = displayDayToJsDay(day)
      const dayDate = new Date(currentDate)
      const currentDayOfWeek = dayDate.getDay()

      // Calculate days until the target day
      const daysUntilTarget = (jsDay - currentDayOfWeek + 7) % 7
      dayDate.setDate(dayDate.getDate() + daysUntilTarget)

      // Check if within range
      if (dayDate >= startDate && dayDate <= end) {
        // Check recurrence until
        if (rule.until && dayDate > rule.until) {
          continue
        }

        instances.push(createGeneratedEvent(event, dayDate, timezone))
      }
    }

    // Move to next week
    currentDate.setDate(currentDate.getDate() + (rule.interval || 1) * 7)
  }

  return instances
}

/**
 * Generate instances for biweekly recurrence
 */
function generateBiweeklyInstances(
  event: Event,
  startDate: Date,
  endDate: Date,
  rule: RecurrenceRule,
  timezone: string
): GeneratedEvent[] {
  const instances: GeneratedEvent[] = []
  const days = rule.days || [event.dayOfWeek || 0]

  let currentDate = new Date(startDate)
  const end = new Date(endDate)
  let weekCount = 0

  while (currentDate <= end) {
    for (const day of days) {
      const jsDay = displayDayToJsDay(day)
      const dayDate = new Date(currentDate)
      const currentDayOfWeek = dayDate.getDay()
      const daysUntilTarget = (jsDay - currentDayOfWeek + 7) % 7
      dayDate.setDate(dayDate.getDate() + daysUntilTarget)

      if (dayDate >= startDate && dayDate <= end) {
        if (rule.until && dayDate > rule.until) {
          continue
        }

        // Only generate on even/odd weeks based on interval
        if (weekCount % (rule.interval || 2) === 0) {
          instances.push(createGeneratedEvent(event, dayDate, timezone))
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 7)
    weekCount++
  }

  return instances
}

/**
 * Generate instances for daily recurrence
 */
function generateDailyInstances(
  event: Event,
  startDate: Date,
  endDate: Date,
  rule: RecurrenceRule,
  timezone: string
): GeneratedEvent[] {
  const instances: GeneratedEvent[] = []

  let currentDate = new Date(startDate)
  const end = new Date(endDate)

  while (currentDate <= end) {
    if (rule.until && currentDate > rule.until) {
      break
    }

    instances.push(createGeneratedEvent(event, new Date(currentDate), timezone))
    currentDate.setDate(currentDate.getDate() + (rule.interval || 1))
  }

  return instances
}

/**
 * Generate instances for monthly recurrence
 */
function generateMonthlyInstances(
  event: Event,
  startDate: Date,
  endDate: Date,
  rule: RecurrenceRule,
  timezone: string
): GeneratedEvent[] {
  const instances: GeneratedEvent[] = []

  let currentDate = new Date(startDate)
  const end = new Date(endDate)
  const dayOfMonth = startDate.getDate()

  while (currentDate <= end) {
    if (rule.until && currentDate > rule.until) {
      break
    }

    // Set to the same day of month
    const monthDate = new Date(currentDate)
    monthDate.setDate(dayOfMonth)

    if (monthDate >= startDate && monthDate <= end) {
      instances.push(createGeneratedEvent(event, monthDate, timezone))
    }

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + (rule.interval || 1))
  }

  return instances
}

/**
 * Generate instances for yearly recurrence
 */
function generateYearlyInstances(
  event: Event,
  startDate: Date,
  endDate: Date,
  rule: RecurrenceRule,
  timezone: string
): GeneratedEvent[] {
  const instances: GeneratedEvent[] = []

  let currentDate = new Date(startDate)
  const end = new Date(endDate)
  const month = startDate.getMonth()
  const day = startDate.getDate()

  while (currentDate <= end) {
    if (rule.until && currentDate > rule.until) {
      break
    }

    // Set to the same month and day
    const yearDate = new Date(currentDate)
    yearDate.setMonth(month)
    yearDate.setDate(day)

    if (yearDate >= startDate && yearDate <= end) {
      instances.push(createGeneratedEvent(event, yearDate, timezone))
    }

    // Move to next year
    currentDate.setFullYear(currentDate.getFullYear() + (rule.interval || 1))
  }

  return instances
}

/**
 * Generate instances for custom recurrence (using recurrenceDays JSON)
 */
function generateCustomInstances(
  event: Event,
  startDate: Date,
  endDate: Date,
  rule: RecurrenceRule,
  timezone: string
): GeneratedEvent[] {
  const instances: GeneratedEvent[] = []

  // For custom rules, use the days array from rule
  if (!rule.days || rule.days.length === 0) {
    return instances
  }

  return generateWeeklyInstances(event, startDate, endDate, rule, timezone)
}

/**
 * Create a generated event instance for a specific date
 */
function createGeneratedEvent(event: Event, date: Date, timezone: string): GeneratedEvent {
  const startOfDay = getStartOfDayInTimezone(date, timezone)

  // Calculate start and end times based on event type
  let startAt: Date | null = null
  let endAt: Date | null = null

  if (event.isAllDay) {
    // All-day event: occupies the entire day
    startAt = startOfDay
    endAt = getEndOfDayInTimezone(date, timezone)
  } else if (event.startTime && event.endTime) {
    // Time-based event: use the start/end times
    const [startHours, startMinutes] = event.startTime.split(':').map(Number)
    const [endHours, endMinutes] = event.endTime.split(':').map(Number)

    startAt = new Date(startOfDay)
    startAt.setUTCHours(startHours, startMinutes, 0, 0)

    endAt = new Date(startOfDay)
    endAt.setUTCHours(endHours, endMinutes, 0, 0)
  }

  return {
    id: `${event.id}-${toUtcISOString(date).split('T')[0]}`,
    originalEventId: event.id,
    type: event.type,
    description: event.description,
    status: event.status,
    isAllDay: event.isAllDay,
    startAt,
    endAt,
    dayOfWeek: event.dayOfWeek,
    startTime: event.startTime,
    endTime: event.endTime,
    category: event.category,
    isGenerated: true,
    generatedDate: date
  }
}

/**
 * Apply exceptions to generated events
 */
function applyExceptions(
  events: GeneratedEvent[],
  exceptions: EventException[]
): GeneratedEvent[] {
  return events
    .map(event => {
      // Find exception for this date
      const exception = exceptions.find(ex => {
        const exDateStr = toUtcISOString(ex.originalDate).split('T')[0]
        const eventDateStr = toUtcISOString(event.generatedDate).split('T')[0]
        return exDateStr === eventDateStr
      })

      if (!exception) {
        return event
      }

      // If cancelled, filter out this event
      if (exception.isCancelled) {
        return null
      }

      // If rescheduled, update the event
      if (exception.newDate && exception.newStart && exception.newEnd) {
        return {
          ...event,
          startAt: exception.newStart,
          endAt: exception.newEnd,
          generatedDate: exception.newDate
        }
      }

      return event
    })
    .filter((event): event is GeneratedEvent => event !== null)
}

/**
 * Check if an event is recurring
 */
export function isRecurringEvent(event: Event): boolean {
  return event.type === 'CYCLIC_WEEKLY' || event.type === 'CYCLIC_CUSTOM'
}

/**
 * Get the next occurrence of a recurring event after a given date
 */
export function getNextOccurrence(
  event: Event,
  afterDate: Date,
  timezone: string = 'UTC'
): GeneratedEvent | null {
  const futureDate = new Date(afterDate)
  futureDate.setDate(futureDate.getDate() + 1)

  const instances = generateEventInstances(
    event,
    futureDate,
    new Date(futureDate.getTime() + 90 * 24 * 60 * 60 * 1000), // Look ahead 90 days
    [],
    timezone
  )

  return instances.length > 0 ? instances[0] : null
}
