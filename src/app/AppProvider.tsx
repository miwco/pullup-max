import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import {
  getCycleEndDateForLength,
  getCycleLengthDaysFromDates,
} from '../domain/cycle'
import { getAllProgramSteps } from '../domain/programTemplate'
import {
  applyWorkoutCorrection,
  removeWorkoutSession,
} from '../domain/workoutCorrections'
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
  FinishWorkoutProgression,
  FinishWorkoutSettings,
  ProgramTemplate,
  SaveSessionInput,
  SaveFinishWorkoutInput,
  SessionType,
  SupportFocus,
  WorkoutCorrectionInput,
  WorkoutLogDraft,
} from '../domain/types'
import { isIsoDateString, todayDateString } from '../lib/date'
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
  const [currentDate, setCurrentDate] = useState(todayDateString)
  const [isReady, setIsReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutLogDraft | null>(null)
  const [finishWorkoutDraft, setFinishWorkoutDraft] =
    useState<FinishWorkoutDraft | null>(null)
  const dataRef = useRef<AppData>(EMPTY_APP_DATA)
  const dataWriteQueueRef = useRef<Promise<void>>(Promise.resolve())
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
    function refreshCurrentDate() {
      setCurrentDate((previousDate) => {
        const nextDate = todayDateString()
        return nextDate === previousDate ? previousDate : nextDate
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshCurrentDate()
      }
    }

    const intervalId = window.setInterval(refreshCurrentDate, 60_000)
    window.addEventListener('focus', refreshCurrentDate)
    window.addEventListener('pageshow', refreshCurrentDate)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshCurrentDate)
      window.removeEventListener('pageshow', refreshCurrentDate)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
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
          dataRef.current = stored
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

  const currentData = useMemo(
    () => withComputedRecommendation(data, currentDate),
    [currentDate, data],
  )

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
      currentData.athleteProfile.cycleStartDate,
      currentData.settings.cycleLengthDays,
      currentDate,
      currentData.athleteProfile.cycleEndDate,
    )
    return {
      cycleSummary: getCycleSummaryData(currentData, currentDate),
      recentWorkouts: buildRecentWorkouts(
        currentData.sessions,
        currentData.exerciseEntries,
        currentData.exercises,
        currentData.maxTests,
      ),
      cycleMaxTrendPoints: buildMaxTrendPoints(
        currentData.maxTests,
        currentData.sessions,
        currentData.athleteProfile.mainMovement,
        cycleWindow,
      ),
      allTimeMaxTrendPoints: buildMaxTrendPoints(
        currentData.maxTests,
        currentData.sessions,
        currentData.athleteProfile.mainMovement,
      ),
      bodyweightTrendPoints: buildBodyweightPoints(
        currentData.bodyweightEntries,
        cycleWindow,
      ),
      painTrendPoints: buildPainTrendPoints(currentData.sessions, cycleWindow),
      maxHistory: buildMaxHistory(
        currentData.maxTests,
        currentData.sessions,
        currentData.athleteProfile.mainMovement,
      ),
      allTimeBestMax: getBestMax(
        currentData.maxTests,
        currentData.sessions,
        currentData.athleteProfile.mainMovement,
      ),
      latestLoggedMaxReps: getLatestLoggedMaxReps(
        currentData.maxTests,
        currentData.sessions,
        currentData.athleteProfile.mainMovement,
      ),
      activeExercises: currentData.exercises.filter(
        (exercise) => exercise.active,
      ),
      latestBodyweightEntry: getLatestSavedBodyweightEntry(
        currentData.bodyweightEntries,
      ),
      weeklyVolumeSummary: getCurrentWeekVolumeSummary(
        currentData,
        currentDate,
      ),
      daysSinceLastMax: getDaysSinceLastMax(
        currentData.sessions,
        currentData.maxTests,
        currentData.athleteProfile.mainMovement,
        currentDate,
      ),
      daysSinceLastWorkout: getDaysSinceLastWorkout(
        currentData.sessions,
        currentDate,
        currentData.greaseGrooveEntries,
      ),
    }
  }, [currentData, currentDate])

  function saveNextData(
    update: AppData | ((current: AppData) => AppData),
    successNotice?: string | AppNotice,
  ) {
    const operation = dataWriteQueueRef.current.then(async () => {
      const previousData = dataRef.current
      const nextData =
        typeof update === 'function' ? update(previousData) : update
      await persistAppDataDiff(previousData, nextData)
      dataRef.current = nextData
      startTransition(() => {
        setData(nextData)
      })

      if (successNotice) {
        setNotice(
          typeof successNotice === 'string'
            ? { tone: 'success', message: successNotice }
            : successNotice,
        )
      }
    })

    dataWriteQueueRef.current = operation.catch(() => undefined)

    return operation.then(
      () => true,
      (error) => {
        setNotice({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to save local data.',
        })
        return false
      },
    )
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
      (current) =>
        withComputedRecommendation(
          {
            ...current,
            bodyweightEntries: upsertBodyweightEntry(
              current.bodyweightEntries,
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
      (current) =>
        withComputedRecommendation(
          {
            ...current,
            greaseGrooveEntries: [
              ...current.greaseGrooveEntries,
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
      (current) =>
        withComputedRecommendation(
          {
            ...current,
            greaseGrooveEntries: current.greaseGrooveEntries.filter(
              (entry) => entry.id !== entryId,
            ),
          },
          todayDateString(),
        ),
      'GG set removed.',
    )
  }

  async function updateGreaseGrooveEntry(
    entryId: string,
    reps: number,
    date: string,
  ) {
    const normalizedReps = Math.round(reps)

    if (
      !Number.isFinite(normalizedReps) ||
      normalizedReps <= 0 ||
      !isIsoDateString(date)
    ) {
      return false
    }

    return saveNextData((current) => {
      if (!current.greaseGrooveEntries.some((entry) => entry.id === entryId)) {
        throw new Error('That GG set no longer exists.')
      }

      return withComputedRecommendation(
        {
          ...current,
          greaseGrooveEntries: current.greaseGrooveEntries.map((entry) =>
            entry.id === entryId
              ? { ...entry, date, reps: normalizedReps }
              : entry,
          ),
        },
        todayDateString(),
      )
    }, 'GG set corrected. Freshness and training load recalculated.')
  }

  async function saveSession(input: SaveSessionInput) {
    const sessionId = createId('session')
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
    const maxTestId = input.maxTest ? createId('max') : null

    return saveNextData(
      (current) => {
        const existingMaxExposures = getMaxExposures(
          current.maxTests,
          current.sessions,
          current.athleteProfile.mainMovement,
        )
        const maxBodyweightSnapshot = getBodyweightSnapshotValue(
          current.bodyweightEntries,
          current.settings.bodyweightTrackingEnabled,
        )
        const stepLookup = new Map(
          getAllProgramSteps(current.programTemplate).map((step) => [
            step.id,
            step,
          ]),
        )
        const currentLatestMaxReps = getLatestLoggedMaxReps(
          current.maxTests,
          current.sessions,
          current.athleteProfile.mainMovement,
        )
        const maxTest =
          input.maxTest && maxTestId
            ? {
                id: maxTestId,
                workoutSessionId: sessionId,
                reps: input.maxTest.reps,
                movement: current.athleteProfile.mainMovement,
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

        return withComputedRecommendation(
          {
            ...current,
            sessions: [...current.sessions, session],
            exerciseEntries: [...current.exerciseEntries, ...entries],
            maxTests: maxTest
              ? [...current.maxTests, maxTest]
              : current.maxTests,
            presetProgressions: applyPresetOutcomes(
              current.presetProgressions,
              entries,
              stepLookup,
              currentLatestMaxReps,
            ),
          },
          todayDateString(),
        )
      },
      {
        tone: 'success',
        message: 'Workout saved.',
        actionLabel: 'Undo',
        action: () => deleteWorkout(sessionId),
      },
    )
  }

  async function deleteWorkout(sessionId: string) {
    return saveNextData(
      (current) => removeWorkoutSession(current, sessionId, todayDateString()),
      'Workout removed and training state recalculated.',
    )
  }

  async function updateWorkout(input: WorkoutCorrectionInput) {
    return saveNextData(
      (current) => applyWorkoutCorrection(current, input, todayDateString()),
      'Workout corrected and training state recalculated.',
    )
  }

  async function saveFinishWorkout(input: SaveFinishWorkoutInput) {
    const sessionId = createId('finish-session')
    const completedAt = new Date().toISOString()
    const saved = await saveNextData((current) => {
      const finishWorkout = current.finishWorkout
      const session = {
        id: sessionId,
        date: input.date,
        completedAt,
        entries: buildFinishWorkoutEntries(finishWorkout, input.outcomes),
      }

      return {
        ...current,
        finishWorkout: {
          ...finishWorkout,
          progression: applyFinishProgression(
            finishWorkout.progression,
            input.outcomes,
          ),
          sessions: [...finishWorkout.sessions, session],
        },
      }
    }, 'Finish workout saved.')

    if (saved) {
      await clearCurrentFinishWorkoutDraft()
    }

    return saved
  }

  async function saveFinishWorkoutSettings(settings: FinishWorkoutSettings) {
    return saveNextData((current) => ({
      ...current,
      finishWorkout: {
        ...current.finishWorkout,
        settings,
      },
    }))
  }

  async function saveFinishWorkoutProgression(
    progression: FinishWorkoutProgression,
  ) {
    return saveNextData(
      (current) => ({
        ...current,
        finishWorkout: {
          ...current.finishWorkout,
          progression,
        },
      }),
      'Finish target updated.',
    )
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

    await saveNextData(
      (current) => {
        const nextExercises = input.id
          ? current.exercises.map((exercise) =>
              exercise.id === input.id ? nextExercise : exercise,
            )
          : [...current.exercises, nextExercise]

        return withComputedRecommendation(
          {
            ...current,
            exercises: nextExercises,
          },
          todayDateString(),
        )
      },
      input.id ? 'Exercise updated.' : 'Exercise added.',
    )
  }

  async function deleteExercise(exerciseId: string) {
    await saveNextData(
      (current) => {
        const isReferenced = current.exerciseEntries.some(
          (entry) => entry.exerciseId === exerciseId,
        )
        const exercises = isReferenced
          ? current.exercises.map((exercise) =>
              exercise.id === exerciseId
                ? { ...exercise, active: false }
                : exercise,
            )
          : current.exercises.filter((exercise) => exercise.id !== exerciseId)

        return withComputedRecommendation(
          {
            ...current,
            exercises,
          },
          todayDateString(),
        )
      },
      {
        tone: 'success',
        message: dataRef.current.exerciseEntries.some(
          (entry) => entry.exerciseId === exerciseId,
        )
          ? 'Exercise archived because it is already referenced in history.'
          : 'Exercise deleted.',
      },
    )
  }

  async function saveSettingsAndProgram(
    profileUpdates: Partial<AthleteProfile>,
    settingsUpdates: Partial<AppSettings> | undefined,
    nextTemplate: ProgramTemplate,
  ) {
    return saveNextData(
      (current) =>
        withComputedRecommendation(
          {
            ...current,
            athleteProfile: {
              ...current.athleteProfile,
              ...profileUpdates,
            },
            settings: {
              ...current.settings,
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
    return saveNextData((current) =>
      withComputedRecommendation(
        {
          ...current,
          settings: { ...current.settings, onboardingDismissed: true },
        },
        todayDateString(),
      ),
    )
  }

  async function startNextCycle() {
    const startDate = todayDateString()

    return saveNextData((current) => {
      const { cycleStartDate, cycleEndDate } = current.athleteProfile
      const archivedCycleId = `cycle-${cycleStartDate}-${cycleEndDate}`
      const cycleAlreadyArchived = current.cycleHistory.some(
        (cycle) =>
          cycle.startDate === cycleStartDate && cycle.endDate === cycleEndDate,
      )

      return withComputedRecommendation(
        {
          ...current,
          cycleHistory: cycleAlreadyArchived
            ? current.cycleHistory
            : [
                ...current.cycleHistory,
                {
                  id: archivedCycleId,
                  startDate: cycleStartDate,
                  endDate: cycleEndDate,
                  lengthDays:
                    getCycleLengthDaysFromDates(cycleStartDate, cycleEndDate) ??
                    current.settings.cycleLengthDays,
                  completedAt: new Date().toISOString(),
                },
              ],
          athleteProfile: {
            ...current.athleteProfile,
            cycleStartDate: startDate,
            cycleEndDate: getCycleEndDateForLength(
              startDate,
              current.settings.cycleLengthDays,
            ),
          },
        },
        startDate,
      )
    }, 'New cycle started. Previous workouts remain in all-time history.')
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

    const operation = dataWriteQueueRef.current.then(async () => {
      const imported = await replaceAppData(
        parsed.value.data,
        todayDateString(),
      )
      await clearCurrentWorkoutDraft()
      await clearCurrentFinishWorkoutDraft()
      dataRef.current = imported
      startTransition(() => {
        setData(imported)
      })
      setNotice({
        tone: 'success',
        message: 'Backup imported.',
      })
    })
    dataWriteQueueRef.current = operation.catch(() => undefined)

    return operation.then(
      () => true,
      (error) => {
        setNotice({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to import that backup.',
        })
        return false
      },
    )
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
    const operation = dataWriteQueueRef.current.then(async () => {
      const reset = await resetAppData(todayDateString())
      await clearCurrentWorkoutDraft()
      await clearCurrentFinishWorkoutDraft()
      dataRef.current = reset
      startTransition(() => {
        setData(reset)
      })
      setNotice({
        tone: 'success',
        message: 'App data reset.',
      })
    })
    dataWriteQueueRef.current = operation.catch(() => undefined)
    await operation
  }

  const contextValue: AppContextValue = {
    activeExercises,
    allTimeBestMax,
    allTimeMaxTrendPoints,
    bodyweightTrendPoints,
    cycleMaxTrendPoints,
    painTrendPoints,
    cycleSummary,
    data: currentData,
    daysSinceLastMax,
    daysSinceLastWorkout,
    clearWorkoutDraft: clearCurrentWorkoutDraft,
    clearFinishWorkoutDraft: clearCurrentFinishWorkoutDraft,
    deleteExercise,
    deleteGreaseGrooveEntry,
    deleteWorkout,
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
    saveFinishWorkoutProgression,
    saveSettingsAndProgram,
    saveWorkoutDraft: saveCurrentWorkoutDraft,
    setNotice,
    storageDurability,
    startNextCycle,
    weeklyVolumeSummary,
    workoutDraft,
    updateExercise,
    updateGreaseGrooveEntry,
    updateWorkout,
  }

  return <AppContext value={contextValue}>{children}</AppContext>
}
