import { describe, expect, it } from 'vitest'
import { createSeedData } from '../domain/defaults'
import {
  applyFinishProgression,
  createDefaultFinishWorkoutProgression,
  expandFinishDipPlan,
  getFinishDipWorkSeconds,
  resolveFinishDipSegments,
} from '../domain/finishWorkout'
import { withComputedRecommendation } from '../domain/selectors'
import {
  createDipSteps,
  createTimedSetSteps,
} from '../features/finish/finishTimerPlan'

describe('Finish workout progression', () => {
  it('advances only exercises that pass', () => {
    const current = createDefaultFinishWorkoutProgression()
    const next = applyFinishProgression(current, {
      'back-extension': 'pass',
      abs: 'fail',
      dips: 'pass',
      'squat-jumps': 'fail',
    })

    expect(next).toEqual({
      backExtensionSeconds: 46,
      absSeconds: 45,
      dipBaseReps: 2,
      dipStageOffset: 1,
      squatJumpReps: 10,
    })
  })

  it('progresses dip EMOMs two higher-rep sets at a time', () => {
    const progression = createDefaultFinishWorkoutProgression()

    expect(resolveFinishDipSegments(progression)).toEqual([
      { sets: 10, reps: 2 },
    ])

    progression.dipStageOffset = 1
    expect(resolveFinishDipSegments(progression)).toEqual([
      { sets: 2, reps: 3 },
      { sets: 8, reps: 2 },
    ])

    progression.dipStageOffset = 5
    expect(expandFinishDipPlan(progression)).toEqual(Array(10).fill(3))

    progression.dipStageOffset = 6
    expect(resolveFinishDipSegments(progression)).toEqual([
      { sets: 2, reps: 4 },
      { sets: 8, reps: 3 },
    ])
  })

  it('uses the dip work-time floor and per-rep rule', () => {
    expect(getFinishDipWorkSeconds(2)).toBe(10)
    expect(getFinishDipWorkSeconds(3)).toBe(10)
    expect(getFinishDipWorkSeconds(4)).toBe(12)
    expect(getFinishDipWorkSeconds(5)).toBe(15)
  })

  it('adds prep only before the first timed set and first dip set', () => {
    const timedSteps = createTimedSetSteps('Back extension', 45, 105)
    const dipSteps = createDipSteps(Array(10).fill(2))

    expect(timedSteps.filter((step) => step.phase === 'prep')).toHaveLength(1)
    expect(timedSteps.filter((step) => step.phase === 'work')).toHaveLength(3)
    expect(timedSteps.filter((step) => step.phase === 'rest')).toHaveLength(2)
    expect(dipSteps.filter((step) => step.phase === 'prep')).toHaveLength(1)
    expect(dipSteps.filter((step) => step.phase === 'work')).toHaveLength(10)
    expect(dipSteps.filter((step) => step.phase === 'rest')).toHaveLength(9)
  })

  it('does not affect core recommendations or workout freshness', () => {
    const seeded = createSeedData('2026-07-04')
    const before = withComputedRecommendation(seeded, '2026-07-04')
    const after = withComputedRecommendation(
      {
        ...before,
        finishWorkout: {
          ...before.finishWorkout,
          sessions: [
            {
              id: 'finish-1',
              date: '2026-07-04',
              completedAt: '2026-07-04T12:00:00.000Z',
              entries: [],
            },
          ],
        },
      },
      '2026-07-04',
    )

    expect(after.sessions).toEqual(before.sessions)
    expect({
      ...after.recommendationState,
      computedAt: '',
    }).toEqual({
      ...before.recommendationState,
      computedAt: '',
    })
  })
})
