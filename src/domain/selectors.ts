import {
  classifyTrend,
  createRecommendation,
  getAdjustedProgramSteps,
  getLatestFailurePoint,
} from './recommendationEngine'
import { getPresetKey, resolvePresetTarget } from './presetProgression'
import { getSupportFocusFromFailurePoint } from './programTemplate'
import {
  buildBodyweightTrendPoints,
  getLatestBodyweightEntry,
} from './bodyweight'
import {
  getCyclePhase,
  getCurrentCycleWindow as buildCurrentCycleWindow,
} from './cycle'
import { getEntryVolumePoints, getWeeklyVolumeSummary } from './volume'
import type {
  AppData,
  BodyweightEntry,
  CycleSummaryData,
  CyclePhase,
  CycleWindow,
  Exercise,
  ExerciseEntry,
  FailurePoint,
  MaxExposure,
  MaxHistoryItem,
  MaxTestResult,
  ProgramEntryDraft,
  ProgressPoint,
  ProgramStep,
  RecommendationInput,
  RecentWorkoutItem,
  SessionType,
  SupportFocus,
  SupportRotationFocus,
  WeeklyVolumeSummary,
  WorkoutSession,
} from './types'
import { compareDateAsc, diffInDays, todayDateString } from '../lib/date'

function average(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
    ) / 10
  )
}

export function sortSessionsByDateDesc(sessions: WorkoutSession[]) {
  return [...sessions].sort((left, right) =>
    right.date.localeCompare(left.date),
  )
}

export function getSessionCounts(
  sessions: WorkoutSession[],
  today = todayDateString(),
  days = 7,
) {
  return sessions.filter((session) => diffInDays(session.date, today) <= days)
    .length
}

export function getLastWorkoutDate(sessions: WorkoutSession[]) {
  return sortSessionsByDateDesc(sessions)[0]?.date ?? null
}

export function getDaysSinceLastWorkout(
  sessions: WorkoutSession[],
  today = todayDateString(),
) {
  const lastWorkoutDate = getLastWorkoutDate(sessions)

  if (!lastWorkoutDate) {
    return null
  }

  return diffInDays(lastWorkoutDate, today)
}

export function getDaysSinceLastMax(
  sessions: WorkoutSession[],
  maxTests: MaxTestResult[],
  movement: string,
  today = todayDateString(),
) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const latestMax = [...maxTests]
    .filter((maxTest) => maxTest.movement === movement)
    .sort((left, right) => {
      const leftDate = sessionById.get(left.workoutSessionId)?.date ?? ''
      const rightDate = sessionById.get(right.workoutSessionId)?.date ?? ''
      return rightDate.localeCompare(leftDate)
    })
    .at(0)

  if (!latestMax) {
    return null
  }

  const session = sessionById.get(latestMax.workoutSessionId)

  if (!session) {
    return null
  }

  return diffInDays(session.date, today)
}

export function getRecentSignalAverages(sessions: WorkoutSession[]) {
  const recentSessions = [...sessions]
    .sort((left, right) => compareDateAsc(left.date, right.date))
    .slice(-6)

  return {
    fatigueAverage: average(
      recentSessions.flatMap((session) =>
        [session.fatigueBefore, session.fatigueAfter].filter(
          (value): value is number => typeof value === 'number',
        ),
      ),
    ),
    jointPainAverage: average(
      recentSessions.flatMap((session) =>
        [session.elbowPain, session.shoulderPain].filter(
          (value): value is number => typeof value === 'number',
        ),
      ),
    ),
  }
}

export function hasRecentJointPainSignal(
  sessions: WorkoutSession[],
  threshold = 3,
) {
  const recentSessions = [...sessions]
    .sort((left, right) => compareDateAsc(left.date, right.date))
    .slice(-6)

  return recentSessions.some(
    (session) =>
      (session.elbowPain ?? 0) >= threshold ||
      (session.shoulderPain ?? 0) >= threshold,
  )
}

export function getMaxExposures(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))

  return [...maxTests]
    .filter((maxTest) => maxTest.movement === movement)
    .map((maxTest) => ({
      date: sessionById.get(maxTest.workoutSessionId)?.date ?? '',
      reps: maxTest.reps,
      failurePoint: maxTest.failurePoint,
      qualityFlag: maxTest.qualityFlag,
    }))
    .filter((result) => result.date)
    .sort((left, right) => compareDateAsc(left.date, right.date))
}

export function getCurrentCycleWindow(
  cycleStartDate: string,
  cycleLengthDays: number,
  today = todayDateString(),
  cycleEndDate?: string,
): CycleWindow {
  return buildCurrentCycleWindow(
    cycleStartDate,
    cycleLengthDays,
    today,
    cycleEndDate,
  )
}

export function getCurrentCyclePhase(
  cycleWindow: CycleWindow,
  cycleLengthDays: number,
  today = todayDateString(),
): CyclePhase {
  return getCyclePhase(cycleWindow, cycleLengthDays, today)
}

export function getSessionsInCycle(
  sessions: WorkoutSession[],
  cycleWindow: CycleWindow,
) {
  return sessions.filter(
    (session) =>
      session.date >= cycleWindow.start && session.date <= cycleWindow.end,
  )
}

export function getLoggedSupportFocusHistory(
  sessions: WorkoutSession[],
  exerciseEntries: ExerciseEntry[],
  programTemplate: AppData['programTemplate'],
  cycleWindow?: CycleWindow,
): SupportRotationFocus[] {
  const focusByPresetKey = new Map<string, SupportRotationFocus>()

  ;(['top', 'middle', 'start/bottom'] as SupportRotationFocus[]).forEach(
    (focus) => {
      programTemplate.weakPointBlocks[focus].steps.forEach((step) => {
        focusByPresetKey.set(step.id, focus)
      })
    },
  )

  const entriesBySessionId = new Map<string, ExerciseEntry[]>()

  exerciseEntries.forEach((entry) => {
    const current = entriesBySessionId.get(entry.workoutSessionId) ?? []
    current.push(entry)
    entriesBySessionId.set(entry.workoutSessionId, current)
  })

  return sortSessionsByDateDesc(sessions)
    .reverse()
    .filter((session) => {
      if (session.sessionType !== 'support') {
        return false
      }

      if (!cycleWindow) {
        return true
      }

      return (
        session.date >= cycleWindow.start && session.date <= cycleWindow.end
      )
    })
    .flatMap((session) => {
      const focus = entriesBySessionId
        .get(session.id)
        ?.map((entry) =>
          entry.presetKey ? focusByPresetKey.get(entry.presetKey) : undefined,
        )
        .find(Boolean)

      return focus ? [focus] : []
    })
}

export function getBestMax(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
  cycleWindow?: CycleWindow,
) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))

  const relevant = maxTests.filter((maxTest) => {
    if (maxTest.movement !== movement) {
      return false
    }

    if (!cycleWindow) {
      return true
    }

    const sessionDate = sessionById.get(maxTest.workoutSessionId)?.date

    return (
      !!sessionDate &&
      sessionDate >= cycleWindow.start &&
      sessionDate <= cycleWindow.end
    )
  })

  if (relevant.length === 0) {
    return null
  }

  return Math.max(...relevant.map((maxTest) => maxTest.reps))
}

export function getSupportVolumeScore(
  entry: ExerciseEntry,
  exerciseLookup: Map<string, Exercise>,
) {
  return getEntryVolumePoints(entry, exerciseLookup)
}

export function getLatestLoggedMaxReps(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
) {
  return getMaxExposures(maxTests, sessions, movement).at(-1)?.reps ?? null
}

export function buildRecommendationInput(
  data: AppData,
  today = todayDateString(),
): RecommendationInput {
  const cycleWindow = getCurrentCycleWindow(
    data.athleteProfile.cycleStartDate,
    data.settings.cycleLengthDays,
    today,
    data.athleteProfile.cycleEndDate,
  )
  const cycleMaxResults = getMaxExposures(
    data.maxTests,
    data.sessions,
    data.athleteProfile.mainMovement,
  ).filter(
    (result) =>
      result.date >= cycleWindow.start && result.date <= cycleWindow.end,
  )
  const { fatigueAverage, jointPainAverage } = getRecentSignalAverages(
    data.sessions,
  )

  return {
    availableExercises: data.exercises
      .filter((exercise) => exercise.active)
      .map((exercise) => exercise.name),
    bandsAvailable: data.settings.bandsAvailable,
    cycleMaxResults,
    currentPhase: getCurrentCyclePhase(
      cycleWindow,
      data.settings.cycleLengthDays,
      today,
    ),
    daysSinceLastMax: getDaysSinceLastMax(
      data.sessions,
      data.maxTests,
      data.athleteProfile.mainMovement,
      today,
    ),
    daysSinceLastWorkout: getDaysSinceLastWorkout(data.sessions, today),
    exercises: data.exercises,
    fatigueAverage,
    supportPainOverride:
      hasRecentJointPainSignal(data.sessions) ||
      (jointPainAverage !== null && jointPainAverage >= 3),
    supportFocusHistory: getLoggedSupportFocusHistory(
      data.sessions,
      data.exerciseEntries,
      data.programTemplate,
      cycleWindow,
    ),
    latestFailurePoint: getLatestFailurePoint(cycleMaxResults),
    mainMovement: data.athleteProfile.mainMovement,
    programTemplate: data.programTemplate,
    sessionsLast7: getSessionCounts(data.sessions, today, 7),
  }
}

export function withComputedRecommendation(
  data: AppData,
  today = todayDateString(),
) {
  const input = buildRecommendationInput(data, today)

  return {
    ...data,
    recommendationState: createRecommendation(input, data.exercises),
  }
}

export function getCycleSummaryData(
  data: AppData,
  today = todayDateString(),
): CycleSummaryData {
  const cycleWindow = getCurrentCycleWindow(
    data.athleteProfile.cycleStartDate,
    data.settings.cycleLengthDays,
    today,
    data.athleteProfile.cycleEndDate,
  )
  const cycleSessions = getSessionsInCycle(data.sessions, cycleWindow)
  const cycleBestMax = getBestMax(
    data.maxTests,
    data.sessions,
    data.athleteProfile.mainMovement,
    cycleWindow,
  )
  const cycleLengthDays = data.settings.cycleLengthDays
  const currentDate =
    compareDateAsc(today, cycleWindow.end) > 0 ? cycleWindow.end : today
  const cycleHasStarted = compareDateAsc(today, cycleWindow.start) >= 0
  const daysElapsed = cycleHasStarted
    ? Math.min(cycleLengthDays, diffInDays(cycleWindow.start, currentDate) + 1)
    : 0
  const daysRemaining = Math.max(0, cycleLengthDays - daysElapsed)
  const progressPercent = Math.round((daysElapsed / cycleLengthDays) * 100)
  const counts = cycleSessions.reduce(
    (summary, session) => {
      summary.totalSessions += 1

      if (session.sessionType === 'max') {
        summary.maxSessions += 1
      } else {
        summary.supportSessions += 1
      }

      return summary
    },
    {
      maxSessions: 0,
      supportSessions: 0,
      totalSessions: 0,
    },
  )

  return {
    baselineMax: data.recommendationState.baselineMax,
    cycleBestMax,
    currentPhase: getCurrentCyclePhase(cycleWindow, cycleLengthDays, today),
    cycleWindow,
    daysElapsed,
    daysRemaining,
    maxSessions: counts.maxSessions,
    progressPercent,
    supportSessions: counts.supportSessions,
    summary:
      cycleBestMax === null
        ? 'No max sessions are logged in this cycle yet.'
        : `${getCurrentCyclePhase(cycleWindow, cycleLengthDays, today)} phase is active. Cycle best is ${cycleBestMax} reps. Baseline is ${data.recommendationState.baselineMax ?? cycleBestMax} reps with ${counts.maxSessions} Max day(s) and ${counts.supportSessions} Support day(s) logged.`,
    totalSessions: counts.totalSessions,
  }
}

export function buildMaxTrendPoints(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
  cycleWindow?: CycleWindow,
): ProgressPoint[] {
  return getMaxExposures(maxTests, sessions, movement)
    .filter((point) => {
      if (!cycleWindow) {
        return true
      }

      return point.date >= cycleWindow.start && point.date <= cycleWindow.end
    })
    .map((point) => ({
      date: point.date,
      value: point.reps,
    }))
}

export function buildMaxHistory(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
): MaxHistoryItem[] {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const datedMaxTests = [...maxTests]
    .filter((maxTest) => maxTest.movement === movement)
    .map((maxTest) => ({
      ...maxTest,
      date: sessionById.get(maxTest.workoutSessionId)?.date ?? '',
    }))
    .filter((maxTest) => maxTest.date)
    .sort((left, right) => compareDateAsc(left.date, right.date))

  return datedMaxTests
    .map((maxTest, index) => {
      const previousMaxTest = datedMaxTests[index - 1]

      return {
        id: maxTest.id,
        date: maxTest.date,
        reps: maxTest.reps,
        repDelta: previousMaxTest ? maxTest.reps - previousMaxTest.reps : null,
        bodyweightKgSnapshot: maxTest.bodyweightKgSnapshot,
        bodyweightDeltaKg:
          typeof maxTest.bodyweightKgSnapshot === 'number' &&
          typeof previousMaxTest?.bodyweightKgSnapshot === 'number'
            ? Math.round(
                (maxTest.bodyweightKgSnapshot -
                  previousMaxTest.bodyweightKgSnapshot) *
                  10,
              ) / 10
            : null,
        videoUrl: maxTest.videoUrl,
        trend: classifyTrend(
          datedMaxTests
            .slice(0, index + 1)
            .map((item) => ({ date: item.date, reps: item.reps })),
        ),
        failurePoint: maxTest.failurePoint,
      }
    })
    .reverse()
}

export function buildRecentWorkouts(
  sessions: WorkoutSession[],
  entries: ExerciseEntry[],
  exercises: Exercise[],
  maxTests: MaxTestResult[],
): RecentWorkoutItem[] {
  const exerciseLookup = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  )
  const maxTestBySessionId = new Map(
    maxTests.map((maxTest) => [maxTest.workoutSessionId, maxTest]),
  )
  const entriesBySession = entries.reduce((lookup, entry) => {
    const existing = lookup.get(entry.workoutSessionId) ?? []
    existing.push(entry)
    lookup.set(entry.workoutSessionId, existing)
    return lookup
  }, new Map<string, ExerciseEntry[]>())

  return sortSessionsByDateDesc(sessions).map((session) => {
    const sessionEntries = entriesBySession.get(session.id) ?? []

    return {
      ...session,
      entries: sessionEntries,
      supportVolume: sessionEntries.reduce(
        (sum, entry) => sum + getSupportVolumeScore(entry, exerciseLookup),
        0,
      ),
      maxReps: maxTestBySessionId.get(session.id)?.reps ?? null,
    }
  })
}

export function getMaxTrendClassificationForNewResult(
  previousExposureResults: MaxExposure[],
  nextReps: number,
  date: string,
) {
  return classifyTrend([
    ...previousExposureResults,
    {
      date,
      reps: nextReps,
    },
  ])
}

export function getCycleStatsByType(sessions: WorkoutSession[]) {
  const counts: Record<SessionType, number> = {
    max: 0,
    support: 0,
  }

  sessions.forEach((session) => {
    counts[session.sessionType] += 1
  })

  return counts
}

export function getDefaultSupportFocus(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
): SupportFocus {
  const cycleResults = getMaxExposures(maxTests, sessions, movement)
  return getSupportFocusFromFailurePoint(getLatestFailurePoint(cycleResults))
}

export function getProgramStepsForRecommendation(
  data: AppData,
  sessionType: SessionType,
  supportFocus?: SupportFocus,
): ProgramStep[] {
  const input = buildRecommendationInput(data)
  return getAdjustedProgramSteps(
    {
      ...input,
      daysSinceLastWorkout:
        sessionType === 'max'
          ? Math.max(3, input.daysSinceLastWorkout ?? 3)
          : 0,
    },
    sessionType,
    supportFocus,
  )
}

export function buildProgramEntryDrafts(
  steps: ProgramStep[],
  exercises: Exercise[],
  presetProgressions: AppData['presetProgressions'],
  latestMaxReps: number | null,
): ProgramEntryDraft[] {
  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  )
  const progressionByKey = new Map(
    presetProgressions.map((state) => [state.presetKey, state]),
  )

  return steps.map((step) => {
    const exercise = exerciseById.get(step.exerciseId)
    const target = resolvePresetTarget(
      step,
      progressionByKey.get(getPresetKey(step)),
      latestMaxReps,
    )

    return {
      templateStepId: step.id,
      presetKey: getPresetKey(step),
      label: step.title,
      exerciseId: step.exerciseId,
      exerciseName: exercise?.name ?? '',
      target,
      notes: step.notes,
      outcome: '',
    }
  })
}

export function getLatestMaxFailurePoint(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
): FailurePoint | null {
  return getLatestFailurePoint(getMaxExposures(maxTests, sessions, movement))
}

export function getLatestSavedBodyweightEntry(entries: BodyweightEntry[]) {
  return getLatestBodyweightEntry(entries)
}

export function buildBodyweightPoints(
  entries: BodyweightEntry[],
  cycleWindow?: CycleWindow,
) {
  return buildBodyweightTrendPoints(entries, cycleWindow)
}

export function getCurrentWeekVolumeSummary(
  data: AppData,
  today = todayDateString(),
): WeeklyVolumeSummary {
  const cycleWindow = getCurrentCycleWindow(
    data.athleteProfile.cycleStartDate,
    data.settings.cycleLengthDays,
    today,
    data.athleteProfile.cycleEndDate,
  )

  return getWeeklyVolumeSummary({
    cycleWindow,
    exercises: data.exercises,
    exerciseEntries: data.exerciseEntries,
    maxTests: data.maxTests,
    sessions: data.sessions,
    today,
    trend: data.recommendationState.trend,
  })
}

export function getFailurePointPattern(
  maxHistory: MaxHistoryItem[],
): { point: FailurePoint; count: number } | null {
  const withFailure = maxHistory
    .filter((item) => item.failurePoint && item.failurePoint !== 'not sure')
    .slice(0, 3)

  if (withFailure.length < 2) {
    return null
  }

  const firstPoint = withFailure[0]!.failurePoint!
  const matchCount = withFailure.filter(
    (item) => item.failurePoint === firstPoint,
  ).length

  if (matchCount < 2) {
    return null
  }

  return { point: firstPoint, count: matchCount }
}

export interface PainTrendPoint {
  weekStart: string
  elbowAvg: number | null
  shoulderAvg: number | null
}

function getWeekStartDate(dateString: string): string {
  const date = new Date(
    Number(dateString.slice(0, 4)),
    Number(dateString.slice(5, 7)) - 1,
    Number(dateString.slice(8, 10)),
  )
  const dayOfWeek = date.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  date.setDate(date.getDate() - daysToMonday)
  return todayDateString(date)
}

export function buildPainTrendPoints(
  sessions: WorkoutSession[],
  cycleWindow: CycleWindow,
): PainTrendPoint[] {
  const weekBuckets = new Map<string, { elbow: number[]; shoulder: number[] }>()

  for (const session of sessions) {
    if (session.date < cycleWindow.start || session.date > cycleWindow.end) {
      continue
    }

    if (session.elbowPain === undefined && session.shoulderPain === undefined) {
      continue
    }

    const weekStart = getWeekStartDate(session.date)
    let bucket = weekBuckets.get(weekStart)

    if (!bucket) {
      bucket = { elbow: [], shoulder: [] }
      weekBuckets.set(weekStart, bucket)
    }

    if (typeof session.elbowPain === 'number') {
      bucket.elbow.push(session.elbowPain)
    }

    if (typeof session.shoulderPain === 'number') {
      bucket.shoulder.push(session.shoulderPain)
    }
  }

  return [...weekBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, bucket]) => ({
      weekStart,
      elbowAvg:
        bucket.elbow.length > 0
          ? Math.round(
              (bucket.elbow.reduce((sum, v) => sum + v, 0) /
                bucket.elbow.length) *
                10,
            ) / 10
          : null,
      shoulderAvg:
        bucket.shoulder.length > 0
          ? Math.round(
              (bucket.shoulder.reduce((sum, v) => sum + v, 0) /
                bucket.shoulder.length) *
                10,
            ) / 10
          : null,
    }))
}
