import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
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
import {
  applyFinishProgression,
  buildFinishWorkoutEntries,
} from '../domain/finishWorkout'
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
  FinishWorkoutDraft,
  FinishWorkoutSettings,
  ProgramTemplate,
  SaveSessionInput,
  SaveFinishWorkoutInput,
  SessionType,
  SupportFocus,
  WorkoutLogDraft,
} from '../domain/types'
import { todayDateString } from '../lib/date'
import { createId } from '../lib/id'
import {
  clearWorkoutDraft as deleteStoredWorkoutDraft,
  clearFinishWorkoutDraft as deleteStoredFinishWorkoutDraft,
  loadFinishWorkoutDraft,
  loadWorkoutDraft,
  loadOrSeedAppData,
  persistAppDataDiff,
  persistWorkoutDraft,
  persistFinishWorkoutDraft,
  replaceAppData,
  resetAppData,
} from '../storage/indexedDb'

const EMPTY_APP_DATA = withComputedRecommendation(
  createSeedData(todayDateString()),
  todayDateString(),
)
const LOAD_TIMEOUT_MS = 8000

async function readStorageDurability(): Promise<
  AppContextValue['storageDurability']
> {
  if (!navigator.storage?.persisted) {
    return {
      isPersisted: null,
      isSupported: false,
    }
  }

  return {
    isPersisted: await navigator.storage.persisted(),
    isSupported: true,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_APP_DATA)
  const [isReady, setIsReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutLogDraft | null>(null)
  const [finishWorkoutDraft, setFinishWorkoutDraft] =
    useState<FinishWorkoutDraft | null>(null)
  const [storageDurability, setStorageDurability] = useState<
    AppContextValue['storageDurability']
  >({
    isPersisted: null,
    isSupported: false,
  })

  const refreshStorageDurability = useCallback(async () => {
    setStorageDurability(await readStorageDurability())
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const today = todayDateString()
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        const [stored, storedWorkoutDraft, storedFinishWorkoutDraft] =
          await Promise.race([
            Promise.all([
              loadOrSeedAppData(today),
              loadWorkoutDraft(),
              loadFinishWorkoutDraft(),
            ]),
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
          setWorkoutDraft(storedWorkoutDraft)
          setFinishWorkoutDraft(storedFinishWorkoutDraft)
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

  useEffect(() => {
    let cancelled = false

    async function checkStorageDurability() {
      const nextStorageDurability = await readStorageDurability()

      if (!cancelled) {
        setStorageDurability(nextStorageDurability)
      }
    }

    void checkStorageDurability()

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
      daysSinceLastWorkout: getDaysSinceLastWorkout(
        data.sessions,
        todayDateString(),
        data.greaseGrooveEntries,
      ),
    }
  }, [data])

  async function saveNextData(nextData: AppData, successMessage?: string) {
    try {
      await persistAppDataDiff(data, nextData)
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

  function getProgramPrefill(
    sessionType: SessionType,
    supportFocus?: SupportFocus,
  ) {
    return buildProgramEntryDrafts(
      getProgramStepsForRecommendation(data, sessionType, supportFocus),
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

  async function saveGreaseGrooveEntry(reps: number, date = todayDateString()) {
    const normalizedReps = Math.round(reps)

    if (!Number.isFinite(normalizedReps) || normalizedReps <= 0) {
      return false
    }

    return saveNextData(
      withComputedRecommendation(
        {
          ...data,
          greaseGrooveEntries: [
            ...data.greaseGrooveEntries,
            {
              id: createId('gg'),
              date,
              reps: normalizedReps,
              loggedAt: new Date().toISOString(),
            },
          ],
        },
        todayDateString(),
      ),
      'GG set added.',
    )
  }

  async function deleteGreaseGrooveEntry(entryId: string) {
    return saveNextData(
      withComputedRecommendation(
        {
          ...data,
          greaseGrooveEntries: data.greaseGrooveEntries.filter(
            (entry) => entry.id !== entryId,
          ),
        },
        todayDateString(),
      ),
      'GG set removed.',
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

  async function saveFinishWorkout(input: SaveFinishWorkoutInput) {
    const finishWorkout = data.finishWorkout
    const session = {
      id: createId('finish-session'),
      date: input.date,
      completedAt: new Date().toISOString(),
      entries: buildFinishWorkoutEntries(finishWorkout, input.outcomes),
    }
    const saved = await saveNextData(
      {
        ...data,
        finishWorkout: {
          ...finishWorkout,
          progression: applyFinishProgression(
            finishWorkout.progression,
            input.outcomes,
          ),
          sessions: [...finishWorkout.sessions, session],
        },
      },
      'Finish workout saved.',
    )

    if (saved) {
      await clearCurrentFinishWorkoutDraft()
    }

    return saved
  }

  async function saveFinishWorkoutSettings(settings: FinishWorkoutSettings) {
    return saveNextData({
      ...data,
      finishWorkout: {
        ...data.finishWorkout,
        settings,
      },
    })
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

  const saveCurrentWorkoutDraft = useCallback(
    async (draft: WorkoutLogDraft) => {
      try {
        await persistWorkoutDraft(draft)
        setWorkoutDraft(draft)
        return true
      } catch (error) {
        setNotice({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to save workout draft.',
        })
        return false
      }
    },
    [],
  )

  const clearCurrentWorkoutDraft = useCallback(async () => {
    try {
      await deleteStoredWorkoutDraft()
      setWorkoutDraft(null)
      return true
    } catch (error) {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to clear workout draft.',
      })
      return false
    }
  }, [])

  const saveCurrentFinishWorkoutDraft = useCallback(
    async (draft: FinishWorkoutDraft) => {
      try {
        await persistFinishWorkoutDraft(draft)
        setFinishWorkoutDraft(draft)
        return true
      } catch (error) {
        setNotice({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to save Finish workout draft.',
        })
        return false
      }
    },
    [],
  )

  const clearCurrentFinishWorkoutDraft = useCallback(async () => {
    try {
      await deleteStoredFinishWorkoutDraft()
      setFinishWorkoutDraft(null)
      return true
    } catch (error) {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to clear Finish workout draft.',
      })
      return false
    }
  }, [])

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
      await clearCurrentWorkoutDraft()
      await clearCurrentFinishWorkoutDraft()
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

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) {
      setNotice({
        tone: 'info',
        message:
          'This browser does not expose persistent storage controls. Keep periodic JSON backups.',
      })
      await refreshStorageDurability()
      return false
    }

    const isPersisted = await navigator.storage.persist()
    await refreshStorageDurability()

    setNotice({
      tone: isPersisted ? 'success' : 'info',
      message: isPersisted
        ? 'Persistent storage enabled for this device.'
        : 'The browser did not grant persistent storage. Keep periodic JSON backups.',
    })

    return isPersisted
  }

  async function resetAllData() {
    const reset = await resetAppData(todayDateString())
    await clearCurrentWorkoutDraft()
    await clearCurrentFinishWorkoutDraft()
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
    clearWorkoutDraft: clearCurrentWorkoutDraft,
    clearFinishWorkoutDraft: clearCurrentFinishWorkoutDraft,
    deleteExercise,
    deleteGreaseGrooveEntry,
    dismissOnboarding,
    errorMessage,
    exportBackup: () => serializeExportBundle(data),
    getProgramPrefill,
    importBackup,
    isReady,
    finishWorkoutDraft,
    latestBodyweightEntry,
    maxHistory,
    notice,
    recentWorkouts,
    requestPersistentStorage,
    resetAllData,
    saveBodyweight,
    saveGreaseGrooveEntry,
    saveSession,
    saveFinishWorkout,
    saveFinishWorkoutDraft: saveCurrentFinishWorkoutDraft,
    saveFinishWorkoutSettings,
    saveSettingsAndProgram,
    saveWorkoutDraft: saveCurrentWorkoutDraft,
    setNotice,
    storageDurability,
    weeklyVolumeSummary,
    workoutDraft,
    updateExercise,
  }

  return <AppContext value={contextValue}>{children}</AppContext>
}
