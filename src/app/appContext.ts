import { createContext, use } from 'react'
import type {
  buildMaxHistory,
  buildMaxTrendPoints,
  buildPainTrendPoints,
  buildRecentWorkouts,
  getCurrentWeekVolumeSummary,
  getCycleSummaryData,
} from '../domain/selectors'
import type {
  AppData,
  AppSettings,
  AthleteProfile,
  BodyweightEntry,
  Exercise,
  FinishWorkoutDraft,
  FinishWorkoutProgression,
  FinishWorkoutSettings,
  ProgramEntryDraft,
  ProgramTemplate,
  SaveSessionInput,
  SaveFinishWorkoutInput,
  SessionType,
  SupportFocus,
  WorkoutLogDraft,
} from '../domain/types'

type NoticeTone = 'info' | 'error' | 'success'

export interface AppNotice {
  tone: NoticeTone
  message: string
}

export interface StorageDurabilityState {
  isPersisted: boolean | null
  isSupported: boolean
}

export interface AppContextValue {
  activeExercises: Exercise[]
  allTimeBestMax: number | null
  allTimeMaxTrendPoints: ReturnType<typeof buildMaxTrendPoints>
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
  dismissOnboarding: () => Promise<boolean>
  errorMessage: string | null
  exportBackup: () => string
  clearWorkoutDraft: () => Promise<boolean>
  clearFinishWorkoutDraft: () => Promise<boolean>
  getProgramPrefill: (
    sessionType: SessionType,
    supportFocus?: SupportFocus,
  ) => ProgramEntryDraft[]
  importBackup: (rawText: string) => Promise<boolean>
  isReady: boolean
  latestBodyweightEntry: BodyweightEntry | null
  maxHistory: ReturnType<typeof buildMaxHistory>
  notice: AppNotice | null
  painTrendPoints: ReturnType<typeof buildPainTrendPoints>
  recentWorkouts: ReturnType<typeof buildRecentWorkouts>
  requestPersistentStorage: () => Promise<boolean>
  resetAllData: () => Promise<void>
  saveBodyweight: (date: string, weightKg: number) => Promise<boolean>
  saveGreaseGrooveEntry: (reps: number, date?: string) => Promise<boolean>
  deleteGreaseGrooveEntry: (entryId: string) => Promise<boolean>
  saveSession: (input: SaveSessionInput) => Promise<boolean>
  saveFinishWorkout: (input: SaveFinishWorkoutInput) => Promise<boolean>
  saveFinishWorkoutDraft: (draft: FinishWorkoutDraft) => Promise<boolean>
  saveFinishWorkoutSettings: (
    settings: FinishWorkoutSettings,
  ) => Promise<boolean>
  saveFinishWorkoutProgression: (
    progression: FinishWorkoutProgression,
  ) => Promise<boolean>
  saveSettingsAndProgram: (
    profileUpdates: Partial<AthleteProfile>,
    settingsUpdates: Partial<AppSettings> | undefined,
    nextTemplate: ProgramTemplate,
  ) => Promise<boolean>
  setNotice: (notice: AppNotice | null) => void
  storageDurability: StorageDurabilityState
  weeklyVolumeSummary: ReturnType<typeof getCurrentWeekVolumeSummary>
  workoutDraft: WorkoutLogDraft | null
  finishWorkoutDraft: FinishWorkoutDraft | null
  saveWorkoutDraft: (draft: WorkoutLogDraft) => Promise<boolean>
  updateExercise: (
    input: Omit<Exercise, 'id'> & { id?: string },
  ) => Promise<void>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useAppState() {
  const context = use(AppContext)

  if (!context) {
    throw new Error('useAppState must be used within AppProvider.')
  }

  return context
}
