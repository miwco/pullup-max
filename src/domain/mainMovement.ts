import type { Exercise, MainMovement, ProgramStep, SessionType } from './types'

export const MAIN_MOVEMENTS: MainMovement[] = [
  'Pull-up',
  'Chin-up',
  'Neutral-grip pull-up',
  'Ring pull-up',
]

type ExerciseCategory =
  | 'main-movement'
  | 'band-assisted'
  | 'emom'
  | 'top-hold'
  | 'top-half'
  | 'mid-range-hold'
  | 'mid-pause'
  | 'negative'
  | 'scapular'
  | 'paused-dead-hang'
  | 'bottom-range-partial'
  | 'dead-hang'
  | 'active-hang'
  | 'grip-endurance'

interface MovementExerciseSpec {
  name: string
  defaultUnit: Exercise['defaultUnit']
  tags: string[]
}

const MOVEMENT_EXERCISE_LABELS: Record<
  Exclude<ExerciseCategory, 'main-movement'>,
  Record<MainMovement, string>
> = {
  'band-assisted': {
    'Pull-up': 'Band-assisted pull-up',
    'Chin-up': 'Band-assisted chin-up',
    'Neutral-grip pull-up': 'Band-assisted neutral-grip pull-up',
    'Ring pull-up': 'Band-assisted ring pull-up',
  },
  emom: {
    'Pull-up': 'EMOM pull-up block',
    'Chin-up': 'EMOM chin-up block',
    'Neutral-grip pull-up': 'EMOM neutral-grip pull-up block',
    'Ring pull-up': 'EMOM ring pull-up block',
  },
  'top-hold': {
    'Pull-up': 'Top hold',
    'Chin-up': 'Chin-up top hold',
    'Neutral-grip pull-up': 'Neutral-grip top hold',
    'Ring pull-up': 'Ring top hold',
  },
  'top-half': {
    'Pull-up': 'Top-half pull-up',
    'Chin-up': 'Top-half chin-up',
    'Neutral-grip pull-up': 'Top-half neutral-grip pull-up',
    'Ring pull-up': 'Top-half ring pull-up',
  },
  'mid-range-hold': {
    'Pull-up': 'Mid-range hold',
    'Chin-up': 'Chin-up mid-range hold',
    'Neutral-grip pull-up': 'Neutral-grip mid-range hold',
    'Ring pull-up': 'Ring mid-range hold',
  },
  'mid-pause': {
    'Pull-up': 'Mid-pause pull-up',
    'Chin-up': 'Mid-pause chin-up',
    'Neutral-grip pull-up': 'Mid-pause neutral-grip pull-up',
    'Ring pull-up': 'Mid-pause ring pull-up',
  },
  negative: {
    'Pull-up': 'Negative pull-up',
    'Chin-up': 'Negative chin-up',
    'Neutral-grip pull-up': 'Negative neutral-grip pull-up',
    'Ring pull-up': 'Negative ring pull-up',
  },
  scapular: {
    'Pull-up': 'Scapular pull-up',
    'Chin-up': 'Scapular chin-up',
    'Neutral-grip pull-up': 'Scapular neutral-grip pull-up',
    'Ring pull-up': 'Scapular ring pull-up',
  },
  'paused-dead-hang': {
    'Pull-up': 'Paused pull-up from dead hang',
    'Chin-up': 'Paused chin-up from dead hang',
    'Neutral-grip pull-up': 'Paused neutral-grip pull-up from dead hang',
    'Ring pull-up': 'Paused ring pull-up from dead hang',
  },
  'bottom-range-partial': {
    'Pull-up': 'Bottom-range partial pull-up',
    'Chin-up': 'Bottom-range partial chin-up',
    'Neutral-grip pull-up': 'Bottom-range partial neutral-grip pull-up',
    'Ring pull-up': 'Bottom-range partial ring pull-up',
  },
  'dead-hang': {
    'Pull-up': 'Dead hang',
    'Chin-up': 'Chin-up dead hang',
    'Neutral-grip pull-up': 'Neutral-grip dead hang',
    'Ring pull-up': 'Ring dead hang',
  },
  'active-hang': {
    'Pull-up': 'Active hang',
    'Chin-up': 'Chin-up active hang',
    'Neutral-grip pull-up': 'Neutral-grip active hang',
    'Ring pull-up': 'Ring active hang',
  },
  'grip-endurance': {
    'Pull-up': 'Grip endurance work',
    'Chin-up': 'Chin-up grip endurance work',
    'Neutral-grip pull-up': 'Neutral-grip grip endurance work',
    'Ring pull-up': 'Ring grip endurance work',
  },
}

const MOVEMENT_EXERCISE_META: Record<
  ExerciseCategory,
  Omit<MovementExerciseSpec, 'name'>
> = {
  'main-movement': {
    defaultUnit: 'reps',
    tags: ['main movement', 'max test'],
  },
  'band-assisted': {
    defaultUnit: 'reps',
    tags: ['band-assisted', 'volume'],
  },
  emom: {
    defaultUnit: 'minutes',
    tags: ['emom', 'volume'],
  },
  'top-hold': {
    defaultUnit: 'seconds',
    tags: ['top', 'isometric'],
  },
  'top-half': {
    defaultUnit: 'reps',
    tags: ['top'],
  },
  'mid-range-hold': {
    defaultUnit: 'seconds',
    tags: ['middle', 'isometric'],
  },
  'mid-pause': {
    defaultUnit: 'reps',
    tags: ['middle', 'pause'],
  },
  negative: {
    defaultUnit: 'reps',
    tags: ['middle', 'eccentric'],
  },
  scapular: {
    defaultUnit: 'reps',
    tags: ['warm-up', 'start/bottom'],
  },
  'paused-dead-hang': {
    defaultUnit: 'reps',
    tags: ['start/bottom', 'pause'],
  },
  'bottom-range-partial': {
    defaultUnit: 'reps',
    tags: ['start/bottom', 'partial'],
  },
  'dead-hang': {
    defaultUnit: 'seconds',
    tags: ['hang', 'grip'],
  },
  'active-hang': {
    defaultUnit: 'seconds',
    tags: ['hang', 'scap'],
  },
  'grip-endurance': {
    defaultUnit: 'seconds',
    tags: ['grip'],
  },
}

const CATEGORY_BY_EXERCISE_NAME = new Map<string, ExerciseCategory>()

function registerCategoryNames() {
  MAIN_MOVEMENTS.forEach((mainMovement) => {
    CATEGORY_BY_EXERCISE_NAME.set(mainMovement, 'main-movement')
    CATEGORY_BY_EXERCISE_NAME.set(
      `Main ${mainMovement.toLowerCase()} practice`,
      'main-movement',
    )
    ;(
      Object.keys(MOVEMENT_EXERCISE_LABELS) as Array<
        Exclude<ExerciseCategory, 'main-movement'>
      >
    ).forEach((category) => {
      CATEGORY_BY_EXERCISE_NAME.set(
        MOVEMENT_EXERCISE_LABELS[category][mainMovement],
        category,
      )
    })
  })
}

registerCategoryNames()

export function normalizeMainMovement(value: unknown): MainMovement {
  if (typeof value !== 'string') {
    return 'Pull-up'
  }

  const trimmed = value.trim().toLowerCase()

  if (trimmed === 'pull-up' || trimmed === 'pull up') {
    return 'Pull-up'
  }

  if (trimmed === 'chin-up' || trimmed === 'chin up' || trimmed === 'chinup') {
    return 'Chin-up'
  }

  if (
    trimmed === 'neutral-grip pull-up' ||
    trimmed === 'neutral grip pull-up' ||
    trimmed === 'neutral grip pull up' ||
    trimmed === 'neutral-grip pull up'
  ) {
    return 'Neutral-grip pull-up'
  }

  if (trimmed === 'ring pull-up' || trimmed === 'ring pull up') {
    return 'Ring pull-up'
  }

  return 'Pull-up'
}

export function getMovementExerciseName(
  mainMovement: MainMovement,
  category: ExerciseCategory,
) {
  if (category === 'main-movement') {
    return mainMovement
  }

  return MOVEMENT_EXERCISE_LABELS[category][mainMovement]
}

export function createMovementExerciseSpecs(mainMovement: MainMovement) {
  const categories: ExerciseCategory[] = [
    'main-movement',
    'band-assisted',
    'emom',
    'top-hold',
    'top-half',
    'mid-range-hold',
    'mid-pause',
    'negative',
    'scapular',
    'paused-dead-hang',
    'bottom-range-partial',
    'dead-hang',
    'active-hang',
    'grip-endurance',
  ]

  return categories.map((category) => ({
    name: getMovementExerciseName(mainMovement, category),
    defaultUnit: MOVEMENT_EXERCISE_META[category].defaultUnit,
    tags: [
      ...MOVEMENT_EXERCISE_META[category].tags,
      `movement:${mainMovement.toLowerCase()}`,
    ],
  }))
}

function getExerciseCategory(name: string) {
  return CATEGORY_BY_EXERCISE_NAME.get(name) ?? null
}

export function getResolvedMainMovementForSession(
  mainMovement: MainMovement,
  sessionType: SessionType,
  supportPainOverride: boolean,
) {
  if (
    sessionType === 'support' &&
    supportPainOverride &&
    mainMovement === 'Chin-up'
  ) {
    return 'Pull-up' as const
  }

  return mainMovement
}

function getResolvedTitle(
  step: ProgramStep,
  category: ExerciseCategory,
  resolvedMovement: MainMovement,
) {
  if (category === 'emom') {
    return `EMOM ${resolvedMovement.toLowerCase()} block`
  }

  if (category === 'main-movement') {
    return `Main ${resolvedMovement.toLowerCase()} practice`
  }

  return step.title
}

export function resolveProgramStepsForMainMovement(input: {
  exercises: Exercise[]
  mainMovement: MainMovement
  sessionType: SessionType
  steps: ProgramStep[]
  supportPainOverride: boolean
}) {
  const resolvedMovement = getResolvedMainMovementForSession(
    input.mainMovement,
    input.sessionType,
    input.supportPainOverride,
  )
  const exerciseIdByName = new Map(
    input.exercises.map((exercise) => [exercise.name, exercise.id]),
  )

  return input.steps.map((step) => {
    const exerciseName = input.exercises.find(
      (exercise) => exercise.id === step.exerciseId,
    )?.name
    const category = exerciseName ? getExerciseCategory(exerciseName) : null

    if (!category) {
      return step
    }

    const resolvedExerciseName = getMovementExerciseName(
      resolvedMovement,
      category,
    )
    const resolvedExerciseId =
      exerciseIdByName.get(resolvedExerciseName) ?? step.exerciseId

    return {
      ...step,
      exerciseId: resolvedExerciseId,
      title: getResolvedTitle(step, category, resolvedMovement),
    }
  })
}

export function getSupportBandExerciseName(
  mainMovement: MainMovement,
  sessionType: SessionType,
  supportPainOverride: boolean,
) {
  return getMovementExerciseName(
    getResolvedMainMovementForSession(
      mainMovement,
      sessionType,
      supportPainOverride,
    ),
    'band-assisted',
  )
}
