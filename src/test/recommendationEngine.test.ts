import { describe, expect, it } from 'vitest'
import { createDefaultExercises, createSeedData } from '../domain/defaults'
import {
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
      bandsAvailable: true,
      cycleMaxResults: [
        { date: '2026-04-01', reps: 10 },
        { date: '2026-04-09', reps: 11 },
        { date: '2026-04-17', reps: 12, failurePoint: 'top' },
      ],
      currentPhase: 'develop',
      daysSinceLastMax: 7,
      daysSinceLastWorkout: 3,
      fatigueAverage: 2.2,
      fatigueSensitivity: 3,
      jointPainAverage: 0.5,
      jointPainSensitivity: 3,
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

  it('treats Max readiness as satisfied only after 3 days or with no recent workout', () => {
    expect(isMaxReady(2)).toBe(false)
    expect(isMaxReady(3)).toBe(true)
    expect(isMaxReady(6)).toBe(true)
    expect(isMaxReady(null)).toBe(true)
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
      jointPainAverage: null,
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

  it('falls back to the generic support block when the latest failure point is missing or not sure', () => {
    const { exercises, input } = createScenario({
      daysSinceLastWorkout: 1,
      latestFailurePoint: 'not sure',
    })
    const recommendation = createRecommendation(input, exercises)

    expect(getSupportFocusFromFailurePoint('not sure')).toBe('generic')
    expect(recommendation.defaultSupportFocus).toBe('generic')
    expect(recommendation.suggestedExercises).toContain('Active hang')
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

  it('always biases Support toward easier clean work in build phase', () => {
    const { exercises, input } = createScenario({
      currentPhase: 'build',
      daysSinceLastWorkout: 1,
    })
    const recommendation = createRecommendation(input, exercises)

    expect(shouldEaseSupport(input)).toBe(false)
    expect(recommendation.nextSessionType).toBe('support')
    expect(recommendation.suggestedExercises[0]).toBe('Band-assisted pull-up')
    expect(recommendation.explanation).toContain('Build phase')
  })

  it('trims and reduces Support work during competition prep', () => {
    const { input } = createScenario({
      currentPhase: 'competition-prep',
      daysSinceLastWorkout: 1,
      latestFailurePoint: 'top',
    })
    const steps = getAdjustedProgramSteps(input, 'support')

    expect(steps).toHaveLength(2)
    expect(steps[0]?.title).toBe('Main pull-up practice')
    expect(steps[0]?.sets).toBe(5)
    expect(steps[1]?.title).toBe('Top holds')
    expect(steps[1]?.sets).toBe(2)
  })

  it('eases support when fatigue or joint pain are high without changing session types', () => {
    const { exercises, input: fatigueDriven } = createScenario({
      daysSinceLastWorkout: 1,
      fatigueAverage: 4.1,
    })
    const { input: painDriven } = createScenario({
      daysSinceLastWorkout: 1,
      jointPainAverage: 3.2,
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

  it('maps weak-point support blocks to the expected default exercises', () => {
    const exercises = createDefaultExercises()
    const programTemplate = createDefaultProgramTemplate(exercises)

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

    expect(template.maxDay.volumeBlock.steps[0]?.emomMinutes).toBe(10)
    expect(template.maxDay.volumeBlock.steps[0]?.emomReps).toBe(4)
    expect(template.maxDay.finisher.steps[0]?.holdSeconds).toBe(20)
    expect(template.supportDayBase.steps[0]?.sets).toBe(6)
    expect(template.supportDayBase.steps[0]?.minReps).toBe(3)
    expect(template.supportDayBase.steps[0]?.maxReps).toBe(6)
  })

  it('applies easier support adjustments to editable program steps', () => {
    const exercises = createDefaultExercises()
    const template = createDefaultProgramTemplate(exercises)
    const steps = getProgramStepsForSession(template, 'support', 'top')
    const adjusted = applyEasySupportAdjustments(steps, true)

    expect(adjusted[0]?.reps).toBe(3)
    expect(
      adjusted.some((step) => step.notes.includes('Use bands if needed')),
    ).toBe(true)
  })

  it('includes the main Max set in the prefilled Max-day steps', () => {
    const exercises = createDefaultExercises()
    const template = createDefaultProgramTemplate(exercises)
    const steps = getProgramStepsForSession(template, 'max', 'generic')

    expect(steps.some((step) => step.captureAsMaxTest)).toBe(true)
  })

  it('creates a usable empty-state seed recommendation', () => {
    const seeded = createSeedData('2026-04-18')

    expect(seeded.recommendationState.nextSessionType).toBe('max')
    expect(seeded.recommendationState.explanation).toContain('max session')
  })
})
