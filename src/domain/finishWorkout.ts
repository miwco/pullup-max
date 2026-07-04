import type {
  EmomSegment,
  FinishExerciseId,
  FinishWorkoutData,
  FinishWorkoutEntry,
  FinishWorkoutProgression,
  FinishWorkoutSettings,
  PresetOutcome,
} from './types'

export const FINISH_EXERCISE_IDS: FinishExerciseId[] = [
  'back-extension',
  'abs',
  'dips',
  'squat-jumps',
]

export const FINISH_SET_COUNT = 3
export const FINISH_DIP_SET_COUNT = 10
export const FINISH_PREP_SECONDS = 10

export function createDefaultFinishWorkoutSettings(): FinishWorkoutSettings {
  return {
    abExerciseName: 'Crunches',
    backExtensionRestSeconds: 105,
    absRestSeconds: 105,
    betweenExerciseRestSeconds: 120,
  }
}

export function createDefaultFinishWorkoutProgression(): FinishWorkoutProgression {
  return {
    backExtensionSeconds: 45,
    absSeconds: 45,
    dipBaseReps: 2,
    dipStageOffset: 0,
    squatJumpReps: 10,
  }
}

export function createDefaultFinishWorkoutData(): FinishWorkoutData {
  return {
    settings: createDefaultFinishWorkoutSettings(),
    progression: createDefaultFinishWorkoutProgression(),
    sessions: [],
  }
}

export function resolveFinishDipSegments(
  progression: FinishWorkoutProgression,
): EmomSegment[] {
  const completedTiers = Math.floor(progression.dipStageOffset / 5)
  const mixedStep = progression.dipStageOffset % 5
  const baseReps = progression.dipBaseReps + completedTiers
  const higherSets = mixedStep * 2

  if (higherSets === 0) {
    return [{ sets: FINISH_DIP_SET_COUNT, reps: baseReps }]
  }

  return [
    { sets: higherSets, reps: baseReps + 1 },
    { sets: FINISH_DIP_SET_COUNT - higherSets, reps: baseReps },
  ]
}

export function expandFinishDipPlan(
  progression: FinishWorkoutProgression,
): number[] {
  return resolveFinishDipSegments(progression).flatMap((segment) =>
    Array.from({ length: segment.sets }, () => segment.reps),
  )
}

export function getFinishDipWorkSeconds(reps: number) {
  return Math.max(10, reps * 3)
}

export function getFinishTargetSummary(
  exerciseId: FinishExerciseId,
  data: FinishWorkoutData,
) {
  const { progression, settings } = data

  switch (exerciseId) {
    case 'back-extension':
      return `3 x ${progression.backExtensionSeconds}s`
    case 'abs':
      return `${settings.abExerciseName}: 3 x ${progression.absSeconds}s`
    case 'dips':
      return resolveFinishDipSegments(progression)
        .map((segment) => `${segment.sets} x ${segment.reps}`)
        .join(' + ')
    case 'squat-jumps':
      return `${progression.squatJumpReps} reps`
  }
}

export function applyFinishProgression(
  current: FinishWorkoutProgression,
  outcomes: Record<FinishExerciseId, PresetOutcome>,
): FinishWorkoutProgression {
  return {
    backExtensionSeconds:
      current.backExtensionSeconds +
      (outcomes['back-extension'] === 'pass' ? 1 : 0),
    absSeconds: current.absSeconds + (outcomes.abs === 'pass' ? 1 : 0),
    dipBaseReps: current.dipBaseReps,
    dipStageOffset: current.dipStageOffset + (outcomes.dips === 'pass' ? 1 : 0),
    squatJumpReps:
      current.squatJumpReps + (outcomes['squat-jumps'] === 'pass' ? 1 : 0),
  }
}

export function buildFinishWorkoutEntries(
  data: FinishWorkoutData,
  outcomes: Record<FinishExerciseId, PresetOutcome>,
): FinishWorkoutEntry[] {
  return FINISH_EXERCISE_IDS.map((exerciseId) => ({
    exerciseId,
    outcome: outcomes[exerciseId],
    targetSummary: getFinishTargetSummary(exerciseId, data),
  }))
}
