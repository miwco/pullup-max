import { describe, expect, it } from 'vitest'
import {
  buildPainTrendPoints,
  getDaysSinceLastMax,
  getDaysSinceLastWorkout,
  getFailurePointPattern,
} from '../domain/selectors'
import type { MaxTestResult, WorkoutSession } from '../domain/types'

function makeSession(
  id: string,
  date: string,
  overrides: Partial<WorkoutSession> = {},
): WorkoutSession {
  return {
    id,
    date,
    sessionType: 'support',
    notes: '',
    ...overrides,
  }
}

function makeMaxTest(
  id: string,
  sessionId: string,
  reps: number,
  overrides: Partial<MaxTestResult> = {},
): MaxTestResult {
  return {
    id,
    workoutSessionId: sessionId,
    movement: 'Pull-up',
    reps,
    trendClassification: 'stable',
    ...overrides,
  }
}

describe('getDaysSinceLastWorkout', () => {
  it('returns null when there are no sessions', () => {
    expect(getDaysSinceLastWorkout([], '2026-04-19')).toBeNull()
  })

  it('returns 0 when the last session is today', () => {
    const sessions = [makeSession('s1', '2026-04-19')]
    expect(getDaysSinceLastWorkout(sessions, '2026-04-19')).toBe(0)
  })

  it('returns the correct day count from the most recent session', () => {
    const sessions = [
      makeSession('s1', '2026-04-10'),
      makeSession('s2', '2026-04-15'),
      makeSession('s3', '2026-04-08'),
    ]
    expect(getDaysSinceLastWorkout(sessions, '2026-04-19')).toBe(4)
  })
})

describe('getDaysSinceLastMax', () => {
  it('returns null when there are no max tests', () => {
    expect(getDaysSinceLastMax([], [], 'Pull-up', '2026-04-19')).toBeNull()
  })

  it('returns null when max tests exist but no matching sessions', () => {
    const maxTests = [makeMaxTest('mt1', 'missing-session', 10)]
    expect(getDaysSinceLastMax([], maxTests, 'Pull-up', '2026-04-19')).toBeNull()
  })

  it('ignores max tests for a different movement', () => {
    const sessions = [makeSession('s1', '2026-04-15')]
    const maxTests = [makeMaxTest('mt1', 's1', 10, { movement: 'Chin-up' })]
    expect(getDaysSinceLastMax(sessions, maxTests, 'Pull-up', '2026-04-19')).toBeNull()
  })

  it('returns days since the most recent max test session', () => {
    const sessions = [
      makeSession('s1', '2026-04-10'),
      makeSession('s2', '2026-04-15'),
    ]
    const maxTests = [
      makeMaxTest('mt1', 's1', 10),
      makeMaxTest('mt2', 's2', 12),
    ]
    expect(getDaysSinceLastMax(sessions, maxTests, 'Pull-up', '2026-04-19')).toBe(4)
  })
})

describe('getFailurePointPattern', () => {
  function makeHistoryItem(
    id: string,
    date: string,
    reps: number,
    failurePoint?: 'top' | 'middle' | 'start/bottom' | 'grip' | 'not sure',
  ) {
    return {
      id,
      date,
      reps,
      repDelta: null,
      bodyweightDeltaKg: null,
      trend: 'stable' as const,
      ...(failurePoint ? { failurePoint } : {}),
    }
  }

  it('returns null when fewer than 2 tests have failure points', () => {
    const history = [
      makeHistoryItem('1', '2026-04-19', 12),
      makeHistoryItem('2', '2026-04-08', 11, 'top'),
    ]
    expect(getFailurePointPattern(history)).toBeNull()
  })

  it('returns null when failure points in the last 3 do not repeat', () => {
    const history = [
      makeHistoryItem('1', '2026-04-19', 12, 'top'),
      makeHistoryItem('2', '2026-04-08', 11, 'middle'),
      makeHistoryItem('3', '2026-03-28', 10, 'start/bottom'),
    ]
    expect(getFailurePointPattern(history)).toBeNull()
  })

  it('ignores "not sure" as a repeating failure point', () => {
    const history = [
      makeHistoryItem('1', '2026-04-19', 12, 'not sure'),
      makeHistoryItem('2', '2026-04-08', 11, 'not sure'),
      makeHistoryItem('3', '2026-03-28', 10, 'not sure'),
    ]
    expect(getFailurePointPattern(history)).toBeNull()
  })

  it('returns the repeating point and count when 2 of last 3 match', () => {
    const history = [
      makeHistoryItem('1', '2026-04-19', 12, 'top'),
      makeHistoryItem('2', '2026-04-08', 11, 'top'),
      makeHistoryItem('3', '2026-03-28', 10, 'middle'),
    ]
    const result = getFailurePointPattern(history)
    expect(result).toEqual({ point: 'top', count: 2 })
  })

  it('returns count 3 when all three of the last tests share the same failure point', () => {
    const history = [
      makeHistoryItem('1', '2026-04-19', 12, 'grip'),
      makeHistoryItem('2', '2026-04-08', 11, 'grip'),
      makeHistoryItem('3', '2026-03-28', 10, 'grip'),
    ]
    const result = getFailurePointPattern(history)
    expect(result).toEqual({ point: 'grip', count: 3 })
  })
})

describe('buildPainTrendPoints', () => {
  const cycleWindow = { start: '2026-04-01', end: '2026-06-30' }

  it('returns an empty array when no sessions have pain data', () => {
    const sessions = [
      makeSession('s1', '2026-04-10'),
      makeSession('s2', '2026-04-15'),
    ]
    expect(buildPainTrendPoints(sessions, cycleWindow)).toEqual([])
  })

  it('excludes sessions outside the cycle window', () => {
    const sessions = [
      makeSession('s1', '2026-03-20', { elbowPain: 3 }),
      makeSession('s2', '2026-07-10', { elbowPain: 4 }),
    ]
    expect(buildPainTrendPoints(sessions, cycleWindow)).toEqual([])
  })

  it('groups multiple sessions in the same week and averages their pain scores', () => {
    const sessions = [
      makeSession('s1', '2026-04-07', { elbowPain: 2 }),
      makeSession('s2', '2026-04-09', { elbowPain: 4 }),
    ]
    const result = buildPainTrendPoints(sessions, cycleWindow)
    expect(result).toHaveLength(1)
    expect(result[0]!.elbowAvg).toBe(3)
  })

  it('keeps elbow and shoulder averages separate', () => {
    const sessions = [
      makeSession('s1', '2026-04-07', { elbowPain: 2, shoulderPain: 4 }),
      makeSession('s2', '2026-04-09', { elbowPain: 4 }),
    ]
    const result = buildPainTrendPoints(sessions, cycleWindow)
    expect(result).toHaveLength(1)
    expect(result[0]!.elbowAvg).toBe(3)
    expect(result[0]!.shoulderAvg).toBe(4)
  })

  it('returns null for a pain type with no data in a given week', () => {
    const sessions = [makeSession('s1', '2026-04-07', { shoulderPain: 2 })]
    const result = buildPainTrendPoints(sessions, cycleWindow)
    expect(result[0]!.elbowAvg).toBeNull()
    expect(result[0]!.shoulderAvg).toBe(2)
  })

  it('returns points sorted by week start date ascending', () => {
    const sessions = [
      makeSession('s1', '2026-04-21', { elbowPain: 3 }),
      makeSession('s2', '2026-04-07', { elbowPain: 1 }),
    ]
    const result = buildPainTrendPoints(sessions, cycleWindow)
    expect(result).toHaveLength(2)
    expect(result[0]!.elbowAvg).toBe(1)
    expect(result[1]!.elbowAvg).toBe(3)
  })
})
