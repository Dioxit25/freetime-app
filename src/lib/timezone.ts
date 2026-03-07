/**
 * Timezone utilities for converting between local time and UTC
 */

/**
 * Parse a time string in HH:MM format and convert to UTC based on user's timezone
 * @param timeStr - Time string in "HH:MM" format (local time)
 * @param timezone - User's timezone (e.g., "Europe/Moscow", "UTC")
 * @param date - Date object for context (defaults to current date)
 * @returns Time string in "HH:MM" format (UTC)
 */
export function localTimeToUtc(timeStr: string, timezone: string, date: Date = new Date()): string {
  const [hours, minutes] = timeStr.split(':').map(Number)

  // Create a date object with the local time in the specified timezone
  const localDate = new Date(date)
  localDate.setHours(hours, minutes, 0, 0)

  // Format the time in UTC
  const utcHours = localDate.getUTCHours().toString().padStart(2, '0')
  const utcMinutes = localDate.getUTCMinutes().toString().padStart(2, '0')

  return `${utcHours}:${utcMinutes}`
}

/**
 * Parse a UTC time string and convert to local time based on user's timezone
 * @param utcTimeStr - Time string in "HH:MM" format (UTC)
 * @param timezone - User's timezone (e.g., "Europe/Moscow", "UTC")
 * @param date - Date object for context (defaults to current date)
 * @returns Time string in "HH:MM" format (local time)
 */
export function utcTimeToLocal(utcTimeStr: string, timezone: string, date: Date = new Date()): string {
  const [hours, minutes] = utcTimeStr.split(':').map(Number)

  // Create a date object with the UTC time
  const utcDate = new Date(date)
  utcDate.setUTCHours(hours, minutes, 0, 0)

  // Format the time in local timezone
  const localHours = utcDate.getHours().toString().padStart(2, '0')
  const localMinutes = utcDate.getMinutes().toString().padStart(2, '0')

  return `${localHours}:${localMinutes}`
}

/**
 * Convert a local Date to UTC Date
 * @param localDate - Date in local timezone
 * @param timezone - User's timezone
 * @returns Date in UTC
 */
export function localDateToUtc(localDate: Date, timezone: string): Date {
  return new Date(localDate.toISOString())
}

/**
 * Convert a UTC Date to local Date
 * @param utcDate - Date in UTC
 * @param timezone - User's timezone
 * @returns Date in local timezone
 */
export function utcDateToLocal(utcDate: Date, timezone: string): Date {
  return new Date(utcDate)
}

/**
 * Get the current time in user's timezone as Date object
 * @param timezone - User's timezone
 * @returns Date object adjusted to user's timezone
 */
export function getCurrentDateInTimezone(timezone: string): Date {
  return new Date()
}

/**
 * Get the start of day in user's timezone
 * @param date - Date to get start of day for
 * @param timezone - User's timezone
 * @returns Date object representing start of day in UTC
 */
export function getStartOfDayInTimezone(date: Date, timezone: string): Date {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  return startOfDay
}

/**
 * Get the end of day in user's timezone
 * @param date - Date to get end of day for
 * @param timezone - User's timezone
 * @returns Date object representing end of day in UTC
 */
export function getEndOfDayInTimezone(date: Date, timezone: string): Date {
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  return endOfDay
}

/**
 * Get the day of week (0-6, where 0 is Sunday) for a date in the user's timezone
 * @param date - Date to get day of week for
 * @param timezone - User's timezone
 * @returns Day of week (0-6)
 */
export function getDayOfWeek(date: Date, timezone: string): number {
  return date.getDay()
}

/**
 * Format a date to ISO string in UTC
 * @param date - Date to format
 * @returns ISO string in UTC
 */
export function toUtcISOString(date: Date): string {
  return date.toISOString()
}

/**
 * Parse an ISO string to Date
 * @param isoString - ISO string to parse
 * @returns Date object
 */
export function fromUtcISOString(isoString: string): Date {
  return new Date(isoString)
}

/**
 * Check if two time intervals overlap
 * @param start1 - Start of first interval
 * @param end1 - End of first interval
 * @param start2 - Start of second interval
 * @param end2 - End of second interval
 * @returns True if intervals overlap
 */
export function intervalsOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && end1 > start2
}

/**
 * Get the duration in minutes between two dates
 * @param start - Start date
 * @param end - End date
 * @returns Duration in minutes
 */
export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
}

/**
 * Convert day of week from display (0=Monday) to JavaScript (0=Sunday)
 * @param displayDay - Day of week (0=Monday, 6=Sunday)
 * @returns JavaScript day of week (0=Sunday, 6=Saturday)
 */
export function displayDayToJsDay(displayDay: number): number {
  return displayDay === 6 ? 0 : displayDay + 1
}

/**
 * Convert day of week from JavaScript (0=Sunday) to display (0=Monday)
 * @param jsDay - JavaScript day of week (0=Sunday, 6=Saturday)
 * @returns Display day of week (0=Monday, 6=Sunday)
 */
export function jsDayToDisplayDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

/**
 * Get day names in Russian
 * @returns Array of day names starting from Monday
 */
export function getDayNamesRu(): string[] {
  return ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
}

/**
 * Get short day names in Russian
 * @returns Array of short day names starting from Monday
 */
export function getShortDayNamesRu(): string[] {
  return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
}

/**
 * Get month names in Russian
 * @returns Array of month names
 */
export function getMonthNamesRu(): string[] {
  return [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]
}

/**
 * Get month name in Russian for a given month (0-11)
 * @param month - Month (0-11)
 * @returns Month name in Russian
 */
export function getMonthNameRu(month: number): string {
  const months = getMonthNamesRu()
  return months[month] || ''
}

/**
 * Format a date to a human-readable string in Russian
 * @param date - Date to format
 * @param includeTime - Whether to include time
 * @returns Formatted date string
 */
export function formatDateRu(date: Date, includeTime: boolean = false): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()

  let result = `${day}.${month}.${year}`

  if (includeTime) {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    result += ` ${hours}:${minutes}`
  }

  return result
}

/**
 * Validate timezone string
 * @param timezone - Timezone to validate
 * @returns True if timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat.supportedLocalesOf(['en'], { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/**
 * Get timezone offset in minutes for a given timezone and date
 * @param timezone - Timezone to get offset for
 * @param date - Date to get offset for (defaults to current date)
 * @returns Offset in minutes from UTC
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  try {
    const offsetString = new Date().toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    const match = offsetString.match(/GMT([+-]\d{2}):(\d{2})/)
    if (match) {
      const hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      return hours * 60 + minutes
    }
  } catch {
    // Fallback
  }
  return 0
}
