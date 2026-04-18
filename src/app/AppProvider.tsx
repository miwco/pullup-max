import {
  createContext,
  startTransition,
  use,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  serializeExportBundle,
  parseImportBundle,
} from '../domain/importExport'
import {
  buildMaxTrendPoints,
  buildRecentWorkouts,
  getBestMax,
  getCurrentCycleWindow,
  getCycleSummaryData,
  getDaysSinceLastMax,
  getMaxExposures,
  getMaxTrendClassificationForNewResult,
  getSupportVolumeScore,
  withComputedRecommendation,
} from '../domain/selectors'
import type {
  AppData,
  AppSettings,
  AthleteProfile,
  Exercise,
  SaveSessionInput,
} from '../domain/types'
import { createId } from '../lib/id'
import { todayDateString } from '../lib/date'
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
  cycleSummary: ReturnType<typeof getCycleSummaryData>
  data: AppData
  daysSinceLastMax: number | null
  deleteExercise: (exerciseId: string) => Promise<void>
  errorMessage: string | null
  exportBackup: () => string
  importBackup: (rawText: string) => Promise<boolean>
  isReady: boolean
  maxTrendPoints: ReturnType<typeof buildMaxTrendPoints>
  notice: AppNotice | null
  recentWorkouts: ReturnType<typeof buildRecentWorkouts>
  resetAllData: () => Promise<void>
  saveSession: (input: SaveSessionInput) => Promise<boolean>
  setNotice: (notice: AppNotice | null) => void
  supportVolumeTrend: Array<{
    date: string
    value: number
  }>
  updateExercise: (
    input: Omit<Exercise, 'id'> & { id?: string },
  ) => Promise<void>
  updatePreferences: (
    profileUpdates: Partial<AthleteProfile>,
    settingsUpdates?: Partial<AppSettings>,
  ) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

const EMPTY_APP_DATA = withComputedRecommendation(
  {
    athleteProfile: {
      id: 'athlete-default',
      mainMovement: 'Pull-up',
      cycleStartDate: todayDateString(),
      bodyweightTrackingEnabled: false,
      bandsAvailable: true,
      fatigueSensitivity: 3,
      jointPainSensitivity: 3,
      preferredSupportMethods: [
        'Density pull-up block',
        'Ladder pull-up block',
        'Cluster pull-up block',
        'Band-assisted pull-up',
      ],
      notes: '',
    },
    settings: {
      defaultMovement: 'Pull-up',
      bandsAvailable: true,
      bodyweightTrackingEnabled: false,
      fatigueSensitivity: 3,
      jointPainSensitivity: 3,
      exportFormatVersion: 1,
    },
    exercises: [],
    sessions: [],
    exerciseEntries: [],
    maxTests: [],
    recommendationState: {
      id: 'recommendation-current',
      phase: 'build',
      trend: 'stable',
      nextSessionType: 'max',
      suggestedExercises: ['Pull-up'],
      supportEmphasis: 'establish the first clean max test',
      deloadLevel: 'none',
      explanation:
        'You do not have a max test yet. Start with one clean all-out set to anchor the plan.',
      computedAt: new Date().toISOString(),
      maxSessionDue: true,
    },
  },
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

  const cycleSummary = getCycleSummaryData(data)
  const recentWorkouts = buildRecentWorkouts(
    data.sessions,
    data.exerciseEntries,
    data.exercises,
  )
  const maxTrendPoints = buildMaxTrendPoints(
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
  const exerciseLookup = new Map(
    data.exercises.map((exercise) => [exercise.id, exercise]),
  )
  const cycleWindow = getCurrentCycleWindow(data.athleteProfile.cycleStartDate)
  const supportVolumeTrend = recentWorkouts
    .filter(
      (session) =>
        session.date >= cycleWindow.start &&
        (session.sessionType === 'support' || session.sessionType === 'deload'),
    )
    .slice(0, 10)
    .reverse()
    .map((session) => ({
      date: session.date,
      value: session.entries.reduce(
        (sum, entry) => sum + getSupportVolumeScore(entry, exerciseLookup),
        0,
      ),
    }))
  const daysSinceLastMax = getDaysSinceLastMax(
    data.sessions,
    data.maxTests,
    data.athleteProfile.mainMovement,
  )

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

  async function saveSession(input: SaveSessionInput) {
    const sessionId = createId('session')
    const existingMaxExposures = getMaxExposures(
      data.maxTests,
      data.sessions,
      data.athleteProfile.mainMovement,
    )
    const phaseAtTime =
      input.session.sessionType === 'deload'
        ? 'deload'
        : data.recommendationState.phase
    const session = {
      id: sessionId,
      phaseAtTime,
      ...input.session,
      notes: input.session.notes ?? '',
    }
    const entries = input.entries.map((entry) => ({
      ...entry,
      id: createId('entry'),
      workoutSessionId: sessionId,
    }))
    const maxTest = input.maxTest
      ? {
          id: createId('max'),
          workoutSessionId: sessionId,
          reps: input.maxTest.reps,
          movement: data.athleteProfile.mainMovement,
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
        'Exercise is already in your history, so it was archived instead of deleted.',
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

  async function updatePreferences(
    profileUpdates: Partial<AthleteProfile>,
    settingsUpdates?: Partial<AppSettings>,
  ) {
    const nextProfile: AthleteProfile = {
      ...data.athleteProfile,
      ...profileUpdates,
    }
    const nextSettings: AppSettings = {
      ...data.settings,
      ...settingsUpdates,
      defaultMovement:
        settingsUpdates?.defaultMovement ??
        profileUpdates.mainMovement ??
        data.settings.defaultMovement,
      bandsAvailable:
        settingsUpdates?.bandsAvailable ??
        profileUpdates.bandsAvailable ??
        data.settings.bandsAvailable,
      bodyweightTrackingEnabled:
        settingsUpdates?.bodyweightTrackingEnabled ??
        profileUpdates.bodyweightTrackingEnabled ??
        data.settings.bodyweightTrackingEnabled,
      fatigueSensitivity:
        settingsUpdates?.fatigueSensitivity ??
        profileUpdates.fatigueSensitivity ??
        data.settings.fatigueSensitivity,
      jointPainSensitivity:
        settingsUpdates?.jointPainSensitivity ??
        profileUpdates.jointPainSensitivity ??
        data.settings.jointPainSensitivity,
    }

    const syncedProfile: AthleteProfile = {
      ...nextProfile,
      mainMovement: nextSettings.defaultMovement,
      bandsAvailable: nextSettings.bandsAvailable,
      bodyweightTrackingEnabled: nextSettings.bodyweightTrackingEnabled,
      fatigueSensitivity: nextSettings.fatigueSensitivity,
      jointPainSensitivity: nextSettings.jointPainSensitivity,
    }

    await saveNextData(
      withComputedRecommendation(
        {
          ...data,
          athleteProfile: syncedProfile,
          settings: nextSettings,
        },
        todayDateString(),
      ),
      'Settings updated.',
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
    cycleSummary,
    data,
    daysSinceLastMax,
    deleteExercise,
    errorMessage,
    exportBackup: () => serializeExportBundle(data),
    importBackup,
    isReady,
    maxTrendPoints,
    notice,
    recentWorkouts,
    resetAllData,
    saveSession,
    setNotice,
    supportVolumeTrend,
    updateExercise,
    updatePreferences,
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
