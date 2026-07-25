import { describe, expect, it } from 'vitest'
import { createDefaultExercises, createSeedData } from '../domain/defaults'
import {
  buildRecommendationReasons,
  classifyTrend,
  createRecommendation,
  getAdjustedProgramSteps,
  getBaselineMax,
  getLatestFailurePoint,
  isMaxReady,
  shouldEaseSupport,
} from '../domain/recommendationEngine'
import {
  applyEasySupportAdjustments,
  createDefaultProgramTemplate,
  getProgramStepsForSession,
  getSupportFocusFromFailurePoint,
} from '../domain/programTemplate'
import type { RecommendationInput } from '../domain/types'

function createScenario(overrides: Partial<RecommendationInput> = {}): {
  exercises: ReturnType<typeof createDefaultExercises>
  input: RecommendationInput
} {
  const exercises = createDefaultExercises()

  return {
    exercises,
    input: {
      availableExercises: exercises.map((exercise) => exercise.name),
      cycleMaxResults: [
        { date: '2026-04-01', reps: 10 },
        { date: '2026-04-09', reps: 11 },
        { date: '2026-04-17', reps: 12, failurePoint: 'top' },
      ],
      currentPhase: 'develop',
      daysSinceLastMax: 7,
      daysSinceLastWorkout: 3,
      exercises,
      fatigueAverage: 2.2,
      supportPainOverride: false,
      supportFocusHistory: [],
      latestFailurePoint: 'top',
      mainMovement: 'Pull-up',
      programTemplate: createDefaultProgramTemplate(exercises),
      sessionsLast7: 2,
      ...overrides,
    },
  }
}

describe('recommendation engine', () => {
  it('classifies exact rising, stable, and falling max trends', () => {
    expect(
      classifyTrend([
        { date: '2026-04-01', reps: 12 },
        { date: '2026-04-08', reps: 12 },
        { date: '2026-04-16', reps: 13 },
      ]),
    ).toBe('rising')

    expect(
      classifyTrend([
        { date: '2026-04-01', reps: 12 },
        { date: '2026-04-08', reps: 11 },
        { date: '2026-04-16', reps: 12 },
      ]),
    ).toBe('stable')

    expect(
      classifyTrend([
        { date: '2026-04-01', reps: 12 },
        { date: '2026-04-08', reps: 11 },
        { date: '2026-04-16', reps: 11 },
      ]),
    ).toBe('falling')
  })

  it('uses the highest prior max as baseline, or the only logged max when alone', () => {
    expect(
      getBaselineMax([
        { date: '2026-04-01', reps: 10 },
        { date: '2026-04-09', reps: 11 },
        { date: '2026-04-17', reps: 12 },
      ]),
    ).toBe(11)

    expect(getBaselineMax([{ date: '2026-04-01', reps: 9 }])).toBe(9)
    expect(getBaselineMax([])).toBeNull()
  })

  it('treats Max readiness as satisfied only after 3 days since last workout or with no recent workout', () => {
    expect(isMaxReady(2, null)).toBe(false)
    expect(isMaxReady(3, null)).toBe(true)
    expect(isMaxReady(6, null)).toBe(true)
    expect(isMaxReady(null, null)).toBe(true)
  })

  it('requires 7 days since last max test before recommending another max day', () => {
    expect(isMaxReady(3, 5)).toBe(false)
    expect(isMaxReady(3, 6)).toBe(false)
    expect(isMaxReady(3, 7)).toBe(true)
    expect(isMaxReady(3, 14)).toBe(true)
    expect(isMaxReady(3, null)).toBe(true)
  })

  it('explains the concrete freshness, phase, trend, and pain inputs', () => {
    const { input } = createScenario({
      currentPhase: 'peak',
      daysSinceLastMax: 5,
      daysSinceLastWorkout: 2,
      supportPainOverride: true,
    })

    expect(buildRecommendationReasons(input)).toEqual([
      'The last max test was 5 days ago; 7 days are required.',
      '1 full rest day since the last workout or GG set; 2 are required for a Max day.',
      'peak phase and a rising max trend set the current workload.',
      'Recent joint-pain data is keeping Support work easier.',
    ])
  })

  it('recommends Max only when the readiness rule is satisfied', () => {
    const exercises = createDefaultExercises()
    const ready = createRecommendation(
      createScenario({
        daysSinceLastWorkout: 3,
      }).input,
      exercises,
    )
    const notReady = createRecommendation(
      createScenario({
        daysSinceLastWorkout: 1,
      }).input,
      exercises,
    )

    expect(ready.nextSessionType).toBe('max')
    expect(ready.maxReadinessSatisfied).toBe(true)
    expect(notReady.nextSessionType).toBe('support')
    expect(notReady.maxReadinessSatisfied).toBe(false)
  })

  it('keeps working when fatigue and pain signals are missing', () => {
    const { exercises, input } = createScenario({
      daysSinceLastWorkout: 1,
      fatigueAverage: null,
    })
    const recommendation = createRecommendation(input, exercises)

    expect(recommendation.nextSessionType).toBe('support')
    expect(recommendation.explanation).toContain('support block')
  })

  it('uses the most recent Max-day failure point only for support focus', () => {
    const { exercises, input } = createScenario({
      daysSinceLastWorkout: 1,
      cycleMaxResults: [
        { date: '2026-04-01', reps: 10, failurePoint: 'middle' },
        { date: '2026-04-09', reps: 11, failurePoint: 'grip' },
        { date: '2026-04-17', reps: 11, failurePoint: 'top' },
      ],
      latestFailurePoint: 'top',
    })
    const recommendation = createRecommendation(input, exercises)

    expect(getLatestFailurePoint(input.cycleMaxResults)).toBe('top')
    expect(recommendation.defaultSupportFocus).toBe('top')
    expect(recommendation.suggestedExercises).toContain('Top hold')
  })

  it('rotates support focus when the latest failure point is missing or not sure', () => {
    const { exercises, input } = createScenario({
      daysSinceLastWorkout: 1,
      latestFailurePoint: 'not sure',
    })
    const recommendation = createRecommendation(input, exercises)

    expect(getSupportFocusFromFailurePoint('not sure')).toBe('generic')
    expect(recommendation.defaultSupportFocus).toBe('top')
    expect(recommendation.suggestedExercises).toContain('Top hold')
    expect(recommendation.explanation).toContain('rotate')
  })

  it('continues the support rotation after logged support days', () => {
    const { exercises, input } = createScenario({
      daysSinceLastWorkout: 1,
      latestFailurePoint: 'not sure',
      supportFocusHistory: ['top', 'middle'],
    })
    const recommendation = createRecommendation(input, exercises)

    expect(recommendation.defaultSupportFocus).toBe('start/bottom')
    expect(recommendation.suggestedExercises).toContain(
      'Bottom-range partial pull-up',
    )
  })

  it('keeps the two-session model but eases support when trend is falling', () => {
    const { exercises, input } = createScenario({
      daysSinceLastWorkout: 1,
      cycleMaxResults: [
        { date: '2026-04-01', reps: 12, failurePoint: 'middle' },
        { date: '2026-04-09', reps: 11, failurePoint: 'middle' },
        { date: '2026-04-17', reps: 10, failurePoint: 'middle' },
      ],
      latestFailurePoint: 'middle',
    })
    const recommendation = createRecommendation(input, exercises)

    expect(shouldEaseSupport(input)).toBe(true)
    expect(recommendation.nextSessionType).toBe('support')
    expect(recommendation.suggestedExercises[0]).toBe('Band-assisted pull-up')
    expect(recommendation.explanation).toContain('easier clean Support day')
  })

  it('uses more short easy exposures in build phase', () => {
    const { exercises, input } = createScenario({
      currentPhase: 'build',
      daysSinceLastWorkout: 1,
    })
    const recommendation = createRecommendation(input, exercises)
    const supportSteps = getAdjustedProgramSteps(input, 'support')
    const maxSteps = getAdjustedProgramSteps(input, 'max')

    expect(shouldEaseSupport(input)).toBe(false)
    expect(recommendation.nextSessionType).toBe('support')
    expect(recommendation.suggestedExercises[0]).toBe('Band-assisted pull-up')
    expect(recommendation.explanation).toContain('Build phase')
    expect(supportSteps[0]?.sets).toBe(8)
    expect(supportSteps[0]?.reps).toBe(3)
    expect(supportSteps.find((step) => step.title === 'Top holds')?.sets).toBe(
      3,
    )
    expect(
      supportSteps.find((step) => step.title === 'Top holds')?.holdSeconds,
    ).toBe(15)
    expect(maxSteps[0]?.emomMinutes).toBe(10)
    expect(maxSteps[0]?.notes).toContain('10 minutes')
  })

  it('uses fewer longer support sets in develop phase', () => {
    const { input } = createScenario({
      currentPhase: 'develop',
      daysSinceLastWorkout: 1,
      latestFailurePoint: 'middle',
    })
    const supportSteps = getAdjustedProgramSteps(input, 'support')

    expect(supportSteps[0]?.sets).toBe(5)
    expect(supportSteps[0]?.reps).toBe(6)
    expect(
      supportSteps.find((step) => step.title === 'Mid-range isometric holds')
        ?.holdSeconds,
    ).toBe(15)
  })

  it('keeps peak work short, specific, and harder while max-test logic stays separate', () => {
    const { input } = createScenario({
      currentPhase: 'peak',
      daysSinceLastWorkout: 1,
      latestFailurePoint: 'top',
    })
    const steps = getAdjustedProgramSteps(input, 'support')
    const maxSteps = getAdjustedProgramSteps(input, 'max')

    expect(steps).toHaveLength(2)
    expect(steps[0]?.title).toBe('Main pull-up practice')
    expect(steps[0]?.sets).toBe(5)
    expect(steps[0]?.reps).toBe(6)
    expect(steps[1]?.title).toBe('Top holds')
    expect(steps[1]?.sets).toBe(2)
    expect(steps[1]?.holdSeconds).toBe(25)
    expect(maxSteps[0]?.emomMinutes).toBe(10)
    expect(maxSteps[0]?.notes).toContain('10 minutes')
  })

  it('eases support when fatigue or joint pain are high without changing session types', () => {
    const { exercises, input: fatigueDriven } = createScenario({
      daysSinceLastWorkout: 1,
      fatigueAverage: 4.1,
    })
    const { input: painDriven } = createScenario({
      daysSinceLastWorkout: 1,
      supportPainOverride: true,
    })

    expect(shouldEaseSupport(fatigueDriven)).toBe(true)
    expect(shouldEaseSupport(painDriven)).toBe(true)
    expect(createRecommendation(fatigueDriven, exercises).nextSessionType).toBe(
      'support',
    )
    expect(createRecommendation(painDriven, exercises).nextSessionType).toBe(
      'support',
    )
  })

  it('resolves max and support rows to the selected main movement family', () => {
    const exercises = createDefaultExercises()
    const template = createDefaultProgramTemplate(exercises)

    const chinUpSupport = getAdjustedProgramSteps(
      createScenario({
        exercises,
        programTemplate: template,
        daysSinceLastWorkout: 1,
        mainMovement: 'Chin-up',
      }).input,
      'support',
    )
    const ringMax = getAdjustedProgramSteps(
      createScenario({
        exercises,
        programTemplate: template,
        mainMovement: 'Ring pull-up',
      }).input,
      'max',
    )

    expect(chinUpSupport[0]?.title).toBe('Main chin-up practice')
    expect(ringMax[0]?.title).toBe('EMOM ring pull-up block')
  })

  it('forces chin-up support rows back to pull-up grip when pain override is active', () => {
    const exercises = createDefaultExercises()
    const template = createDefaultProgramTemplate(exercises)

    const chinUpWithPain = getAdjustedProgramSteps(
      createScenario({
        exercises,
        programTemplate: template,
        daysSinceLastWorkout: 1,
        mainMovement: 'Chin-up',
        supportPainOverride: true,
      }).input,
      'support',
    )
    const neutralWithPain = getAdjustedProgramSteps(
      createScenario({
        exercises,
        programTemplate: template,
        daysSinceLastWorkout: 1,
        mainMovement: 'Neutral-grip pull-up',
        supportPainOverride: true,
      }).input,
      'support',
    )

    expect(chinUpWithPain[0]?.title).toBe('Main pull-up practice')
    expect(neutralWithPain[0]?.title).toBe('Main neutral-grip pull-up practice')
  })

  it('maps weak-point support blocks to the expected default exercises', () => {
    const exercises = createDefaultExercises()
    const programTemplate = createDefaultProgramTemplate(exercises)

    expect(
      getProgramStepsForSession(programTemplate, 'support', 'generic').map(
        (step) => step.title,
      ),
    ).toEqual(['Main pull-up practice', 'Scapular pull-ups', 'Dead hang'])
    expect(
      getProgramStepsForSession(programTemplate, 'support', 'top').map(
        (step) => step.title,
      ),
    ).toContain('Top holds')
    expect(
      getProgramStepsForSession(programTemplate, 'support', 'middle').map(
        (step) => step.title,
      ),
    ).toContain('Mid-range isometric holds')
    expect(
      getProgramStepsForSession(programTemplate, 'support', 'start/bottom').map(
        (step) => step.title,
      ),
    ).toContain('Bottom-range partials')
    expect(
      getProgramStepsForSession(programTemplate, 'support', 'grip').map(
        (step) => step.title,
      ),
    ).toContain('Grip endurance work')
  })

  it('seeds the exact editable default program structure', () => {
    const exercises = createDefaultExercises()
    const template = createDefaultProgramTemplate(exercises)

    expect(template.maxDay.warmup.steps).toHaveLength(0)
    expect(template.maxDay.mainSet.steps).toHaveLength(0)
    expect(template.maxDay.volumeBlock.steps[0]?.emomMinutes).toBe(10)
    expect(template.maxDay.volumeBlock.steps[0]?.emomReps).toBe(2)
    expect(template.maxDay.volumeBlock.steps[0]?.notes).toContain(
      'complete all 10 minutes with clean form',
    )
    expect(template.maxDay.finisher.steps[0]?.holdSeconds).toBe(20)
    expect(template.maxDay.finisher.steps[0]?.notes).toContain(
      'increase the hold time over the weeks',
    )
    expect(template.supportDayBase.steps[0]?.sets).toBe(6)
    expect(template.supportDayBase.steps[0]?.minReps).toBe(3)
    expect(template.supportDayBase.steps[0]?.maxReps).toBe(6)
    expect(
      template.supportFallback.steps.map((step) => ({
        title: step.title,
        sets: step.sets,
        reps: step.reps,
        holdSeconds: step.holdSeconds,
      })),
    ).toEqual([
      {
        title: 'Scapular pull-ups',
        sets: 2,
        reps: 6,
        holdSeconds: undefined,
      },
      {
        title: 'Dead hang',
        sets: 2,
        reps: undefined,
        holdSeconds: 20,
      },
    ])
  })

  it('applies easier support adjustments to editable program steps', () => {
    const exercises = createDefaultExercises()
    const template = createDefaultProgramTemplate(exercises)
    const steps = getProgramStepsForSession(template, 'support', 'top')
    const adjusted = applyEasySupportAdjustments(steps)

    expect(adjusted[0]?.reps).toBe(3)
    expect(
      adjusted.some((step) => step.notes.includes('Use bands if needed')),
    ).toBe(true)
  })

  it('prefills the default Max-day steps with only the volume block and finisher', () => {
    const exercises = createDefaultExercises()
    const template = createDefaultProgramTemplate(exercises)
    const steps = getProgramStepsForSession(template, 'max', 'generic')

    expect(steps.map((step) => step.title)).toEqual([
      'EMOM pull-up block',
      'Top hold',
    ])
    expect(steps.some((step) => step.captureAsMaxTest)).toBe(false)
  })

  it('creates a usable empty-state seed recommendation', () => {
    const seeded = createSeedData('2026-04-18')

    expect(seeded.recommendationState.nextSessionType).toBe('max')
    expect(seeded.recommendationState.explanation).toContain('max session')
  })
})
