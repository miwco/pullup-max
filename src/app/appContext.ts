import { createContext, use } from 'react'
import type {
  buildMaxHistory,
  buildMaxTrendPoints,
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
  ProgramEntryDraft,
  ProgramTemplate,
  SaveSessionInput,
  SessionType,
} from '../domain/types'

type NoticeTone = 'info' | 'error' | 'success'

export interface AppNotice {
  tone: NoticeTone
  message: string
}

export interface AppContextValue {
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
  weeklyVolumeSummary: ReturnType<typeof getCurrentWeekVolumeSummary>
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
