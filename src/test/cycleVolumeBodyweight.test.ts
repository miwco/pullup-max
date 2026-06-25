import { describe, expect, it } from 'vitest'
import { addDays } from '../lib/date'
import { createDefaultExercises } from '../domain/defaults'
import {
  clampCycleLengthDays,
  getCycleEndDateForLength,
  getCurrentCycleWindow,
  getCyclePhase,
  getCycleLengthDaysFromDates,
} from '../domain/cycle'
import {
  getBodyweightSnapshotValue,
  upsertBodyweightEntry,
} from '../domain/bodyweight'
import { getEntryVolumePoints, getWeeklyVolumeSummary } from '../domain/volume'

describe('cycle, bodyweight, and volume logic', () => {
  it('clamps cycle length between 30 and 365 days', () => {
    expect(clampCycleLengthDays(10)).toBe(30)
    expect(clampCycleLengthDays(90)).toBe(90)
    expect(clampCycleLengthDays(500)).toBe(365)
  })

  it('builds fixed cycle windows from explicit start and end dates', () => {
    expect(
      getCurrentCycleWindow('2026-01-01', 30, '2026-02-15', '2026-01-30'),
    ).toEqual({
      start: '2026-01-01',
      end: '2026-01-30',
    })
    expect(
      getCurrentCycleWindow('2026-01-01', 90, '2026-02-15', '2026-03-31'),
    ).toEqual({
      start: '2026-01-01',
      end: '2026-03-31',
    })
  })

  it('derives cycle length from start/end and derives end dates from exact day counts', () => {
    expect(getCycleLengthDaysFromDates('2026-04-19', '2026-06-07')).toBe(50)
    expect(getCycleLengthDaysFromDates('2026-04-19', '2026-07-17')).toBe(90)
    expect(getCycleLengthDaysFromDates('2026-04-19', '2026-04-18')).toBeNull()

    expect(getCycleEndDateForLength('2026-04-19', 50)).toBe('2026-06-07')
    expect(getCycleEndDateForLength('2026-04-19', 90)).toBe('2026-07-17')
  })

  it('uses a shorter taper-minded peak instead of equal phase thirds', () => {
    const cycleWindow = getCurrentCycleWindow('2026-01-01', 90, '2026-01-01')

    expect(getCyclePhase(cycleWindow, 90, addDays('2026-01-01', 34))).toBe(
      'build',
    )
    expect(getCyclePhase(cycleWindow, 90, addDays('2026-01-01', 35))).toBe(
      'develop',
    )
    expect(getCyclePhase(cycleWindow, 90, addDays('2026-01-01', 71))).toBe(
      'develop',
    )
    expect(getCyclePhase(cycleWindow, 90, addDays('2026-01-01', 72))).toBe(
      'peak',
    )
  })

  it('replaces same-day bodyweight entries and snapshots the latest saved weight', () => {
    const firstPass = upsertBodyweightEntry([], '2026-04-18', 78.4)
    const updated = upsertBodyweightEntry(firstPass, '2026-04-18', 78.9)
    const withLaterEntry = upsertBodyweightEntry(updated, '2026-04-19', 79.1)

    expect(updated).toHaveLength(1)
    expect(updated[0]?.weightKg).toBe(78.9)
    expect(getBodyweightSnapshotValue(withLaterEntry, true)).toBe(79.1)
    expect(getBodyweightSnapshotValue(withLaterEntry, false)).toBeUndefined()
  })

  it('weights different exercise types into comparable volume points', () => {
    const exercises = createDefaultExercises()
    const exerciseLookup = new Map(
      exercises.map((exercise) => [exercise.id, exercise]),
    )
    const pullUpId = exercises.find(
      (exercise) => exercise.name === 'Pull-up',
    )!.id
    const bandId = exercises.find(
      (exercise) => exercise.name === 'Band-assisted pull-up',
    )!.id
    const topHoldId = exercises.find(
      (exercise) => exercise.name === 'Top hold',
    )!.id

    expect(
      getEntryVolumePoints(
        {
          id: 'entry-1',
          workoutSessionId: 'session-1',
          exerciseId: pullUpId,
          sets: 5,
          reps: 4,
          isMaxTest: false,
        },
        exerciseLookup,
      ),
    ).toBe(20)
    expect(
      getEntryVolumePoints(
        {
          id: 'entry-2',
          workoutSessionId: 'session-1',
          exerciseId: bandId,
          sets: 5,
          reps: 4,
          isMaxTest: false,
        },
        exerciseLookup,
      ),
    ).toBe(15)
    expect(
      getEntryVolumePoints(
        {
          id: 'entry-3',
          workoutSessionId: 'session-1',
          exerciseId: topHoldId,
          sets: 2,
          durationSeconds: 20,
          isMaxTest: false,
        },
        exerciseLookup,
      ),
    ).toBe(8)
    expect(
      getEntryVolumePoints(
        {
          id: 'entry-4',
          workoutSessionId: 'session-1',
          exerciseId: pullUpId,
          sets: 5,
          reps: 4,
          outcome: 'fail',
          isMaxTest: false,
        },
        exerciseLookup,
      ),
    ).toBe(0)
  })

  it('raises weekly volume targets gradually and applies a brake when trend falls', () => {
    const exercises = createDefaultExercises()
    const pullUpId = exercises.find(
      (exercise) => exercise.name === 'Pull-up',
    )!.id

    const sessions = [
      {
        id: 'session-1',
        date: '2026-04-02',
        sessionType: 'support' as const,
        notes: '',
      },
      {
        id: 'session-2',
        date: '2026-04-03',
        sessionType: 'support' as const,
        notes: '',
      },
    ]

    const summaryWithoutBrake = getWeeklyVolumeSummary({
      cycleWindow: {
        start: '2026-04-01',
        end: '2026-06-29',
      },
      exercises,
      exerciseEntries: [],
      maxTests: [],
      sessions: [],
      today: '2026-04-09',
      trend: 'stable',
    })

    expect(summaryWithoutBrake.weekNumber).toBe(2)
    expect(summaryWithoutBrake.targetPoints).toBe(50)
    expect(summaryWithoutBrake.remainingPoints).toBe(50)

    const summaryWithBrake = getWeeklyVolumeSummary({
      cycleWindow: {
        start: '2026-04-01',
        end: '2026-06-29',
      },
      exercises,
      exerciseEntries: [
        {
          id: 'entry-1',
          workoutSessionId: 'session-1',
          exerciseId: pullUpId,
          sets: 8,
          reps: 4,
          isMaxTest: false,
        },
        {
          id: 'entry-2',
          workoutSessionId: 'session-2',
          exerciseId: pullUpId,
          sets: 8,
          reps: 4,
          isMaxTest: false,
        },
      ],
      maxTests: [],
      sessions,
      today: '2026-04-09',
      trend: 'falling',
    })

    expect(summaryWithBrake.brakeApplied).toBe(true)
    expect(summaryWithBrake.targetPoints).toBe(54)
    expect(summaryWithBrake.remainingPoints).toBe(54)
    expect(summaryWithBrake.message).toContain('volume brake')
  })
})
