import { createRecommendation, classifyTrend } from './recommendationEngine'
import type {
  AppData,
  CycleSummaryData,
  CycleWindow,
  Exercise,
  ExerciseEntry,
  FailurePoint,
  MaxExposure,
  MaxTestResult,
  RecommendationInput,
  SessionType,
  WorkoutSession,
} from './types'
import {
  addDays,
  compareDateAsc,
  diffInDays,
  todayDateString,
} from '../lib/date'

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
  const recentSessions = sortSessionsByDateDesc(sessions).slice(0, 6)
  const fatigueValues = recentSessions.flatMap((session) =>
    [session.fatigueBefore, session.fatigueAfter].filter(
      (value): value is number => typeof value === 'number',
    ),
  )
  const jointPainValues = recentSessions.flatMap((session) =>
    [session.elbowPain, session.shoulderPain].filter(
      (value): value is number => typeof value === 'number',
    ),
  )

  return {
    fatigueAverage: average(fatigueValues),
    jointPainAverage: average(jointPainValues),
  }
}

export function getRepeatedFailurePoint(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const recentRelevant = [...maxTests]
    .filter(
      (maxTest) =>
        maxTest.movement === movement && maxTest.failurePoint !== undefined,
    )
    .sort((left, right) => {
      const leftDate = sessionById.get(left.workoutSessionId)?.date ?? ''
      const rightDate = sessionById.get(right.workoutSessionId)?.date ?? ''
      return rightDate.localeCompare(leftDate)
    })
    .slice(0, 3)

  const counts = new Map<FailurePoint, number>()

  recentRelevant.forEach((maxTest) => {
    const failurePoint = maxTest.failurePoint

    if (!failurePoint || failurePoint === 'not sure') {
      return
    }

    counts.set(failurePoint, (counts.get(failurePoint) ?? 0) + 1)
  })

  const repeated = [...counts.entries()].find(([, count]) => count >= 2)
  return repeated?.[0] ?? null
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
  today = todayDateString(),
): CycleWindow {
  if (cycleStartDate > today) {
    return {
      start: today,
      end: addDays(today, 89),
    }
  }

  let currentStart = cycleStartDate

  while (addDays(currentStart, 89) < today) {
    currentStart = addDays(currentStart, 90)
  }

  return {
    start: currentStart,
    end: addDays(currentStart, 89),
  }
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
  const exercise = exerciseLookup.get(entry.exerciseId)

  if (!exercise) {
    return 0
  }

  const setCount = entry.sets ?? 1

  if (typeof entry.reps === 'number') {
    return entry.reps * setCount
  }

  if (typeof entry.durationSeconds === 'number') {
    return Math.round(entry.durationSeconds / 15)
  }

  if (exercise.defaultUnit === 'sets') {
    return setCount * 4
  }

  return setCount
}

export function buildRecommendationInput(
  data: AppData,
  today = todayDateString(),
): RecommendationInput {
  const { athleteProfile, exercises, maxTests, sessions } = data
  const cycleWindow = getCurrentCycleWindow(
    athleteProfile.cycleStartDate,
    today,
  )
  const cycleAgeDays = diffInDays(cycleWindow.start, today)
  const lastMaxResults = getMaxExposures(
    maxTests,
    sessions,
    athleteProfile.mainMovement,
  ).slice(-3)
  const { fatigueAverage, jointPainAverage } = getRecentSignalAverages(sessions)

  return {
    availableExercises: exercises
      .filter((exercise) => exercise.active)
      .map((exercise) => exercise.name),
    cycleAgeDays,
    daysSinceLastMax: getDaysSinceLastMax(
      sessions,
      maxTests,
      athleteProfile.mainMovement,
      today,
    ),
    jointPainAverage,
    lastMaxResults,
    mainMovement: athleteProfile.mainMovement,
    fatigueAverage,
    fatigueSensitivity: athleteProfile.fatigueSensitivity,
    jointPainSensitivity: athleteProfile.jointPainSensitivity,
    preferredSupportMethods: athleteProfile.preferredSupportMethods,
    repeatedFailurePoint: getRepeatedFailurePoint(
      maxTests,
      sessions,
      athleteProfile.mainMovement,
    ),
    sessionsLast7: getSessionCounts(sessions, today, 7),
    sessionsLast14: getSessionCounts(sessions, today, 14),
    totalMaxSessions: getMaxExposures(
      maxTests,
      sessions,
      athleteProfile.mainMovement,
    ).length,
    bandsAvailable: athleteProfile.bandsAvailable,
  }
}

export function withComputedRecommendation(
  data: AppData,
  today = todayDateString(),
) {
  return {
    ...data,
    recommendationState: createRecommendation(
      buildRecommendationInput(data, today),
    ),
  }
}

function getDeloadPeriods(sessions: WorkoutSession[]) {
  const deloadSessions = [...sessions]
    .filter(
      (session) =>
        session.sessionType === 'deload' || session.phaseAtTime === 'deload',
    )
    .sort((left, right) => compareDateAsc(left.date, right.date))

  if (deloadSessions.length === 0) {
    return []
  }

  const periods: Array<{ start: string; end: string }> = []

  deloadSessions.forEach((session) => {
    const lastPeriod = periods.at(-1)

    if (!lastPeriod) {
      periods.push({
        start: session.date,
        end: session.date,
      })
      return
    }

    if (diffInDays(lastPeriod.end, session.date) <= 10) {
      lastPeriod.end = session.date
      return
    }

    periods.push({
      start: session.date,
      end: session.date,
    })
  })

  return periods
}

export function getCycleSummaryData(
  data: AppData,
  today = todayDateString(),
): CycleSummaryData {
  const cycleWindow = getCurrentCycleWindow(
    data.athleteProfile.cycleStartDate,
    today,
  )
  const cycleSessions = getSessionsInCycle(data.sessions, cycleWindow)
  const cycleMax = getBestMax(
    data.maxTests,
    data.sessions,
    data.athleteProfile.mainMovement,
    cycleWindow,
  )
  const counts = cycleSessions.reduce(
    (summary, session) => {
      summary.totalSessions += 1

      if (session.sessionType === 'max') {
        summary.maxSessions += 1
      }

      if (session.sessionType === 'support') {
        summary.supportSessions += 1
      }

      if (session.sessionType === 'recovery') {
        summary.recoverySessions += 1
      }

      return summary
    },
    {
      maxSessions: 0,
      recoverySessions: 0,
      supportSessions: 0,
      totalSessions: 0,
    },
  )
  const deloadPeriods = getDeloadPeriods(cycleSessions)
  const summaryParts = [
    cycleMax !== null
      ? `Cycle best is ${cycleMax} reps across ${counts.maxSessions} max exposures.`
      : 'No max exposures logged in this cycle yet.',
    counts.supportSessions > counts.recoverySessions
      ? 'Support work currently outweighs recovery work.'
      : 'Recovery work is keeping pace with support work.',
    deloadPeriods.length > 0
      ? `${deloadPeriods.length} deload period${deloadPeriods.length > 1 ? 's are' : ' is'} recorded.`
      : 'No deload periods have been needed so far.',
  ]

  return {
    cycleBestMax: cycleMax,
    deloadPeriods,
    currentPhase: data.recommendationState.phase,
    cycleWindow,
    maxSessions: counts.maxSessions,
    recoverySessions: counts.recoverySessions,
    supportSessions: counts.supportSessions,
    totalSessions: counts.totalSessions,
    summary: summaryParts.join(' '),
  }
}

export function buildMaxTrendPoints(
  maxTests: MaxTestResult[],
  sessions: WorkoutSession[],
  movement: string,
) {
  const exposures = getMaxExposures(maxTests, sessions, movement)
  return exposures.map((exposure) => ({
    date: exposure.date,
    value: exposure.reps,
    trend:
      classifyTrend(
        exposures.filter((item) => item.date <= exposure.date).slice(-3),
      ) ?? 'stable',
  }))
}

export function buildRecentWorkouts(
  sessions: WorkoutSession[],
  entries: ExerciseEntry[],
  exercises: Exercise[],
) {
  const exerciseLookup = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  )
  const entriesBySession = entries.reduce((lookup, entry) => {
    const existing = lookup.get(entry.workoutSessionId) ?? []
    existing.push(entry)
    lookup.set(entry.workoutSessionId, existing)
    return lookup
  }, new Map<string, ExerciseEntry[]>())

  return sortSessionsByDateDesc(sessions).map((session) => {
    const sessionEntries = entriesBySession.get(session.id) ?? []
    const supportVolume = sessionEntries.reduce(
      (sum, entry) => sum + getSupportVolumeScore(entry, exerciseLookup),
      0,
    )

    return {
      ...session,
      entries: sessionEntries,
      supportVolume,
    }
  })
}

export function getCycleStatsByType(sessions: WorkoutSession[]) {
  const counts: Record<SessionType, number> = {
    max: 0,
    support: 0,
    recovery: 0,
    deload: 0,
  }

  sessions.forEach((session) => {
    counts[session.sessionType] += 1
  })

  return counts
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
