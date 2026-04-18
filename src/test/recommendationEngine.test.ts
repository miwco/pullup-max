import { describe, expect, it } from 'vitest'
import { DEFAULT_SUPPORT_METHODS, createSeedData } from '../domain/defaults'
import {
  classifyTrend,
  createRecommendation,
  getFailurePointPriority,
  getMaxSessionDue,
  getStableExposureCount,
  selectDeloadLevel,
  selectPhase,
} from '../domain/recommendationEngine'
import type { RecommendationInput } from '../domain/types'

function createBaseInput(
  overrides: Partial<RecommendationInput> = {},
): RecommendationInput {
  return {
    availableExercises: [
      'Pull-up',
      'Band-assisted pull-up',
      'Density pull-up block',
      'Ladder pull-up block',
      'Cluster pull-up block',
      'Dead hang',
      'Active hang',
      'Scapular pull-up',
      'Top hold',
      'Negative pull-up',
      'Bottom-pause pull-up',
      'Mid-pause pull-up',
      'Top-half pull-up',
    ],
    cycleAgeDays: 28,
    daysSinceLastMax: 5,
    jointPainAverage: 0,
    lastMaxResults: [
      { date: '2026-04-01', reps: 8 },
      { date: '2026-04-09', reps: 9 },
      { date: '2026-04-17', reps: 10 },
    ],
    mainMovement: 'Pull-up',
    fatigueAverage: 2,
    fatigueSensitivity: 3,
    jointPainSensitivity: 3,
    preferredSupportMethods: DEFAULT_SUPPORT_METHODS,
    repeatedFailurePoint: null,
    sessionsLast7: 2,
    sessionsLast14: 5,
    totalMaxSessions: 3,
    bandsAvailable: true,
    ...overrides,
  }
}

describe('recommendation engine', () => {
  it('classifies rising, stable, and falling max trends', () => {
    expect(
      classifyTrend([
        { date: '2026-04-01', reps: 7 },
        { date: '2026-04-08', reps: 8 },
        { date: '2026-04-16', reps: 9 },
      ]),
    ).toBe('rising')

    expect(
      classifyTrend([
        { date: '2026-04-01', reps: 8 },
        { date: '2026-04-08', reps: 8 },
        { date: '2026-04-16', reps: 9, qualityFlag: 'cleaner' },
      ]),
    ).toBe('rising')

    expect(
      classifyTrend([
        { date: '2026-04-01', reps: 10 },
        { date: '2026-04-09', reps: 10 },
        { date: '2026-04-17', reps: 9 },
      ]),
    ).toBe('stable')

    expect(
      classifyTrend([
        { date: '2026-04-01', reps: 10 },
        { date: '2026-04-09', reps: 9 },
        { date: '2026-04-17', reps: 8 },
      ]),
    ).toBe('falling')
  })

  it('counts stable exposures without treating one drop as a collapse', () => {
    expect(
      getStableExposureCount([
        { date: '2026-04-01', reps: 10 },
        { date: '2026-04-09', reps: 10 },
        { date: '2026-04-17', reps: 9 },
      ]),
    ).toBe(3)
  })

  it('makes max sessions due after 7 to 10 days when recovery is acceptable', () => {
    expect(
      getMaxSessionDue(
        createBaseInput({
          daysSinceLastMax: 8,
          fatigueAverage: 2.2,
          jointPainAverage: 0.5,
        }),
      ),
    ).toBe(true)

    expect(
      getMaxSessionDue(
        createBaseInput({
          daysSinceLastMax: 3,
          fatigueAverage: 2.2,
          jointPainAverage: 0.5,
        }),
      ),
    ).toBe(false)

    expect(
      getMaxSessionDue(
        createBaseInput({
          daysSinceLastMax: 9,
          fatigueAverage: 2.5,
          jointPainAverage: 3.5,
        }),
      ),
    ).toBe(false)
  })

  it('selects build, peak, and deload phases conservatively', () => {
    expect(
      selectPhase({
        ...createBaseInput({
          totalMaxSessions: 1,
          sessionsLast14: 2,
          cycleAgeDays: 12,
        }),
        deloadLevel: 'none',
      }),
    ).toBe('build')

    expect(
      selectPhase({
        ...createBaseInput({
          totalMaxSessions: 5,
          daysSinceLastMax: 6,
          sessionsLast14: 5,
          fatigueAverage: 2,
        }),
        deloadLevel: 'none',
      }),
    ).toBe('peak')

    expect(
      selectPhase({
        ...createBaseInput(),
        deloadLevel: 'soft_deload',
      }),
    ).toBe('deload')
  })

  it('chooses the correct deload level from combined signals', () => {
    expect(
      selectDeloadLevel(
        createBaseInput({
          lastMaxResults: [
            { date: '2026-04-01', reps: 10 },
            { date: '2026-04-09', reps: 10 },
            { date: '2026-04-17', reps: 9 },
          ],
          fatigueAverage: 4.1,
          sessionsLast7: 4,
          sessionsLast14: 7,
        }),
      ),
    ).toBe('volume_reduction')

    expect(
      selectDeloadLevel(
        createBaseInput({
          lastMaxResults: [
            { date: '2026-04-01', reps: 10 },
            { date: '2026-04-09', reps: 9 },
            { date: '2026-04-17', reps: 8 },
          ],
          fatigueAverage: 4.2,
        }),
      ),
    ).toBe('soft_deload')

    expect(
      selectDeloadLevel(
        createBaseInput({
          lastMaxResults: [
            { date: '2026-04-01', reps: 10 },
            { date: '2026-04-09', reps: 9 },
            { date: '2026-04-17', reps: 8 },
          ],
          fatigueAverage: 4.3,
          jointPainAverage: 3.6,
        }),
      ),
    ).toBe('recovery_deload')
  })

  it('maps repeated failure points to useful support exercises', () => {
    expect(getFailurePointPriority('start', 0, 3)).toEqual([
      'Scapular pull-up',
      'Dead hang',
      'Active hang',
      'Band-assisted pull-up',
      'Bottom-pause pull-up',
    ])

    expect(getFailurePointPriority('grip/hang', 3.5, 3)).toEqual([
      'Active hang',
      'Band-assisted pull-up',
    ])
  })

  it('returns support guidance for a rising trend with good recovery', () => {
    const recommendation = createRecommendation(
      createBaseInput({
        daysSinceLastMax: 4,
        sessionsLast7: 2,
        repeatedFailurePoint: 'general endurance',
      }),
    )

    expect(recommendation.phase).toBe('develop')
    expect(recommendation.nextSessionType).toBe('support')
    expect(recommendation.deloadLevel).toBe('none')
    expect(recommendation.explanation).toBe(
      'Your max reps are still improving. Keep going.',
    )
    expect(recommendation.suggestedExercises).toContain('Density pull-up block')
  })

  it('keeps stable progress out of deload when fatigue is still manageable', () => {
    const recommendation = createRecommendation(
      createBaseInput({
        lastMaxResults: [
          { date: '2026-04-01', reps: 10 },
          { date: '2026-04-09', reps: 10 },
          { date: '2026-04-17', reps: 9 },
        ],
        fatigueAverage: 3.1,
        daysSinceLastMax: 8,
      }),
    )

    expect(recommendation.deloadLevel).toBe('none')
    expect(recommendation.nextSessionType).toBe('max')
    expect(recommendation.explanation).toContain('It has been 8 days')
  })

  it('moves into softer or full recovery deloads only when the signals stack up', () => {
    const softDeload = createRecommendation(
      createBaseInput({
        lastMaxResults: [
          { date: '2026-04-01', reps: 10 },
          { date: '2026-04-09', reps: 9 },
          { date: '2026-04-17', reps: 8 },
        ],
        fatigueAverage: 4.2,
        repeatedFailurePoint: 'middle',
      }),
    )

    expect(softDeload.deloadLevel).toBe('soft_deload')
    expect(softDeload.nextSessionType).toBe('deload')
    expect(softDeload.explanation).toBe(
      'Your recent max results are dropping. Use a lighter session to recover.',
    )
    expect(softDeload.suggestedExercises).toContain('Band-assisted pull-up')

    const recoveryDeload = createRecommendation(
      createBaseInput({
        lastMaxResults: [
          { date: '2026-04-01', reps: 10 },
          { date: '2026-04-09', reps: 9 },
          { date: '2026-04-17', reps: 8 },
        ],
        fatigueAverage: 4.2,
        jointPainAverage: 3.6,
      }),
    )

    expect(recoveryDeload.deloadLevel).toBe('recovery_deload')
    expect(recoveryDeload.nextSessionType).toBe('recovery')
    expect(recoveryDeload.explanation).toBe(
      'Performance is dropping and joint stress is elevated. Prioritize recovery.',
    )
  })

  it('generates a valid empty-state recommendation from seed data', () => {
    const seeded = createSeedData('2026-04-18')
    expect(seeded.recommendationState.explanation).toContain(
      'Start with one clean',
    )
  })
})
