import { fromZonedTime, toZonedTime } from 'date-fns-tz'

// Time slot interface
export interface TimeSlot {
  start: Date
  end: Date
}

// Slot data from database
export interface SlotData {
  type: 'ONE_TIME' | 'CYCLIC_WEEKLY'
  startAt?: Date
  endAt?: Date
  dayOfWeek?: number
  startTimeLocal?: string
  endTimeLocal?: string
  timezone?: string  // Timezone пользователя (например, "Europe/Moscow")
}

export class TimeFinderService {
  /**
   * Find common free time slots for multiple users
   * @param allUsersSlots Array of slot arrays for each user
   * @param daysToLookAhead Number of days to search ahead
   * @param minDuration Minimum duration in minutes
   * @param serverTimezone Timezone сервера (по умолчанию UTC)
   * @returns Array of common free time slots (sorted by start time in UTC)
   */
  static findCommonFreeTime(
    allUsersSlots: SlotData[][],
    daysToLookAhead: number = 7,
    minDuration: number = 30,
    serverTimezone: string = 'UTC'
  ): TimeSlot[] {
    if (allUsersSlots.length === 0) return []

    // Используем UTC для временного окна
    const windowStart = new Date()
    windowStart.setMinutes(0, 0, 0)

    const windowEnd = new Date(windowStart)
    windowEnd.setDate(windowEnd.getDate() + daysToLookAhead)
    windowEnd.setHours(23, 59, 59, 999)

    console.log('Time window (UTC):', {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
      serverTimezone
    })

    // Calculate free intervals for each user
    const usersFreeIntervals: TimeSlot[][] = allUsersSlots.map((slots, userIndex) => {
      console.log(`Processing user ${userIndex + 1} with ${slots.length} slots`)
      return this.getUserFreeIntervals(slots, windowStart, windowEnd, serverTimezone)
    })

    // Find intersection of all users' free time
    let commonFree = usersFreeIntervals[0] || []
    console.log(`User 1 has ${commonFree.length} free intervals`)

    for (let i = 1; i < usersFreeIntervals.length; i++) {
      console.log(`User ${i + 1} has ${usersFreeIntervals[i].length} free intervals`)
      commonFree = this.intersectIntervals(commonFree, usersFreeIntervals[i])
      console.log(`After intersection with user ${i + 1}: ${commonFree.length} intervals`)
    }

    // Filter by minimum duration
    const filtered = commonFree.filter(
      slot => (slot.end.getTime() - slot.start.getTime()) >= minDuration * 60 * 1000
    )

    console.log(`After min duration filter (${minDuration}min): ${filtered.length} intervals`)

    return filtered
  }

  /**
   * Get free intervals for a single user
   */
  private static getUserFreeIntervals(
    slots: SlotData[],
    windowStart: Date,
    windowEnd: Date,
    serverTimezone: string
  ): TimeSlot[] {
    const busyIntervals = this.getBusyIntervals(slots, windowStart, windowEnd, serverTimezone)
    console.log(`  Found ${busyIntervals.length} busy intervals`)
    busyIntervals.forEach((interval, i) => {
      console.log(`    Busy ${i + 1}: ${interval.start.toISOString()} - ${interval.end.toISOString()}`)
    })

    const mergedBusy = this.mergeIntervals(busyIntervals)
    console.log(`  After merge: ${mergedBusy.length} busy intervals`)

    const freeIntervals = this.invertIntervals(mergedBusy, windowStart, windowEnd)
    console.log(`  Free intervals: ${freeIntervals.length}`)

    return freeIntervals
  }

  /**
   * Get all busy intervals from slots within time window
   * Converts local times to UTC considering timezone
   */
  private static getBusyIntervals(
    slots: SlotData[],
    windowStart: Date,
    windowEnd: Date,
    serverTimezone: string
  ): TimeSlot[] {
    const busy: TimeSlot[] = []

    slots.forEach(slot => {
      if (slot.type === 'ONE_TIME' && slot.startAt && slot.endAt) {
        // ONE_TIME слоты уже в UTC
        const start = new Date(slot.startAt)
        const end = new Date(slot.endAt)

        if (end > windowStart && start < windowEnd) {
          busy.push({
            start: new Date(Math.max(start.getTime(), windowStart.getTime())),
            end: new Date(Math.min(end.getTime(), windowEnd.getTime()))
          })
        }
      } else if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek !== undefined) {
        const [sh, sm] = (slot.startTimeLocal || '09:00').split(':').map(Number)
        const [eh, em] = (slot.endTimeLocal || '18:00').split(':').map(Number)
        
        // Timezone слота или fallback на UTC
        const slotTimezone = slot.timezone || 'UTC'

        console.log(`  CYCLIC_WEEKLY: dayOfWeek=${slot.dayOfWeek}, time=${sh}:${sm}-${eh}:${em}, tz=${slotTimezone}`)

        // Итерируем по дням в окне
        let curr = new Date(windowStart)
        curr.setUTCHours(0, 0, 0, 0)

        while (curr < windowEnd) {
          // Получаем день недели в timezone пользователя
          const currInTz = toZonedTime(curr, slotTimezone)
          const dayOfWeekInTz = currInTz.getDay()

          if (dayOfWeekInTz === slot.dayOfWeek) {
            // Создаём время в timezone пользователя
            const dateStr = currInTz.getFullYear() + '-' + 
              String(currInTz.getMonth() + 1).padStart(2, '0') + '-' + 
              String(currInTz.getDate()).padStart(2, '0')
            
            // Создаём локальное время начала и конца
            const localStartStr = `${dateStr}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`
            const localEndStr = `${dateStr}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`
            
            // Конвертируем в UTC
            const localDateStart = new Date(localStartStr)
            const localDateEnd = new Date(localEndStr)
            
            const startUtc = fromZonedTime(localDateStart, slotTimezone)
            let endUtc = fromZonedTime(localDateEnd, slotTimezone)

            // Обработка overnight слотов (например, 22:00 - 06:00)
            if (eh < sh || (eh === sh && em < sm)) {
              // Если конец раньше начала, значит слот переходит на следующий день
              const nextDay = new Date(localDateEnd)
              nextDay.setDate(nextDay.getDate() + 1)
              endUtc = fromZonedTime(nextDay, slotTimezone)
            }

            // Проверяем, что слот попадает в окно
            if (endUtc > windowStart && startUtc < windowEnd) {
              busy.push({
                start: new Date(Math.max(startUtc.getTime(), windowStart.getTime())),
                end: new Date(Math.min(endUtc.getTime(), windowEnd.getTime()))
              })
              
              console.log(`    Created busy interval: ${startUtc.toISOString()} - ${endUtc.toISOString()} (from ${slotTimezone})`)
            }
          }
          curr.setUTCDate(curr.getUTCDate() + 1)
        }
      }
    })

    return busy
  }

  /**
   * Merge overlapping intervals
   */
  private static mergeIntervals(intervals: TimeSlot[]): TimeSlot[] {
    if (intervals.length === 0) return []

    // Sort by start time
    const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime())

    const merged: TimeSlot[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1]
      const current = sorted[i]

      // If current interval overlaps with last merged interval, merge them
      if (current.start <= last.end) {
        last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()))
      } else {
        merged.push(current)
      }
    }

    return merged
  }

  /**
   * Invert intervals to get free time
   */
  private static invertIntervals(
    busy: TimeSlot[],
    windowStart: Date,
    windowEnd: Date
  ): TimeSlot[] {
    const free: TimeSlot[] = []
    let pointer = new Date(windowStart)

    for (const slot of busy) {
      if (slot.start > pointer) {
        free.push({
          start: new Date(pointer),
          end: new Date(slot.start)
        })
      }
      pointer = new Date(Math.max(pointer.getTime(), slot.end.getTime()))
    }

    // Add remaining time after last busy slot
    if (pointer < windowEnd) {
      free.push({
        start: new Date(pointer),
        end: new Date(windowEnd)
      })
    }

    return free
  }

  /**
   * Find intersection of two interval lists
   */
  private static intersectIntervals(list1: TimeSlot[], list2: TimeSlot[]): TimeSlot[] {
    const result: TimeSlot[] = []
    let i = 0
    let j = 0

    while (i < list1.length && j < list2.length) {
      const start = new Date(Math.max(list1[i].start.getTime(), list2[j].start.getTime()))
      const end = new Date(Math.min(list1[i].end.getTime(), list2[j].end.getTime()))

      if (start < end) {
        result.push({ start, end })
      }

      if (list1[i].end < list2[j].end) {
        i++
      } else {
        j++
      }
    }

    return result
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`
    }
    return `${mins}м`
  }
}
