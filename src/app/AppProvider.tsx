import {
  createContext,
  startTransition,
  use,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createSeedData } from '../domain/defaults'
import {
  getBodyweightSnapshotValue,
  upsertBodyweightEntry,
} from '../domain/bodyweight'
import {
  parseImportBundle,
  serializeExportBundle,
} from '../domain/importExport'
import {
  buildBodyweightPoints,
  buildMaxHistory,
  buildMaxTrendPoints,
  buildProgramEntryDrafts,
  buildRecentWorkouts,
  getCurrentWeekVolumeSummary,
  getBestMax,
  getCurrentCycleWindow,
  getCycleSummaryData,
  getDaysSinceLastMax,
  getDaysSinceLastWorkout,
  getLatestSavedBodyweightEntry,
  getMaxExposures,
  getMaxTrendClassificationForNewResult,
  getProgramStepsForRecommendation,
  getSupportVolumeScore,
  withComputedRecommendation,
} from '../domain/selectors'
import type {
  AppData,
  AppSettings,
  AthleteProfile,
  BodyweightEntry,
  Exercise,
  ProgramEntryDraft,
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

type NoticeTone = 'info' | 'error' | 'success'

interface AppNotice {
  tone: NoticeTone
  message: string
}

interface AppContextValue {
  activeExercises: Exercise[]
  allTimeBestMax: number | null
  bodyweightTrendPoints: Array<{
    date: string
    value: number
  }>
  cycleMaxTrendPoints: ReturnType<typeof buildMaxTrendPoints>
  cycleSummary: ReturnType<typeof getCycleSummaryData>
  data: AppData
  daysSinceLastMax: number | null
  daysSinceLastWorkout: number | null
  deleteExercise: (exerciseId: string) => Promise<void>
  errorMessage: string | null
  exportBackup: () => string
  getProgramPrefill: (sessionType: SessionType) => ProgramEntryDraft[]
  importBackup: (rawText: string) => Promise<boolean>
  isReady: boolean
  latestBodyweightEntry: BodyweightEntry | null
  maxHistory: ReturnType<typeof buildMaxHistory>
  notice: AppNotice | null
  recentWorkouts: ReturnType<typeof buildRecentWorkouts>
  resetAllData: () => Promise<void>
  saveBodyweight: (date: string, weightKg: number) => Promise<boolean>
  saveSession: (input: SaveSessionInput) => Promise<boolean>
  saveSettingsAndProgram: (
    profileUpdates: Partial<AthleteProfile>,
    settingsUpdates: Partial<AppSettings> | undefined,
    nextTemplate: ProgramTemplate,
  ) => Promise<boolean>
  setNotice: (notice: AppNotice | null) => void
  supportVolumeTrend: Array<{
    date: string
    value: number
  }>
  weeklyVolumeSummary: ReturnType<typeof getCurrentWeekVolumeSummary>
  updateExercise: (
    input: Omit<Exercise, 'id'> & { id?: string },
  ) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

const EMPTY_APP_DATA = withComputedRecommendation(
  createSeedData(todayDateString()),
  todayDateString(),
)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_APP_DATA)
  const [isReady, setIsReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const stored = await loadOrSeedAppData(todayDateString())

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

  const cycleWindow = getCurrentCycleWindow(
    data.athleteProfile.cycleStartDate,
    data.settings.cycleLengthDays,
  )
  const cycleSummary = getCycleSummaryData(data)
  const recentWorkouts = buildRecentWorkouts(
    data.sessions,
    data.exerciseEntries,
    data.exercises,
    data.maxTests,
  )
  const cycleMaxTrendPoints = buildMaxTrendPoints(
    data.maxTests,
    data.sessions,
    data.athleteProfile.mainMovement,
    cycleWindow,
  )
  const bodyweightTrendPoints = buildBodyweightPoints(
    data.bodyweightEntries,
    cycleWindow,
  )
  const maxHistory = buildMaxHistory(
    data.maxTests,
    data.sessions,
    data.athleteProfile.mainMovement,
  )
  const allTimeBestMax = getBestMax(
    data.maxTests,
    data.sessions,
    data.athleteProfile.mainMovement,
  )
  const activeExercises = data.exercises.filter((exercise) => exercise.active)
  const latestBodyweightEntry = getLatestSavedBodyweightEntry(
    data.bodyweightEntries,
  )
  const exerciseLookup = new Map(
    data.exercises.map((exercise) => [exercise.id, exercise]),
  )
  const supportVolumeTrend = recentWorkouts
    .filter(
      (session) =>
        session.date >= cycleWindow.start &&
        session.date <= cycleWindow.end &&
        session.sessionType === 'support',
    )
    .slice(0, 12)
    .reverse()
    .map((session) => ({
      date: session.date,
      value: session.entries.reduce(
        (sum, entry) => sum + getSupportVolumeScore(entry, exerciseLookup),
        0,
      ),
    }))
  const weeklyVolumeSummary = getCurrentWeekVolumeSummary(data)
  const daysSinceLastMax = getDaysSinceLastMax(
    data.sessions,
    data.maxTests,
    data.athleteProfile.mainMovement,
  )
  const daysSinceLastWorkout = getDaysSinceLastWorkout(data.sessions)

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
    bodyweightTrendPoints,
    cycleMaxTrendPoints,
    cycleSummary,
    data,
    daysSinceLastMax,
    daysSinceLastWorkout,
    deleteExercise,
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
    supportVolumeTrend,
    weeklyVolumeSummary,
    updateExercise,
  }

  return <AppContext value={contextValue}>{children}</AppContext>
}

export function useAppState() {
  const context = use(AppContext)

  if (!context) {
    throw new Error('useAppState must be used within AppProvider.')
  }

  return context
}
