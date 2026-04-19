import { createId } from '../lib/id'
import type {
  Exercise,
  FailurePoint,
  ProgramStep,
  ProgramTemplate,
  SessionType,
  SupportFocus,
} from './types'

function findExerciseId(exercises: Exercise[], name: string) {
  return (
    exercises.find((exercise) => exercise.name === name)?.id ??
    exercises[0]?.id ??
    ''
  )
}

function createProgramStep(
  exercises: Exercise[],
  input: Omit<ProgramStep, 'id' | 'exerciseId'> & { exerciseName: string },
): ProgramStep {
  return {
    id: createId('step'),
    exerciseId: findExerciseId(exercises, input.exerciseName),
    title: input.title,
    sets: input.sets,
    reps: input.reps,
    minReps: input.minReps,
    maxReps: input.maxReps,
    holdSeconds: input.holdSeconds,
    durationSeconds: input.durationSeconds,
    emomMinutes: input.emomMinutes,
    emomReps: input.emomReps,
    bandAllowed: input.bandAllowed,
    bodyweightOption: input.bodyweightOption,
    captureAsMaxTest: input.captureAsMaxTest,
    notes: input.notes,
  }
}

function cloneSteps(steps: ProgramStep[]) {
  return structuredClone(steps)
}

export function createDefaultProgramTemplate(
  exercises: Exercise[],
): ProgramTemplate {
  return {
    maxDay: {
      warmup: {
        title: 'Warm-up',
        steps: [
          createProgramStep(exercises, {
            title: 'Dead hang',
            exerciseName: 'Dead hang',
            holdSeconds: 20,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Scapular pull-ups',
            exerciseName: 'Scapular pull-up',
            sets: 2,
            reps: 5,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Easy band-assisted pull-ups',
            exerciseName: 'Band-assisted pull-up',
            sets: 2,
            reps: 5,
            bandAllowed: true,
            bodyweightOption: 'band',
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Easy bodyweight set',
            exerciseName: 'Pull-up',
            sets: 1,
            reps: 3,
            bodyweightOption: 'bodyweight',
            notes: 'About 30% of usual max.',
          }),
        ],
      },
      mainSet: {
        title: 'Main set',
        steps: [
          createProgramStep(exercises, {
            title: 'All-out max set',
            exerciseName: 'Pull-up',
            sets: 1,
            captureAsMaxTest: true,
            bodyweightOption: 'bodyweight',
            notes: 'Rest 4 minutes before this set and 6 minutes after.',
          }),
        ],
      },
      volumeBlock: {
        title: 'Volume block',
        steps: [
          createProgramStep(exercises, {
            title: 'EMOM pull-up block',
            exerciseName: 'EMOM pull-up block',
            emomMinutes: 10,
            emomReps: 4,
            sets: 10,
            reps: 4,
            bodyweightOption: 'bodyweight',
            notes: 'Adjust reps if needed so all 10 minutes stay clean.',
          }),
        ],
      },
      finisher: {
        title: 'Finisher',
        steps: [
          createProgramStep(exercises, {
            title: 'Top hold',
            exerciseName: 'Top hold',
            sets: 2,
            holdSeconds: 20,
            notes: 'Chin above the bar.',
          }),
        ],
      },
    },
    supportDayBase: {
      title: 'Support base',
      steps: [
        createProgramStep(exercises, {
          title: 'Main pull-up practice',
          exerciseName: 'Pull-up',
          sets: 6,
          reps: 4,
          minReps: 3,
          maxReps: 6,
          bandAllowed: true,
          bodyweightOption: 'either',
          notes: 'Stay clean and do not go to failure.',
        }),
      ],
    },
    supportFallback: {
      title: 'Generic support fallback',
      steps: [
        createProgramStep(exercises, {
          title: 'Top hold',
          exerciseName: 'Top hold',
          sets: 2,
          holdSeconds: 15,
          notes: '',
        }),
        createProgramStep(exercises, {
          title: 'Active hang',
          exerciseName: 'Active hang',
          sets: 2,
          holdSeconds: 20,
          notes: '',
        }),
      ],
    },
    weakPointBlocks: {
      top: {
        title: 'Top weak-point block',
        steps: [
          createProgramStep(exercises, {
            title: 'Top holds',
            exerciseName: 'Top hold',
            sets: 2,
            holdSeconds: 20,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Top-half pull-ups',
            exerciseName: 'Top-half pull-up',
            sets: 2,
            reps: 4,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Finish with active hang',
            exerciseName: 'Active hang',
            sets: 1,
            holdSeconds: 20,
            notes: '',
          }),
        ],
      },
      middle: {
        title: 'Middle weak-point block',
        steps: [
          createProgramStep(exercises, {
            title: 'Mid-range isometric holds',
            exerciseName: 'Mid-range hold',
            sets: 2,
            holdSeconds: 10,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Mid-pause pull-ups',
            exerciseName: 'Mid-pause pull-up',
            sets: 2,
            reps: 4,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Slow negatives',
            exerciseName: 'Negative pull-up',
            sets: 2,
            reps: 2,
            notes: '',
          }),
        ],
      },
      'start/bottom': {
        title: 'Start/bottom weak-point block',
        steps: [
          createProgramStep(exercises, {
            title: 'Scapular pull-ups',
            exerciseName: 'Scapular pull-up',
            sets: 2,
            reps: 5,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Paused pull-ups from dead hang',
            exerciseName: 'Paused pull-up from dead hang',
            sets: 2,
            reps: 4,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Bottom-range partials',
            exerciseName: 'Bottom-range partial pull-up',
            sets: 2,
            reps: 4,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Finish with active hang',
            exerciseName: 'Active hang',
            sets: 1,
            holdSeconds: 20,
            notes: '',
          }),
        ],
      },
      grip: {
        title: 'Grip weak-point block',
        steps: [
          createProgramStep(exercises, {
            title: 'Dead hangs',
            exerciseName: 'Dead hang',
            sets: 2,
            holdSeconds: 20,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Active hangs',
            exerciseName: 'Active hang',
            sets: 2,
            holdSeconds: 20,
            notes: '',
          }),
          createProgramStep(exercises, {
            title: 'Grip endurance work',
            exerciseName: 'Grip endurance work',
            sets: 2,
            durationSeconds: 30,
            notes: '',
          }),
        ],
      },
    },
  }
}

export function getSupportFocusFromFailurePoint(
  failurePoint: FailurePoint | null | undefined,
): SupportFocus {
  if (!failurePoint || failurePoint === 'not sure') {
    return 'generic'
  }

  return failurePoint
}

export function getProgramStepsForSession(
  template: ProgramTemplate,
  sessionType: SessionType,
  supportFocus: SupportFocus,
) {
  if (sessionType === 'max') {
    return [
      ...cloneSteps(template.maxDay.warmup.steps),
      ...cloneSteps(template.maxDay.mainSet.steps),
      ...cloneSteps(template.maxDay.volumeBlock.steps),
      ...cloneSteps(template.maxDay.finisher.steps),
    ]
  }

  const focusBlock =
    supportFocus === 'generic'
      ? template.supportFallback.steps
      : template.weakPointBlocks[supportFocus].steps

  return [
    ...cloneSteps(template.supportDayBase.steps),
    ...cloneSteps(focusBlock),
  ]
}

export function applyEasySupportAdjustments(
  steps: ProgramStep[],
  bandsAvailable: boolean,
) {
  return steps.map((step) => {
    const nextStep = {
      ...step,
    }

    if (typeof nextStep.minReps === 'number') {
      nextStep.reps = nextStep.minReps
    } else if (typeof nextStep.reps === 'number' && nextStep.reps > 1) {
      nextStep.reps = Math.max(1, nextStep.reps - 1)
    }

    if (bandsAvailable && nextStep.bandAllowed) {
      nextStep.notes = nextStep.notes
        ? `${nextStep.notes} Use bands if needed to keep the work easy.`
        : 'Use bands if needed to keep the work easy.'
    }

    return nextStep
  })
}

export function applyCompetitionPrepAdjustments(
  template: ProgramTemplate,
  steps: ProgramStep[],
) {
  const keepCount = template.supportDayBase.steps.length + 1

  return steps.slice(0, keepCount).map((step) => ({
    ...step,
    sets:
      typeof step.sets === 'number'
        ? Math.max(1, Math.round(step.sets * 0.75))
        : step.sets,
  }))
}

export function getProgramBlockLabel(supportFocus: SupportFocus) {
  if (supportFocus === 'generic') {
    return 'generic'
  }

  return supportFocus
}

export function getExerciseNamesForProgramSteps(
  steps: ProgramStep[],
  exercises: Exercise[],
) {
  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise.name]),
  )

  return [
    ...new Set(
      steps.map((step) => exerciseById.get(step.exerciseId)).filter(Boolean),
    ),
  ] as string[]
}
