import { getCurrentTrainingWeek } from './cycle'
import type {
  CyclePhase,
  CycleWindow,
  Exercise,
  ExerciseEntry,
  GreaseGrooveEntry,
  MaxTestResult,
  WeeklyVolumeSummary,
  WorkoutSession,
} from './types'
import { addDays, todayDateString } from '../lib/date'

const DEFAULT_WEEKLY_VOLUME_TARGET = 48
const BRAKE_REDUCTION_FACTOR = 0.85
const FAILED_EXERCISE_FACTOR = 1.08
export const GREASE_GROOVE_REP_LOAD = 0.2
const PHASE_LOAD_FACTORS: Record<CyclePhase, number> = {
  build: 1.05,
  develop: 1,
  peak: 0.75,
}
const MAX_QUALITY_FACTORS = {
  clean: 1,
  grindy: 1.05,
  partial: 1.1,
} as const

function roundLoad(value: number) {
  return Math.max(0, Math.round(value * 10) / 10)
}

function getRepFactor(exercise: Exercise) {
  if (
    exercise.tags.includes('main movement') ||
    exercise.name.startsWith('EMOM ') ||
    exercise.name.includes('Mid-pause ') ||
    (exercise.name.includes('Paused ') && exercise.name.includes('dead hang'))
  ) {
    return 1
  }

  if (exercise.name.startsWith('Band-assisted ')) {
    return 0.6
  }

  if (
    exercise.name.includes('Top-half ') ||
    exercise.name.startsWith('Negative ') ||
    exercise.name.includes('Bottom-range partial ')
  ) {
    return 0.75
  }

  if (exercise.name.startsWith('Scapular ')) {
    return 0.4
  }

  return exercise.type === 'max' ? 1 : exercise.type === 'support' ? 0.7 : 0.6
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

export function getEntryTrainingLoadPoints(
  entry: ExerciseEntry,
  exerciseLookup: Map<string, Exercise>,
) {
  const exercise = exerciseLookup.get(entry.exerciseId)

  if (!exercise) {
    return null
  }

  const setCount = Math.max(1, entry.sets ?? 1)
  const fatigueFactor = entry.outcome === 'fail' ? FAILED_EXERCISE_FACTOR : 1

  if (typeof entry.reps === 'number') {
    return roundLoad(
      entry.reps * setCount * getRepFactor(exercise) * fatigueFactor,
    )
  }

  if (typeof entry.durationSeconds === 'number') {
    return roundLoad(
      entry.durationSeconds *
        setCount *
        getSecondsFactor(exercise) *
        fatigueFactor,
    )
  }

  return null
}

export function getMaxTestTrainingLoadPoints(
  reps: number,
  qualityFlag?: MaxTestResult['qualityFlag'],
) {
  const qualityFactor = qualityFlag ? MAX_QUALITY_FACTORS[qualityFlag] : 1
  return roundLoad(reps * qualityFactor)
}

export function getGreaseGrooveTrainingLoadPoints(reps: number) {
  return roundLoad(Math.max(0, reps) * GREASE_GROOVE_REP_LOAD)
}

export function getWorkoutTrainingLoadPoints(
  entries: ExerciseEntry[],
  exerciseLookup: Map<string, Exercise>,
  maxTest?: MaxTestResult,
) {
  const entryPoints = entries.flatMap((entry) => {
    const points = getEntryTrainingLoadPoints(entry, exerciseLookup)
    return points === null ? [] : [points]
  })
  const hasMaxTest = typeof maxTest?.reps === 'number'

  if (entryPoints.length === 0 && !hasMaxTest) {
    return null
  }

  return roundLoad(
    entryPoints.reduce((sum, points) => sum + points, 0) +
      (hasMaxTest
        ? getMaxTestTrainingLoadPoints(maxTest.reps, maxTest.qualityFlag)
        : 0),
  )
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
  greaseGrooveEntries: GreaseGrooveEntry[],
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
      (sum, entry) =>
        sum + (getEntryTrainingLoadPoints(entry, exerciseLookup) ?? 0),
      0,
    )
  const maxPoints = maxTests
    .filter((maxTest) => sessionIds.has(maxTest.workoutSessionId))
    .reduce(
      (sum, maxTest) =>
        sum + getMaxTestTrainingLoadPoints(maxTest.reps, maxTest.qualityFlag),
      0,
    )
  const greaseGroovePoints = greaseGrooveEntries
    .filter((entry) => entry.date >= weekStart && entry.date <= weekEnd)
    .reduce(
      (sum, entry) => sum + getGreaseGrooveTrainingLoadPoints(entry.reps),
      0,
    )

  return roundLoad(entryPoints + maxPoints + greaseGroovePoints)
}

function getRecentCompletedWeekLoads(
  cycleWindow: CycleWindow,
  currentWeekNumber: number,
  sessions: WorkoutSession[],
  entries: ExerciseEntry[],
  exercises: Exercise[],
  maxTests: MaxTestResult[],
  greaseGrooveEntries: GreaseGrooveEntry[],
) {
  const latestCompletedWeekIndex = currentWeekNumber - 2
  const firstWeekIndex = Math.max(0, latestCompletedWeekIndex - 2)
  const loads: number[] = []

  for (
    let weekIndex = firstWeekIndex;
    weekIndex <= latestCompletedWeekIndex;
    weekIndex += 1
  ) {
    const week = getWeekWindowForIndex(cycleWindow, weekIndex)
    const load = getWeeklyCompletedPoints(
      week.weekStart,
      week.weekEnd,
      sessions,
      entries,
      exercises,
      maxTests,
      greaseGrooveEntries,
    )

    if (load > 0) {
      loads.push(load)
    }
  }

  return loads
}

function getMedian(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2
  }

  return sorted[middle]!
}

export function getWeeklyVolumeSummary(input: {
  cycleWindow: CycleWindow
  exercises: Exercise[]
  exerciseEntries: ExerciseEntry[]
  maxTests: MaxTestResult[]
  greaseGrooveEntries?: GreaseGrooveEntry[]
  sessions: WorkoutSession[]
  today?: string
  phase: CyclePhase
  trend: 'rising' | 'stable' | 'falling'
}): WeeklyVolumeSummary {
  const today = input.today ?? todayDateString()
  const { weekNumber, weekStart, weekEnd } = getCurrentTrainingWeek(
    input.cycleWindow,
    today,
  )
  const recentLoads = getRecentCompletedWeekLoads(
    input.cycleWindow,
    weekNumber,
    input.sessions,
    input.exerciseEntries,
    input.exercises,
    input.maxTests,
    input.greaseGrooveEntries ?? [],
  )
  const baselineLoad =
    recentLoads.length > 0
      ? getMedian(recentLoads)
      : DEFAULT_WEEKLY_VOLUME_TARGET
  let targetPoints = Math.round(baselineLoad * PHASE_LOAD_FACTORS[input.phase])

  let brakeApplied = false

  if (input.trend === 'falling') {
    brakeApplied = true
    targetPoints = Math.max(
      1,
      Math.round(targetPoints * BRAKE_REDUCTION_FACTOR),
    )
  }

  const completedPoints = getWeeklyCompletedPoints(
    weekStart,
    weekEnd,
    input.sessions,
    input.exerciseEntries,
    input.exercises,
    input.maxTests,
    input.greaseGrooveEntries ?? [],
  )
  const remainingPoints = roundLoad(Math.max(0, targetPoints - completedPoints))
  const volumeStatus =
    remainingPoints > 0
      ? 'behind'
      : completedPoints > targetPoints
        ? 'ahead'
        : 'on-track'
  const message = brakeApplied
    ? remainingPoints > 0
      ? `Results are dipping, so the load brake is active. Keep this week near ${targetPoints} points and add about ${remainingPoints} more.`
      : `Results are dipping, so the load brake is active. Stay around ${targetPoints} points this week.`
    : remainingPoints > 0
      ? `You have ${remainingPoints} training-load point${remainingPoints === 1 ? '' : 's'} left this week.`
      : `You reached this week's training-load target of ${targetPoints} points.`

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
