import type { ProgramBlock, ProgramStep } from '../../domain/types'

interface ExerciseNameLookup {
  get: (exerciseId: string) => string | undefined
}

function formatStepPrescription(step: ProgramStep) {
  if (typeof step.sets === 'number' && typeof step.reps === 'number') {
    return `${step.sets}x${step.reps}`
  }

  if (typeof step.minReps === 'number' || typeof step.maxReps === 'number') {
    const min = step.minReps ?? step.maxReps
    const max = step.maxReps ?? step.minReps
    return `${min}-${max} reps`
  }

  if (
    typeof step.emomMinutes === 'number' &&
    typeof step.emomReps === 'number'
  ) {
    return `${step.emomMinutes}m EMOM @ ${step.emomReps}`
  }

  if (typeof step.holdSeconds === 'number') {
    return `${step.holdSeconds}s hold`
  }

  if (typeof step.durationSeconds === 'number') {
    return `${step.durationSeconds}s`
  }

  return null
}

function formatExerciseSummary(
  steps: ProgramStep[],
  exerciseNameById: ExerciseNameLookup,
) {
  const exerciseNames = Array.from(
    new Set(
      steps
        .map((step) => exerciseNameById.get(step.exerciseId))
        .filter((name): name is string => Boolean(name)),
    ),
  )

  if (exerciseNames.length === 0) {
    return null
  }

  if (exerciseNames.length <= 2) {
    return exerciseNames.join(', ')
  }

  return `${exerciseNames.slice(0, 2).join(', ')} +${exerciseNames.length - 2}`
}

function formatEmphasis(steps: ProgramStep[]) {
  const bodyweightOptions = new Set(
    steps
      .map((step) => step.bodyweightOption)
      .filter((value): value is NonNullable<ProgramStep['bodyweightOption']> =>
        Boolean(value),
      ),
  )

  if (bodyweightOptions.has('either')) {
    return 'bodyweight or band'
  }

  if (bodyweightOptions.has('band')) {
    return 'band emphasis'
  }

  if (bodyweightOptions.has('bodyweight')) {
    return 'bodyweight focus'
  }

  if (steps.some((step) => step.bandAllowed)) {
    return 'band allowed'
  }

  return null
}

export function summarizeProgramBlock(
  block: ProgramBlock,
  exerciseNameById: ExerciseNameLookup,
) {
  const parts = [
    `${block.steps.length} step${block.steps.length === 1 ? '' : 's'}`,
  ]
  const exerciseSummary = formatExerciseSummary(block.steps, exerciseNameById)
  const prescriptions = block.steps
    .map(formatStepPrescription)
    .filter((value): value is string => Boolean(value))
  const emphasis = formatEmphasis(block.steps)

  if (exerciseSummary) {
    parts.push(exerciseSummary)
  }

  if (prescriptions.length > 0) {
    parts.push(prescriptions.slice(0, 2).join(', '))
  }

  if (emphasis) {
    parts.push(emphasis)
  }

  return parts.join(' • ')
}
