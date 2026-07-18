import { getAllProgramSteps } from './programTemplate'
import { applyPresetOutcomes } from './presetProgression'
import {
  getLatestLoggedMaxReps,
  getMaxTrendClassificationForNewResult,
  withComputedRecommendation,
} from './selectors'
import type {
  AppData,
  MaxExposure,
  MaxTestResult,
  WorkoutCorrectionInput,
} from './types'
import { compareDateAsc, todayDateString } from '../lib/date'

function sortSessionIdsChronologically(data: AppData) {
  return data.sessions
    .map((session, index) => ({ session, index }))
    .sort(
      (left, right) =>
        compareDateAsc(left.session.date, right.session.date) ||
        left.index - right.index,
    )
    .map(({ session }) => session.id)
}

export function rebuildWorkoutDerivedState(
  data: AppData,
  today = todayDateString(),
) {
  const entriesBySessionId = new Map<string, AppData['exerciseEntries']>()
  const maxTestsBySessionId = new Map<string, MaxTestResult[]>()

  data.exerciseEntries.forEach((entry) => {
    const entries = entriesBySessionId.get(entry.workoutSessionId) ?? []
    entries.push(entry)
    entriesBySessionId.set(entry.workoutSessionId, entries)
  })

  data.maxTests.forEach((maxTest) => {
    const tests = maxTestsBySessionId.get(maxTest.workoutSessionId) ?? []
    tests.push(maxTest)
    maxTestsBySessionId.set(maxTest.workoutSessionId, tests)
  })

  const stepLookup = new Map(
    getAllProgramSteps(data.programTemplate).map((step) => [step.id, step]),
  )
  const exposuresByMovement = new Map<string, MaxExposure[]>()
  const recomputedMaxTests: MaxTestResult[] = []
  let presetProgressions: AppData['presetProgressions'] = []

  sortSessionIdsChronologically(data).forEach((sessionId) => {
    const latestMaxReps = getLatestLoggedMaxReps(
      recomputedMaxTests,
      data.sessions,
      data.athleteProfile.mainMovement,
    )

    presetProgressions = applyPresetOutcomes(
      presetProgressions,
      entriesBySessionId.get(sessionId) ?? [],
      stepLookup,
      latestMaxReps,
    )

    const session = data.sessions.find((item) => item.id === sessionId)
    if (!session) return
    ;(maxTestsBySessionId.get(sessionId) ?? []).forEach((maxTest) => {
      const previousExposures = exposuresByMovement.get(maxTest.movement) ?? []
      const trendClassification = getMaxTrendClassificationForNewResult(
        previousExposures,
        maxTest.reps,
        session.date,
      )
      const recomputed = { ...maxTest, trendClassification }
      recomputedMaxTests.push(recomputed)
      exposuresByMovement.set(maxTest.movement, [
        ...previousExposures,
        {
          date: session.date,
          reps: maxTest.reps,
          failurePoint: maxTest.failurePoint,
          qualityFlag: maxTest.qualityFlag,
        },
      ])
    })
  })

  return withComputedRecommendation(
    {
      ...data,
      maxTests: recomputedMaxTests,
      presetProgressions,
    },
    today,
  )
}

export function applyWorkoutCorrection(
  data: AppData,
  correction: WorkoutCorrectionInput,
  today = todayDateString(),
) {
  const nextData: AppData = {
    ...data,
    sessions: data.sessions.map((session) =>
      session.id === correction.sessionId
        ? {
            ...session,
            date: correction.date,
            fatigueBefore: correction.fatigueBefore,
            fatigueAfter: correction.fatigueAfter,
            elbowPain: correction.elbowPain,
            shoulderPain: correction.shoulderPain,
            notes: correction.notes,
          }
        : session,
    ),
    exerciseEntries: data.exerciseEntries.map((entry) => {
      const outcome = correction.entryOutcomes[entry.id]
      return entry.workoutSessionId === correction.sessionId && outcome
        ? { ...entry, outcome }
        : entry
    }),
    maxTests: data.maxTests.map((maxTest) =>
      maxTest.workoutSessionId === correction.sessionId && correction.maxTest
        ? {
            ...maxTest,
            reps: correction.maxTest.reps,
            videoUrl: correction.maxTest.videoUrl,
            failurePoint: correction.maxTest.failurePoint,
            qualityFlag: correction.maxTest.qualityFlag,
          }
        : maxTest,
    ),
  }

  return rebuildWorkoutDerivedState(nextData, today)
}

export function removeWorkoutSession(
  data: AppData,
  sessionId: string,
  today = todayDateString(),
) {
  return rebuildWorkoutDerivedState(
    {
      ...data,
      sessions: data.sessions.filter((session) => session.id !== sessionId),
      exerciseEntries: data.exerciseEntries.filter(
        (entry) => entry.workoutSessionId !== sessionId,
      ),
      maxTests: data.maxTests.filter(
        (maxTest) => maxTest.workoutSessionId !== sessionId,
      ),
    },
    today,
  )
}
