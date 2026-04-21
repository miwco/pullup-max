import { describe, expect, it } from 'vitest'
import { createDefaultExercises } from '../domain/defaults'
import {
  advancePresetProgression,
  applyPresetOutcomes,
  resolvePresetTarget,
} from '../domain/presetProgression'
import {
  createDefaultProgramTemplate,
  getAllProgramSteps,
} from '../domain/programTemplate'
import type { ExerciseEntry, ProgramStep } from '../domain/types'

function getStepByTitle(steps: ProgramStep[], title: string) {
  const step = steps.find((item) => item.title === title)

  if (!step) {
    throw new Error(`Missing step: ${title}`)
  }

  return step
}

describe('preset progression', () => {
  const exercises = createDefaultExercises()
  const template = createDefaultProgramTemplate(exercises)
  const allSteps = getAllProgramSteps(template)

  it('seeds the EMOM target from the latest max test tier', () => {
    const emomStep = getStepByTitle(allSteps, 'EMOM pull-up block')

    expect(resolvePresetTarget(emomStep, undefined, null).summary).toBe(
      '10m EMOM @ 2',
    )
    expect(resolvePresetTarget(emomStep, undefined, 10).summary).toBe(
      '10m EMOM @ 3',
    )
    expect(resolvePresetTarget(emomStep, undefined, 13).summary).toBe(
      '10m EMOM @ 4',
    )
  })

  it('walks the EMOM ladder through mixed and full stages', () => {
    const emomStep = getStepByTitle(allSteps, 'EMOM pull-up block')

    expect(
      resolvePresetTarget(
        emomStep,
        {
          presetKey: emomStep.id,
          mode: 'emom',
          emomBaseReps: 2,
          emomStageOffset: 1,
        },
        6,
      ).summary,
    ).toBe('10m EMOM: 5x3 + 5x2')
    expect(
      resolvePresetTarget(
        emomStep,
        {
          presetKey: emomStep.id,
          mode: 'emom',
          emomBaseReps: 2,
          emomStageOffset: 2,
        },
        6,
      ).summary,
    ).toBe('10m EMOM @ 3')
  })

  it('progresses rep, hold, and duration targets conservatively', () => {
    const rangedRepStep = getStepByTitle(allSteps, 'Main pull-up practice')
    const holdStep = getStepByTitle(allSteps, 'Top hold')
    const durationStep = getStepByTitle(allSteps, 'Grip endurance work')
    const fixedRepStep = getStepByTitle(allSteps, 'Top-half pull-ups')

    expect(resolvePresetTarget(rangedRepStep, undefined, 10).summary).toBe('6x3')
    expect(
      advancePresetProgression(rangedRepStep, undefined, 10),
    ).toMatchObject({
      presetKey: rangedRepStep.id,
      mode: 'reps',
      currentValue: 4,
    })

    expect(resolvePresetTarget(holdStep, undefined, 10).summary).toBe(
      '2x20s hold',
    )
    expect(advancePresetProgression(holdStep, undefined, 10)).toMatchObject({
      presetKey: holdStep.id,
      mode: 'hold-seconds',
      currentValue: 22,
    })

    expect(resolvePresetTarget(durationStep, undefined, 10).summary).toBe(
      '2x30s',
    )
    expect(
      advancePresetProgression(durationStep, undefined, 10),
    ).toMatchObject({
      presetKey: durationStep.id,
      mode: 'duration-seconds',
      currentValue: 35,
    })

    expect(resolvePresetTarget(fixedRepStep, undefined, 10).summary).toBe('2x4')
    expect(
      advancePresetProgression(fixedRepStep, undefined, 10),
    ).toMatchObject({
      presetKey: fixedRepStep.id,
      mode: 'reps',
      currentValue: 5,
    })
  })

  it('keeps ranged rep rows capped and ignores fail outcomes', () => {
    const rangedRepStep = getStepByTitle(allSteps, 'Main pull-up practice')
    const stepLookup = new Map(allSteps.map((step) => [step.id, step]))
    const currentState = [
      {
        presetKey: rangedRepStep.id,
        mode: 'reps' as const,
        currentValue: 6,
      },
    ]
    const failedEntry: ExerciseEntry = {
      id: 'entry-1',
      workoutSessionId: 'session-1',
      exerciseId: rangedRepStep.exerciseId,
      presetKey: rangedRepStep.id,
      outcome: 'fail',
      isMaxTest: false,
    }
    const passedEntry: ExerciseEntry = {
      ...failedEntry,
      id: 'entry-2',
      outcome: 'pass',
    }

    expect(
      applyPresetOutcomes(currentState, [failedEntry], stepLookup, 10),
    ).toEqual(currentState)
    expect(
      applyPresetOutcomes(currentState, [passedEntry], stepLookup, 10),
    ).toEqual(currentState)
  })
})
