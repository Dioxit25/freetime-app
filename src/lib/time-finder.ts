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
}

export class TimeFinderService {
  /**
   * Find common free time slots for multiple users
   * @param allUsersSlots Array of slot arrays for each user
   * @param daysToLookAhead Number of days to search ahead
   * @param minDuration Minimum duration in minutes
   * @returns Array of common free time slots
   */
  static findCommonFreeTime(
    allUsersSlots: SlotData[][],
    daysToLookAhead: number = 7,
    minDuration: number = 30
  ): TimeSlot[] {
    if (allUsersSlots.length === 0) return []

    const windowStart = new Date()
    windowStart.setHours(0, 0, 0, 0)

    const windowEnd = new Date(windowStart)
    windowEnd.setDate(windowEnd.getDate() + daysToLookAhead)

    // Calculate free intervals for each user
    const usersFreeIntervals: TimeSlot[][] = allUsersSlots.map(slots =>
      this.getUserFreeIntervals(slots, windowStart, windowEnd)
    )

    // Find intersection of all users' free time
    let commonFree = usersFreeIntervals[0] || []

    for (let i = 1; i < usersFreeIntervals.length; i++) {
      commonFree = this.intersectIntervals(commonFree, usersFreeIntervals[i])
    }

    // Filter by minimum duration
    return commonFree.filter(
      slot => (slot.end.getTime() - slot.start.getTime()) >= minDuration * 60 * 1000
    )
  }

  /**
   * Get free intervals for a single user
   */
  private static getUserFreeIntervals(
    slots: SlotData[],
    windowStart: Date,
    windowEnd: Date
  ): TimeSlot[] {
    const busyIntervals = this.getBusyIntervals(slots, windowStart, windowEnd)
    const mergedBusy = this.mergeIntervals(busyIntervals)
    return this.invertIntervals(mergedBusy, windowStart, windowEnd)
  }

  /**
   * Get all busy intervals from slots within time window
   */
  private static getBusyIntervals(
    slots: SlotData[],
    windowStart: Date,
    windowEnd: Date
  ): TimeSlot[] {
    const busy: TimeSlot[] = []

    slots.forEach(slot => {
      if (slot.type === 'ONE_TIME' && slot.startAt && slot.endAt) {
        const start = new Date(slot.startAt)
        const end = new Date(slot.endAt)

        // Only include if it overlaps with our window
        if (end > windowStart && start < windowEnd) {
          busy.push({
            start: new Date(Math.max(start.getTime(), windowStart.getTime())),
            end: new Date(Math.min(end.getTime(), windowEnd.getTime()))
          })
        }
      } else if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek !== undefined) {
        const [sh, sm] = (slot.startTimeLocal || '09:00').split(':').map(Number)
        const [eh, em] = (slot.endTimeLocal || '18:00').split(':').map(Number)

        let curr = new Date(windowStart)
        while (curr < windowEnd) {
          if (curr.getDay() === slot.dayOfWeek) {
            const start = new Date(curr)
            start.setHours(sh, sm, 0, 0)

            const end = new Date(curr)
            end.setHours(eh, em, 0, 0)

            if (end > windowStart && start < windowEnd) {
              busy.push({
                start: new Date(Math.max(start.getTime(), windowStart.getTime())),
                end: new Date(Math.min(end.getTime(), windowEnd.getTime()))
              })
            }
          }
          curr.setDate(curr.getDate() + 1)
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
