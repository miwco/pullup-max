import type { BodyweightEntry, CycleWindow, ProgressPoint } from './types'
import { compareDateAsc } from '../lib/date'
import { createId } from '../lib/id'

export function getLatestBodyweightEntry(entries: BodyweightEntry[]) {
  return (
    [...entries].sort((left, right) =>
      compareDateAsc(right.date, left.date),
    )[0] ?? null
  )
}

export function getBodyweightEntryForDate(
  entries: BodyweightEntry[],
  date: string,
) {
  return entries.find((entry) => entry.date === date) ?? null
}

export function upsertBodyweightEntry(
  entries: BodyweightEntry[],
  date: string,
  weightKg: number,
) {
  const existing = getBodyweightEntryForDate(entries, date)

  if (existing) {
    return entries.map((entry) =>
      entry.id === existing.id ? { ...entry, weightKg } : entry,
    )
  }

  return [
    ...entries,
    {
      id: createId('weight'),
      date,
      weightKg,
    },
  ]
}

export function buildBodyweightTrendPoints(
  entries: BodyweightEntry[],
  cycleWindow?: CycleWindow,
): ProgressPoint[] {
  return [...entries]
    .filter((entry) => {
      if (!cycleWindow) {
        return true
      }

      return entry.date >= cycleWindow.start && entry.date <= cycleWindow.end
    })
    .sort((left, right) => compareDateAsc(left.date, right.date))
    .map((entry) => ({
      date: entry.date,
      value: entry.weightKg,
    }))
}

export function getBodyweightSnapshotValue(
  entries: BodyweightEntry[],
  bodyweightTrackingEnabled: boolean,
) {
  if (!bodyweightTrackingEnabled) {
    return undefined
  }

  return getLatestBodyweightEntry(entries)?.weightKg
}
