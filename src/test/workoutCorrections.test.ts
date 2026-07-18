import { describe, expect, it } from 'vitest'
import { createSeedData } from '../domain/defaults'
import { getAllProgramSteps } from '../domain/programTemplate'
import {
  applyWorkoutCorrection,
  rebuildWorkoutDerivedState,
  removeWorkoutSession,
} from '../domain/workoutCorrections'
import type { AppData, ExerciseEntry, WorkoutSession } from '../domain/types'

function createCorrectionData() {
  const data = createSeedData('2026-01-01')
  const presetStep = getAllProgramSteps(data.programTemplate).find(
    (step) => typeof step.emomMinutes === 'number',
  )!
  const sessions: WorkoutSession[] = [
    {
      id: 'session-1',
      date: '2026-01-01',
      sessionType: 'max',
      notes: '',
    },
    {
      id: 'session-2',
      date: '2026-01-05',
      sessionType: 'support',
      notes: '',
    },
    {
      id: 'session-3',
      date: '2026-01-10',
      sessionType: 'max',
      notes: '',
    },
  ]
  const exerciseEntries: ExerciseEntry[] = ['session-1', 'session-2'].map(
    (workoutSessionId, index) => ({
      id: `entry-${index + 1}`,
      workoutSessionId,
      exerciseId: presetStep.exerciseId,
      sets: 1,
      reps: 20,
      presetKey: presetStep.id,
      presetTargetMode: 'emom',
      presetTargetSummary: '10m EMOM @ 2',
      outcome: 'pass',
      isMaxTest: false,
    }),
  )

  return rebuildWorkoutDerivedState(
    {
      ...data,
      sessions,
      exerciseEntries,
      maxTests: [
        {
          id: 'max-1',
          workoutSessionId: 'session-1',
          reps: 10,
          movement: 'Pull-up',
          trendClassification: 'stable',
        },
        {
          id: 'max-2',
          workoutSessionId: 'session-3',
          reps: 9,
          movement: 'Pull-up',
          trendClassification: 'stable',
        },
      ],
      presetProgressions: [],
    },
    '2026-01-12',
  ) satisfies AppData
}

describe('workout corrections', () => {
  it('rebuilds trend and preset progression after deleting a workout', () => {
    const data = createCorrectionData()

    expect(data.presetProgressions).toEqual([
      expect.objectContaining({ mode: 'emom', emomStageOffset: 2 }),
    ])

    const corrected = removeWorkoutSession(data, 'session-2', '2026-01-12')

    expect(corrected.sessions.map((session) => session.id)).toEqual([
      'session-1',
      'session-3',
    ])
    expect(corrected.exerciseEntries.map((entry) => entry.id)).toEqual([
      'entry-1',
    ])
    expect(corrected.presetProgressions).toEqual([
      expect.objectContaining({ mode: 'emom', emomStageOffset: 1 }),
    ])
    expect(corrected.recommendationState.daysSinceLastWorkout).toBe(2)
  })

  it('reclassifies max history after correcting reps and date', () => {
    const data = createCorrectionData()
    const corrected = applyWorkoutCorrection(
      data,
      {
        sessionId: 'session-3',
        date: '2026-01-11',
        notes: 'Corrected from video.',
        entryOutcomes: {},
        maxTest: {
          reps: 11,
          failurePoint: 'top',
          qualityFlag: 'clean',
        },
      },
      '2026-01-12',
    )

    expect(
      corrected.sessions.find((session) => session.id === 'session-3'),
    ).toEqual(
      expect.objectContaining({
        date: '2026-01-11',
        notes: 'Corrected from video.',
      }),
    )
    expect(
      corrected.maxTests.find((maxTest) => maxTest.id === 'max-2'),
    ).toEqual(
      expect.objectContaining({
        reps: 11,
        failurePoint: 'top',
        qualityFlag: 'clean',
        trendClassification: 'rising',
      }),
    )
    expect(corrected.recommendationState.daysSinceLastMax).toBe(1)
  })

  it('replays edited pass and fail outcomes deterministically', () => {
    const data = createCorrectionData()
    const corrected = applyWorkoutCorrection(
      data,
      {
        sessionId: 'session-2',
        date: '2026-01-05',
        notes: '',
        entryOutcomes: { 'entry-2': 'fail' },
      },
      '2026-01-12',
    )

    expect(
      corrected.exerciseEntries.find((entry) => entry.id === 'entry-2')
        ?.outcome,
    ).toBe('fail')
    expect(corrected.presetProgressions).toEqual([
      expect.objectContaining({ mode: 'emom', emomStageOffset: 1 }),
    ])
  })
})
