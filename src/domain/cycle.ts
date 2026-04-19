import type { CyclePhase, CycleWindow } from './types'
import { addDays, diffInDays, todayDateString } from '../lib/date'

export const MIN_CYCLE_LENGTH_DAYS = 30
export const MAX_CYCLE_LENGTH_DAYS = 365
export const DEFAULT_CYCLE_LENGTH_DAYS = 90

export function clampCycleLengthDays(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_CYCLE_LENGTH_DAYS
  }

  return Math.min(
    MAX_CYCLE_LENGTH_DAYS,
    Math.max(MIN_CYCLE_LENGTH_DAYS, Math.round(value)),
  )
}

export function getCurrentCycleWindow(
  cycleStartDate: string,
  cycleLengthDays: number,
  today = todayDateString(),
): CycleWindow {
  const normalizedLength = clampCycleLengthDays(cycleLengthDays)

  if (cycleStartDate > today) {
    return {
      start: today,
      end: addDays(today, normalizedLength - 1),
    }
  }

  let currentStart = cycleStartDate

  while (addDays(currentStart, normalizedLength - 1) < today) {
    currentStart = addDays(currentStart, normalizedLength)
  }

  return {
    start: currentStart,
    end: addDays(currentStart, normalizedLength - 1),
  }
}

export function getCyclePhase(
  cycleWindow: CycleWindow,
  cycleLengthDays: number,
  today = todayDateString(),
): CyclePhase {
  const normalizedLength = clampCycleLengthDays(cycleLengthDays)
  const currentDate = today > cycleWindow.end ? cycleWindow.end : today
  const progressRatio =
    diffInDays(cycleWindow.start, currentDate) / Math.max(1, normalizedLength)

  if (progressRatio < 1 / 3) {
    return 'build'
  }

  if (progressRatio < 2 / 3) {
    return 'develop'
  }

  return 'competition-prep'
}

export function getCurrentTrainingWeek(
  cycleWindow: CycleWindow,
  today = todayDateString(),
) {
  const currentDate = today > cycleWindow.end ? cycleWindow.end : today
  const offsetDays = diffInDays(cycleWindow.start, currentDate)
  const weekNumber = Math.floor(offsetDays / 7) + 1
  const weekStart = addDays(cycleWindow.start, (weekNumber - 1) * 7)
  const cappedWeekEnd = addDays(weekStart, 6)

  return {
    weekNumber,
    weekStart,
    weekEnd: cappedWeekEnd > cycleWindow.end ? cycleWindow.end : cappedWeekEnd,
  }
}
