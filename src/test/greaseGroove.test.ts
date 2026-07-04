import { describe, expect, it } from 'vitest'
import { createSeedData } from '../domain/defaults'
import {
  getDaysSinceLastWorkout,
  withComputedRecommendation,
} from '../domain/selectors'
import {
  getGreaseGrooveTrainingLoadPoints,
  getWeeklyVolumeSummary,
} from '../domain/volume'

describe('greasing-the-groove logic', () => {
  it('weights GG reps at one fifth of a normal pull-up rep', () => {
    expect(getGreaseGrooveTrainingLoadPoints(5)).toBe(1)
    expect(getGreaseGrooveTrainingLoadPoints(7)).toBe(1.4)
  })

  it('adds GG entries inside the active week to training load', () => {
    const data = createSeedData('2026-04-01')
    const summary = getWeeklyVolumeSummary({
      cycleWindow: { start: '2026-04-01', end: '2026-06-29' },
      exercises: data.exercises,
      exerciseEntries: [],
      greaseGrooveEntries: [
        {
          id: 'gg-current',
          date: '2026-04-02',
          reps: 6,
          loggedAt: '2026-04-02T12:00:00.000Z',
        },
        {
          id: 'gg-later',
          date: '2026-04-09',
          reps: 20,
          loggedAt: '2026-04-09T12:00:00.000Z',
        },
      ],
      maxTests: [],
      sessions: [],
      today: '2026-04-02',
      phase: 'build',
      trend: 'stable',
    })

    expect(summary.completedPoints).toBe(1.2)
  })

  it('treats GG as recent pull-up work for max-day freshness', () => {
    const data = createSeedData('2026-04-19')
    data.sessions = [
      {
        id: 'max-session',
        date: '2026-04-10',
        sessionType: 'max',
        notes: '',
      },
    ]
    data.maxTests = [
      {
        id: 'max-test',
        workoutSessionId: 'max-session',
        reps: 10,
        movement: 'Pull-up',
        trendClassification: 'stable',
      },
    ]
    data.greaseGrooveEntries = [
      {
        id: 'gg-today',
        date: '2026-04-19',
        reps: 4,
        loggedAt: '2026-04-19T09:00:00.000Z',
      },
    ]

    expect(
      getDaysSinceLastWorkout(
        data.sessions,
        '2026-04-19',
        data.greaseGrooveEntries,
      ),
    ).toBe(0)

    const computed = withComputedRecommendation(data, '2026-04-19')
    expect(computed.recommendationState.maxReadinessSatisfied).toBe(false)
    expect(computed.recommendationState.nextSessionType).toBe('support')
  })
})
