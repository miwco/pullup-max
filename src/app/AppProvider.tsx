import { startTransition, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppContext, type AppContextValue, type AppNotice } from './appContext'
import { createSeedData } from '../domain/defaults'
import {
  getBodyweightSnapshotValue,
  upsertBodyweightEntry,
} from '../domain/bodyweight'
import {
  parseImportBundle,
  serializeExportBundle,
} from '../domain/importExport'
import { applyPresetOutcomes } from '../domain/presetProgression'
import { getAllProgramSteps } from '../domain/programTemplate'
import {
  buildBodyweightPoints,
  buildMaxHistory,
  buildMaxTrendPoints,
  buildPainTrendPoints,
  buildProgramEntryDrafts,
  buildRecentWorkouts,
  getCurrentWeekVolumeSummary,
  getBestMax,
  getCurrentCycleWindow,
  getCycleSummaryData,
  getDaysSinceLastMax,
  getDaysSinceLastWorkout,
  getLatestLoggedMaxReps,
  getLatestSavedBodyweightEntry,
  getMaxExposures,
  getMaxTrendClassificationForNewResult,
  getProgramStepsForRecommendation,
  withComputedRecommendation,
} from '../domain/selectors'
import type {
  AppData,
  AppSettings,
  AthleteProfile,
  Exercise,
  ProgramTemplate,
  SaveSessionInput,
  SessionType,
} from '../domain/types'
import { todayDateString } from '../lib/date'
import { createId } from '../lib/id'
import {
  loadOrSeedAppData,
  persistAppData,
  replaceAppData,
  resetAppData,
} from '../storage/indexedDb'

const EMPTY_APP_DATA = withComputedRecommendation(
  createSeedData(todayDateString()),
  todayDateString(),
)
const LOAD_TIMEOUT_MS = 8000

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_APP_DATA)
  const [isReady, setIsReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const today = todayDateString()
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        const stored = await Promise.race([
          loadOrSeedAppData(today),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(
                new Error(
                  'Local storage took too long to respond. Try reloading the app or using a standard browser mode with storage enabled.',
                ),
              )
            }, LOAD_TIMEOUT_MS)
          }),
        ])
        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        if (cancelled) {
          return
        }

        startTransition(() => {
          setData(stored)
          setIsReady(true)
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load local training data.',
        )
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [])

  const {
    cycleSummary,
    recentWorkouts,
    cycleMaxTrendPoints,
    allTimeMaxTrendPoints,
    bodyweightTrendPoints,
    painTrendPoints,
    maxHistory,
    allTimeBestMax,
    latestLoggedMaxReps,
    activeExercises,
    latestBodyweightEntry,
    weeklyVolumeSummary,
    daysSinceLastMax,
    daysSinceLastWorkout,
  } = useMemo(() => {
    const cycleWindow = getCurrentCycleWindow(
      data.athleteProfile.cycleStartDate,
      data.settings.cycleLengthDays,
      todayDateString(),
      data.athleteProfile.cycleEndDate,
    )
    return {
      cycleSummary: getCycleSummaryData(data),
      recentWorkouts: buildRecentWorkouts(
        data.sessions,
        data.exerciseEntries,
        data.exercises,
        data.maxTests,
      ),
      cycleMaxTrendPoints: buildMaxTrendPoints(
        data.maxTests,
        data.sessions,
        data.athleteProfile.mainMovement,
        cycleWindow,
      ),
      allTimeMaxTrendPoints: buildMaxTrendPoints(
        data.maxTests,
        data.sessions,
        data.athleteProfile.mainMovement,
      ),
      bodyweightTrendPoints: buildBodyweightPoints(
        data.bodyweightEntries,
        cycleWindow,
      ),
      painTrendPoints: buildPainTrendPoints(data.sessions, cycleWindow),
      maxHistory: buildMaxHistory(
        data.maxTests,
        data.sessions,
        data.athleteProfile.mainMovement,
      ),
      allTimeBestMax: getBestMax(
        data.maxTests,
        data.sessions,
        data.athleteProfile.mainMovement,
      ),
      latestLoggedMaxReps: getLatestLoggedMaxReps(
        data.maxTests,
        data.sessions,
        data.athleteProfile.mainMovement,
      ),
      activeExercises: data.exercises.filter((exercise) => exercise.active),
      latestBodyweightEntry: getLatestSavedBodyweightEntry(
        data.bodyweightEntries,
      ),
      weeklyVolumeSummary: getCurrentWeekVolumeSummary(data),
      daysSinceLastMax: getDaysSinceLastMax(
        data.sessions,
        data.maxTests,
        data.athleteProfile.mainMovement,
      ),
      daysSinceLastWorkout: getDaysSinceLastWorkout(data.sessions),
    }
  }, [data])

  async function saveNextData(nextData: AppData, successMessage?: string) {
    try {
      await persistAppData(nextData)
      startTransition(() => {
        setData(nextData)
      })

      if (successMessage) {
        setNotice({
          tone: 'success',
          message: successMessage,
        })
      }

      return true
    } catch (error) {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to save local data.',
      })
      return false
    }
  }

  function getProgramPrefill(sessionType: SessionType) {
    return buildProgramEntryDrafts(
      getProgramStepsForRecommendation(data, sessionType),
      data.exercises,
      data.presetProgressions,
      latestLoggedMaxReps,
    )
  }

  async function saveBodyweight(date: string, weightKg: number) {
    return saveNextData(
      withComputedRecommendation(
        {
          ...data,
          bodyweightEntries: upsertBodyweightEntry(
            data.bodyweightEntries,
            date,
            weightKg,
          ),
        },
        todayDateString(),
      ),
      'Bodyweight saved.',
    )
  }

  async function saveSession(input: SaveSessionInput) {
    const sessionId = createId('session')
    const existingMaxExposures = getMaxExposures(
      data.maxTests,
      data.sessions,
      data.athleteProfile.mainMovement,
    )
    const maxBodyweightSnapshot = getBodyweightSnapshotValue(
      data.bodyweightEntries,
      data.settings.bodyweightTrackingEnabled,
    )
    const session = {
      id: sessionId,
      ...input.session,
      notes: input.session.notes ?? '',
    }
    const entries = input.entries.map((entry) => ({
      ...entry,
      id: createId('entry'),
      workoutSessionId: sessionId,
      notes: entry.notes ?? undefined,
    }))
    const stepLookup = new Map(
      getAllProgramSteps(data.programTemplate).map((step) => [step.id, step]),
    )
    const maxTest = input.maxTest
      ? {
          id: createId('max'),
          workoutSessionId: sessionId,
          reps: input.maxTest.reps,
          movement: data.athleteProfile.mainMovement,
          videoUrl: input.maxTest.videoUrl,
          bodyweightKgSnapshot: maxBodyweightSnapshot,
          failurePoint: input.maxTest.failurePoint,
          qualityFlag: input.maxTest.qualityFlag,
          trendClassification: getMaxTrendClassificationForNewResult(
            existingMaxExposures,
            input.maxTest.reps,
            input.session.date,
          ),
        }
      : null

    const nextData = withComputedRecommendation(
      {
        ...data,
        sessions: [...data.sessions, session],
        exerciseEntries: [...data.exerciseEntries, ...entries],
        maxTests: maxTest ? [...data.maxTests, maxTest] : data.maxTests,
        presetProgressions: applyPresetOutcomes(
          data.presetProgressions,
          entries,
          stepLookup,
          latestLoggedMaxReps,
        ),
      },
      todayDateString(),
    )

    return saveNextData(nextData, 'Workout saved.')
  }

  async function updateExercise(input: Omit<Exercise, 'id'> & { id?: string }) {
    const nextExercise: Exercise = input.id
      ? {
          ...input,
          id: input.id,
        }
      : {
          ...input,
          id: createId('exercise'),
        }

    const nextExercises = input.id
      ? data.exercises.map((exercise) =>
          exercise.id === input.id ? nextExercise : exercise,
        )
      : [...data.exercises, nextExercise]

    await saveNextData(
      withComputedRecommendation(
        {
          ...data,
          exercises: nextExercises,
        },
        todayDateString(),
      ),
      input.id ? 'Exercise updated.' : 'Exercise added.',
    )
  }

  async function deleteExercise(exerciseId: string) {
    const isReferenced = data.exerciseEntries.some(
      (entry) => entry.exerciseId === exerciseId,
    )

    if (isReferenced) {
      const archived = data.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, active: false } : exercise,
      )

      await saveNextData(
        withComputedRecommendation(
          {
            ...data,
            exercises: archived,
          },
          todayDateString(),
        ),
        'Exercise archived because it is already referenced in history.',
      )
      return
    }

    await saveNextData(
      withComputedRecommendation(
        {
          ...data,
          exercises: data.exercises.filter(
            (exercise) => exercise.id !== exerciseId,
          ),
        },
        todayDateString(),
      ),
      'Exercise deleted.',
    )
  }

  async function saveSettingsAndProgram(
    profileUpdates: Partial<AthleteProfile>,
    settingsUpdates: Partial<AppSettings> | undefined,
    nextTemplate: ProgramTemplate,
  ) {
    return saveNextData(
      withComputedRecommendation(
        {
          ...data,
          athleteProfile: {
            ...data.athleteProfile,
            ...profileUpdates,
          },
          settings: {
            ...data.settings,
            ...settingsUpdates,
          },
          programTemplate: nextTemplate,
        },
        todayDateString(),
      ),
      'Settings and program updated.',
    )
  }

  async function dismissOnboarding() {
    return saveNextData(
      withComputedRecommendation(
        {
          ...data,
          settings: { ...data.settings, onboardingDismissed: true },
        },
        todayDateString(),
      ),
    )
  }

  async function importBackup(rawText: string) {
    const parsed = parseImportBundle(rawText)

    if (!parsed.ok) {
      setNotice({
        tone: 'error',
        message: parsed.error,
      })
      return false
    }

    try {
      const imported = await replaceAppData(
        parsed.value.data,
        todayDateString(),
      )
      startTransition(() => {
        setData(imported)
      })
      setNotice({
        tone: 'success',
        message: 'Backup imported.',
      })
      return true
    } catch (error) {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to import that backup.',
      })
      return false
    }
  }

  async function resetAllData() {
    const reset = await resetAppData(todayDateString())
    startTransition(() => {
      setData(reset)
    })
    setNotice({
      tone: 'success',
      message: 'App data reset.',
    })
  }

  const contextValue: AppContextValue = {
    activeExercises,
    allTimeBestMax,
    allTimeMaxTrendPoints,
    bodyweightTrendPoints,
    cycleMaxTrendPoints,
    painTrendPoints,
    cycleSummary,
    data,
    daysSinceLastMax,
    daysSinceLastWorkout,
    deleteExercise,
    dismissOnboarding,
    errorMessage,
    exportBackup: () => serializeExportBundle(data),
    getProgramPrefill,
    importBackup,
    isReady,
    latestBodyweightEntry,
    maxHistory,
    notice,
    recentWorkouts,
    resetAllData,
    saveBodyweight,
    saveSession,
    saveSettingsAndProgram,
    setNotice,
    weeklyVolumeSummary,
    updateExercise,
  }

  return <AppContext value={contextValue}>{children}</AppContext>
}
