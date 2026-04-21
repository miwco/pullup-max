import { getCurrentTrainingWeek } from './cycle'
import type {
  CycleWindow,
  Exercise,
  ExerciseEntry,
  MaxTestResult,
  WeeklyVolumeSummary,
  WorkoutSession,
} from './types'
import { addDays, diffInDays, todayDateString } from '../lib/date'

const DEFAULT_WEEKLY_VOLUME_TARGET = 48
const WEEKLY_VOLUME_STEP = 2
const BRAKE_REDUCTION_FACTOR = 0.85

function roundVolume(value: number) {
  return Math.max(0, Math.round(value))
}

function getRepFactor(exercise: Exercise) {
  if (
    exercise.tags.includes('main movement') ||
    exercise.name.startsWith('EMOM ') ||
    exercise.name.includes('Mid-pause ') ||
    exercise.name.includes('Paused ') && exercise.name.includes('dead hang')
  ) {
    return 1
  }

  if (exercise.name.startsWith('Band-assisted ')) {
    return 0.75
  }

  if (
    exercise.name.includes('Top-half ') ||
    exercise.name.startsWith('Negative ') ||
    exercise.name.includes('Bottom-range partial ')
  ) {
    return 0.8
  }

  if (exercise.name.startsWith('Scapular ')) {
    return 0.55
  }

  return exercise.type === 'max'
    ? 1
    : exercise.type === 'support'
      ? 0.75
      : 0.6
}

function getSecondsFactor(exercise: Exercise) {
  if (
    exercise.name.includes('Top hold') ||
    exercise.name.includes('Mid-range hold')
  ) {
    return 0.2
  }

  if (exercise.name.includes('Active hang')) {
    return 0.16
  }

  if (
    exercise.name.includes('Dead hang') ||
    exercise.name.includes('Grip endurance work')
  ) {
    return 0.14
  }

  return exercise.defaultUnit === 'seconds' ? 0.15 : 0.12
}

export function getEntryVolumePoints(
  entry: ExerciseEntry,
  exerciseLookup: Map<string, Exercise>,
) {
  if (entry.outcome === 'fail') {
    return 0
  }

  const exercise = exerciseLookup.get(entry.exerciseId)

  if (!exercise) {
    return 0
  }

  const setCount = Math.max(1, entry.sets ?? 1)

  if (typeof entry.reps === 'number') {
    return roundVolume(entry.reps * setCount * getRepFactor(exercise))
  }

  if (typeof entry.durationSeconds === 'number') {
    return roundVolume(
      entry.durationSeconds * setCount * getSecondsFactor(exercise),
    )
  }

  return 0
}

export function getMaxTestVolumePoints(reps: number) {
  return roundVolume(reps)
}

function getWeekWindowForIndex(cycleWindow: CycleWindow, weekIndex: number) {
  const weekStart = addDays(cycleWindow.start, weekIndex * 7)
  const cappedEnd = addDays(weekStart, 6)

  return {
    weekStart,
    weekEnd: cappedEnd > cycleWindow.end ? cycleWindow.end : cappedEnd,
  }
}

function getWeeklyCompletedPoints(
  weekStart: string,
  weekEnd: string,
  sessions: WorkoutSession[],
  entries: ExerciseEntry[],
  exercises: Exercise[],
  maxTests: MaxTestResult[],
) {
  const sessionIds = new Set(
    sessions
      .filter((session) => session.date >= weekStart && session.date <= weekEnd)
      .map((session) => session.id),
  )
  const exerciseLookup = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  )
  const entryPoints = entries
    .filter((entry) => sessionIds.has(entry.workoutSessionId))
    .reduce(
      (sum, entry) => sum + getEntryVolumePoints(entry, exerciseLookup),
      0,
    )
  const maxPoints = maxTests
    .filter((maxTest) => sessionIds.has(maxTest.workoutSessionId))
    .reduce((sum, maxTest) => sum + getMaxTestVolumePoints(maxTest.reps), 0)

  return entryPoints + maxPoints
}

export function getWeeklyVolumeSummary(input: {
  cycleWindow: CycleWindow
  exercises: Exercise[]
  exerciseEntries: ExerciseEntry[]
  maxTests: MaxTestResult[]
  sessions: WorkoutSession[]
  today?: string
  trend: 'rising' | 'stable' | 'falling'
}): WeeklyVolumeSummary {
  const today = input.today ?? todayDateString()
  const { weekNumber, weekStart, weekEnd } = getCurrentTrainingWeek(
    input.cycleWindow,
    today,
  )
  const completedWeekCount = Math.max(
    0,
    Math.floor(diffInDays(input.cycleWindow.start, today) / 7),
  )
  let targetPoints = DEFAULT_WEEKLY_VOLUME_TARGET

  for (let weekIndex = 1; weekIndex <= completedWeekCount; weekIndex += 1) {
    targetPoints += WEEKLY_VOLUME_STEP
  }

  let brakeApplied = false

  if (input.trend === 'falling') {
    const previousWeekIndex = Math.max(0, weekNumber - 2)
    const previousWeek = getWeekWindowForIndex(
      input.cycleWindow,
      previousWeekIndex,
    )
    const previousCompletedPoints = getWeeklyCompletedPoints(
      previousWeek.weekStart,
      previousWeek.weekEnd,
      input.sessions,
      input.exerciseEntries,
      input.exercises,
      input.maxTests,
    )
    brakeApplied = true
    targetPoints = Math.max(
      DEFAULT_WEEKLY_VOLUME_TARGET,
      roundVolume(
        (previousCompletedPoints || targetPoints) * BRAKE_REDUCTION_FACTOR,
      ),
    )
  }

  const completedPoints = getWeeklyCompletedPoints(
    weekStart,
    weekEnd,
    input.sessions,
    input.exerciseEntries,
    input.exercises,
    input.maxTests,
  )
  const remainingPoints = Math.max(0, targetPoints - completedPoints)
  const volumeStatus =
    remainingPoints > 0
      ? 'behind'
      : completedPoints > targetPoints
        ? 'ahead'
        : 'on-track'
  const message = brakeApplied
    ? remainingPoints > 0
      ? `Results are dipping, so a volume brake is active. Keep this week near ${targetPoints} points and only add about ${remainingPoints} more.`
      : `Results are dipping, so a volume brake is active. Stay around ${targetPoints} points this week.`
    : remainingPoints > 0
      ? `You are ${remainingPoints} volume point${remainingPoints === 1 ? '' : 's'} behind this week.`
      : `You are on track for this week's volume target of ${targetPoints} points.`

  return {
    brakeApplied,
    completedPoints,
    message,
    remainingPoints,
    targetPoints,
    volumeStatus,
    weekEnd,
    weekNumber,
    weekStart,
  }
}
