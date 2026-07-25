import { buildBodyweightTrendPoints } from './bodyweight'
import { buildMaxTrendPoints, buildRecentWorkouts } from './selectors'
import type {
  AppData,
  CycleWindow,
  GreaseGrooveEntry,
  RecentWorkoutItem,
  SessionType,
} from './types'
import { getGreaseGrooveTrainingLoadPoints } from './volume'

export interface ProgressCycleOption {
  id: string
  isCurrent: boolean
  lengthDays: number
  window: CycleWindow
}

export interface WorkoutChartPoint {
  date: string
  sessionType: SessionType
}

export interface ProgressScope {
  bodyweightEntries: AppData['bodyweightEntries']
  bodyweightPoints: ReturnType<typeof buildBodyweightTrendPoints>
  changeFromFirstMax: number | null
  firstMax: number | null
  greaseGrooveEntries: GreaseGrooveEntry[]
  latestMax: number | null
  maxPoints: ReturnType<typeof buildMaxTrendPoints>
  maxSessions: number
  bestMax: number | null
  supportSessions: number
  trainingLoadPoints: number
  window: CycleWindow
  workoutPoints: WorkoutChartPoint[]
  workouts: RecentWorkoutItem[]
}

export function getProgressCycleOptions(data: AppData): ProgressCycleOption[] {
  const currentWindow = {
    start: data.athleteProfile.cycleStartDate,
    end: data.athleteProfile.cycleEndDate,
  }
  const archived = [...data.cycleHistory]
    .filter(
      (cycle) =>
        cycle.startDate !== currentWindow.start ||
        cycle.endDate !== currentWindow.end,
    )
    .sort((left, right) => right.startDate.localeCompare(left.startDate))
    .map(
      (cycle) =>
        ({
          id: cycle.id,
          isCurrent: false,
          lengthDays: cycle.lengthDays,
          window: {
            start: cycle.startDate,
            end: cycle.endDate,
          },
        }) satisfies ProgressCycleOption,
    )

  return [
    {
      id: 'current',
      isCurrent: true,
      lengthDays: data.settings.cycleLengthDays,
      window: currentWindow,
    },
    ...archived,
  ]
}

function isInWindow(date: string, window: CycleWindow) {
  return date >= window.start && date <= window.end
}

function getLifetimeWindow(data: AppData, today: string): CycleWindow {
  const dates = [
    ...data.sessions.map((session) => session.date),
    ...data.bodyweightEntries.map((entry) => entry.date),
    ...data.greaseGrooveEntries.map((entry) => entry.date),
  ].sort()

  return {
    start: dates[0] ?? data.athleteProfile.cycleStartDate,
    end: dates.at(-1) && dates.at(-1)! > today ? dates.at(-1)! : today,
  }
}

export function getProgressScope(
  data: AppData,
  cycle: ProgressCycleOption | null,
  today: string,
  overrides?: {
    maxPoints?: ProgressScope['maxPoints']
    workouts?: RecentWorkoutItem[]
  },
): ProgressScope {
  const window = cycle?.window ?? getLifetimeWindow(data, today)
  const workouts = (
    overrides?.workouts ??
    buildRecentWorkouts(
      data.sessions,
      data.exerciseEntries,
      data.exercises,
      data.maxTests,
    )
  ).filter((workout) => !cycle || isInWindow(workout.date, window))
  const greaseGrooveEntries = data.greaseGrooveEntries.filter(
    (entry) => !cycle || isInWindow(entry.date, window),
  )
  const bodyweightEntries = data.bodyweightEntries.filter(
    (entry) => !cycle || isInWindow(entry.date, window),
  )
  const maxPoints =
    overrides?.maxPoints ??
    buildMaxTrendPoints(
      data.maxTests,
      data.sessions,
      data.athleteProfile.mainMovement,
      cycle ? window : undefined,
    )
  const firstMax = maxPoints[0]?.value ?? null
  const latestMax = maxPoints.at(-1)?.value ?? null
  const trainingLoadPoints =
    Math.round(
      (workouts.reduce(
        (total, workout) => total + (workout.trainingLoadPoints ?? 0),
        0,
      ) +
        greaseGrooveEntries.reduce(
          (total, entry) =>
            total + getGreaseGrooveTrainingLoadPoints(entry.reps),
          0,
        )) *
        10,
    ) / 10

  return {
    bodyweightEntries,
    bodyweightPoints: buildBodyweightTrendPoints(
      data.bodyweightEntries,
      cycle ? window : undefined,
    ),
    changeFromFirstMax:
      firstMax !== null && latestMax !== null ? latestMax - firstMax : null,
    firstMax,
    greaseGrooveEntries,
    latestMax,
    maxPoints,
    maxSessions: workouts.filter((session) => session.sessionType === 'max')
      .length,
    bestMax:
      maxPoints.length > 0
        ? Math.max(...maxPoints.map((point) => point.value))
        : null,
    supportSessions: workouts.filter(
      (session) => session.sessionType === 'support',
    ).length,
    trainingLoadPoints,
    window,
    workoutPoints: workouts.map((session) => ({
      date: session.date,
      sessionType: session.sessionType,
    })),
    workouts,
  }
}
