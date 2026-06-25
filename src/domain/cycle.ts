import type { CyclePhase, CycleWindow } from './types'
import {
  addDays,
  compareDateAsc,
  diffInDays,
  isIsoDateString,
  todayDateString,
} from '../lib/date'

export const MIN_CYCLE_LENGTH_DAYS = 7
export const MAX_CYCLE_LENGTH_DAYS = 365
export const DEFAULT_CYCLE_LENGTH_DAYS = 90
const DEFAULT_PEAK_DAYS = 18
const DEFAULT_BUILD_DAYS = 35
const MIN_PEAK_DAYS = 7
const MAX_PEAK_DAYS = 21
const BUILD_SHARE_BEFORE_PEAK = 0.45

export function clampCycleLengthDays(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_CYCLE_LENGTH_DAYS
  }

  return Math.min(
    MAX_CYCLE_LENGTH_DAYS,
    Math.max(MIN_CYCLE_LENGTH_DAYS, Math.round(value)),
  )
}

export function getCycleEndDateForLength(
  cycleStartDate: string,
  cycleLengthDays: number,
) {
  return addDays(cycleStartDate, clampCycleLengthDays(cycleLengthDays) - 1)
}

export function getCycleLengthDaysFromDates(
  cycleStartDate: string,
  cycleEndDate: string,
) {
  if (
    !isIsoDateString(cycleStartDate) ||
    !isIsoDateString(cycleEndDate) ||
    compareDateAsc(cycleStartDate, cycleEndDate) > 0
  ) {
    return null
  }

  return diffInDays(cycleStartDate, cycleEndDate) + 1
}

export function getCurrentCycleWindow(
  cycleStartDate: string,
  cycleLengthDays: number,
  today = todayDateString(),
  cycleEndDate?: string,
): CycleWindow {
  void today

  const normalizedLength = clampCycleLengthDays(cycleLengthDays)
  const resolvedEndDate =
    typeof cycleEndDate === 'string' &&
    isIsoDateString(cycleEndDate) &&
    compareDateAsc(cycleStartDate, cycleEndDate) <= 0
      ? cycleEndDate
      : getCycleEndDateForLength(cycleStartDate, normalizedLength)

  return {
    start: cycleStartDate,
    end: resolvedEndDate,
  }
}

export function getCyclePhase(
  cycleWindow: CycleWindow,
  cycleLengthDays: number,
  today = todayDateString(),
): CyclePhase {
  const normalizedLength = clampCycleLengthDays(cycleLengthDays)
  const currentDate = today > cycleWindow.end ? cycleWindow.end : today
  const elapsedDays = diffInDays(cycleWindow.start, currentDate) + 1
  const peakDays =
    normalizedLength === DEFAULT_CYCLE_LENGTH_DAYS
      ? DEFAULT_PEAK_DAYS
      : Math.min(
          MAX_PEAK_DAYS,
          Math.max(MIN_PEAK_DAYS, Math.round(normalizedLength * 0.2)),
        )
  const nonPeakDays = Math.max(1, normalizedLength - peakDays)
  const buildDays =
    normalizedLength === DEFAULT_CYCLE_LENGTH_DAYS
      ? DEFAULT_BUILD_DAYS
      : Math.max(1, Math.round(nonPeakDays * BUILD_SHARE_BEFORE_PEAK))

  if (elapsedDays <= buildDays) {
    return 'build'
  }

  if (elapsedDays <= nonPeakDays) {
    return 'develop'
  }

  return 'peak'
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
