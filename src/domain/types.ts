export type SessionType = 'max' | 'support' | 'recovery' | 'deload'
export type ProgramPhase = 'build' | 'develop' | 'peak' | 'deload'
export type ExerciseType = 'max' | 'support' | 'recovery' | 'custom'
export type DefaultUnit = 'reps' | 'seconds' | 'minutes' | 'sets'
export type FailurePoint =
  | 'start'
  | 'middle'
  | 'finish'
  | 'grip/hang'
  | 'general endurance'
  | 'not sure'
export type TrendClassification = 'rising' | 'stable' | 'falling'
export type DeloadLevel =
  | 'none'
  | 'volume_reduction'
  | 'soft_deload'
  | 'recovery_deload'
export type QualityFlag = 'cleaner' | 'stronger' | 'grindy' | 'partial'

export interface AthleteProfile {
  id: string
  mainMovement: string
  cycleStartDate: string
  bodyweightTrackingEnabled: boolean
  bandsAvailable: boolean
  fatigueSensitivity: number
  jointPainSensitivity: number
  preferredSupportMethods: string[]
  notes: string
}

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  active: boolean
  defaultUnit: DefaultUnit
  tags: string[]
}

export interface WorkoutSession {
  id: string
  date: string
  sessionType: SessionType
  phaseAtTime: ProgramPhase
  bodyweightKg?: number
  fatigueBefore?: number
  fatigueAfter?: number
  elbowPain?: number
  shoulderPain?: number
  notes: string
}

export interface ExerciseEntry {
  id: string
  workoutSessionId: string
  exerciseId: string
  sets?: number
  reps?: number
  durationSeconds?: number
  bandAssisted?: boolean
  effort?: number
  notes?: string
  isMaxTest: boolean
}

export interface MaxTestResult {
  id: string
  workoutSessionId: string
  reps: number
  movement: string
  failurePoint?: FailurePoint
  qualityFlag?: QualityFlag
  trendClassification: TrendClassification
}

export interface RecommendationState {
  id: string
  phase: ProgramPhase
  trend: TrendClassification
  nextSessionType: SessionType
  suggestedExercises: string[]
  supportEmphasis: string
  deloadLevel: DeloadLevel
  explanation: string
  computedAt: string
  maxSessionDue: boolean
}

export interface AppSettings {
  defaultMovement: string
  bandsAvailable: boolean
  bodyweightTrackingEnabled: boolean
  fatigueSensitivity: number
  jointPainSensitivity: number
  exportFormatVersion: number
}

export interface AppData {
  athleteProfile: AthleteProfile
  settings: AppSettings
  exercises: Exercise[]
  sessions: WorkoutSession[]
  exerciseEntries: ExerciseEntry[]
  maxTests: MaxTestResult[]
  recommendationState: RecommendationState
}

export interface ExportBundle {
  version: number
  exportedAt: string
  data: AppData
}

export interface MaxExposure {
  date: string
  reps: number
  failurePoint?: FailurePoint
  qualityFlag?: QualityFlag
}

export interface RecommendationInput {
  availableExercises: string[]
  cycleAgeDays: number
  daysSinceLastMax: number | null
  jointPainAverage: number | null
  lastMaxResults: MaxExposure[]
  mainMovement: string
  fatigueAverage: number | null
  fatigueSensitivity: number
  jointPainSensitivity: number
  preferredSupportMethods: string[]
  repeatedFailurePoint: FailurePoint | null
  sessionsLast7: number
  sessionsLast14: number
  totalMaxSessions: number
  bandsAvailable: boolean
}

export interface SaveSessionInput {
  session: Omit<WorkoutSession, 'id' | 'phaseAtTime'>
  entries: Array<Omit<ExerciseEntry, 'id' | 'workoutSessionId'>>
  maxTest?: Omit<
    MaxTestResult,
    'id' | 'movement' | 'trendClassification' | 'workoutSessionId'
  >
}

export interface CycleWindow {
  start: string
  end: string
}

export interface CycleSummaryData {
  cycleBestMax: number | null
  deloadPeriods: Array<{
    start: string
    end: string
  }>
  currentPhase: ProgramPhase
  cycleWindow: CycleWindow
  maxSessions: number
  recoverySessions: number
  supportSessions: number
  totalSessions: number
  summary: string
}
