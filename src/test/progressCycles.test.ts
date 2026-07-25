import { describe, expect, it } from 'vitest'
import { createSeedData } from '../domain/defaults'
import {
  getProgressCycleOptions,
  getProgressScope,
} from '../domain/progressCycles'

describe('progress cycle views', () => {
  it('orders the current cycle before completed cycles and filters their data', () => {
    const data = createSeedData('2026-07-01')
    data.cycleHistory = [
      {
        id: 'cycle-jan',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        lengthDays: 90,
        completedAt: '2026-04-01T08:00:00.000Z',
      },
      {
        id: 'cycle-apr',
        startDate: '2026-04-01',
        endDate: '2026-06-29',
        lengthDays: 90,
        completedAt: '2026-07-01T08:00:00.000Z',
      },
    ]
    data.sessions = [
      {
        id: 'max-jan',
        date: '2026-01-10',
        sessionType: 'max',
        notes: '',
      },
      {
        id: 'support-feb',
        date: '2026-02-10',
        sessionType: 'support',
        notes: '',
      },
      {
        id: 'max-may',
        date: '2026-05-10',
        sessionType: 'max',
        notes: '',
      },
      {
        id: 'max-jul',
        date: '2026-07-10',
        sessionType: 'max',
        notes: '',
      },
    ]
    data.maxTests = [
      {
        id: 'test-jan',
        workoutSessionId: 'max-jan',
        reps: 5,
        movement: 'Pull-up',
        trendClassification: 'stable',
      },
      {
        id: 'test-may',
        workoutSessionId: 'max-may',
        reps: 7,
        movement: 'Pull-up',
        trendClassification: 'rising',
      },
      {
        id: 'test-jul',
        workoutSessionId: 'max-jul',
        reps: 8,
        movement: 'Pull-up',
        trendClassification: 'rising',
      },
    ]

    const cycles = getProgressCycleOptions(data)

    expect(cycles.map((cycle) => cycle.id)).toEqual([
      'current',
      'cycle-apr',
      'cycle-jan',
    ])

    const aprilCycle = getProgressScope(data, cycles[1]!, '2026-07-25')
    expect(aprilCycle.maxPoints).toEqual([
      {
        date: '2026-05-10',
        value: 7,
      },
    ])
    expect(aprilCycle.workouts.map((workout) => workout.id)).toEqual([
      'max-may',
    ])

    const lifetime = getProgressScope(data, null, '2026-07-25')
    expect(lifetime.firstMax).toBe(5)
    expect(lifetime.latestMax).toBe(8)
    expect(lifetime.bestMax).toBe(8)
    expect(lifetime.changeFromFirstMax).toBe(3)
    expect(lifetime.maxSessions).toBe(3)
    expect(lifetime.supportSessions).toBe(1)
  })
})
