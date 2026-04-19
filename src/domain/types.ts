export type SessionType = 'max' | 'support'
export type ExerciseType = 'max' | 'support' | 'custom'
export type DefaultUnit = 'reps' | 'seconds' | 'minutes' | 'sets'
export type CyclePhase = 'build' | 'develop' | 'competition-prep'
export type FailurePoint =
  | 'top'
  | 'middle'
  | 'start/bottom'
  | 'grip'
  | 'not sure'
export type TrendClassification = 'rising' | 'stable' | 'falling'
export type QualityFlag = 'clean' | 'grindy' | 'partial'
export type SupportFocus =
  | 'generic'
  | 'top'
  | 'middle'
  | 'start/bottom'
  | 'grip'
export type BodyweightOption = 'bodyweight' | 'band' | 'either'

export interface AthleteProfile {
  id: string
  mainMovement: string
  cycleStartDate: string
  notes: string
}

export interface BodyweightEntry {
  id: string
  date: string
  weightKg: number
}

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  active: boolean
  builtIn: boolean
  defaultUnit: DefaultUnit
  tags: string[]
}

export interface WorkoutSession {
  id: string
  date: string
  sessionType: SessionType
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
  videoUrl?: string
  bodyweightKgSnapshot?: number
  failurePoint?: FailurePoint
  qualityFlag?: QualityFlag
  trendClassification: TrendClassification
}

export interface ProgramStep {
  id: string
  title: string
  exerciseId: string
  sets?: number
  reps?: number
  minReps?: number
  maxReps?: number
  holdSeconds?: number
  durationSeconds?: number
  emomMinutes?: number
  emomReps?: number
  bandAllowed?: boolean
  bodyweightOption?: BodyweightOption
  captureAsMaxTest?: boolean
  notes: string
}

export interface ProgramBlock {
  title: string
  steps: ProgramStep[]
}

export interface ProgramTemplate {
  maxDay: {
    warmup: ProgramBlock
    mainSet: ProgramBlock
    volumeBlock: ProgramBlock
    finisher: ProgramBlock
  }
  supportDayBase: ProgramBlock
  supportFallback: ProgramBlock
  weakPointBlocks: Record<Exclude<SupportFocus, 'generic'>, ProgramBlock>
}

export interface RecommendationState {
  id: string
  nextSessionType: SessionType
  maxReadinessSatisfied: boolean
  daysSinceLastMax: number | null
  daysSinceLastWorkout: number | null
  baselineMax: number | null
  currentPhase: CyclePhase
  trend: TrendClassification
  defaultSupportFocus: SupportFocus
  suggestedExercises: string[]
  explanation: string
  computedAt: string
}

export interface AppSettings {
  bodyweightTrackingEnabled: boolean
  bandsAvailable: boolean
  cycleLengthDays: number
  fatigueSensitivity: number
  jointPainSensitivity: number
  exportFormatVersion: number
}

export interface AppData {
  athleteProfile: AthleteProfile
  settings: AppSettings
  exercises: Exercise[]
  bodyweightEntries: BodyweightEntry[]
  sessions: WorkoutSession[]
  exerciseEntries: ExerciseEntry[]
  maxTests: MaxTestResult[]
  programTemplate: ProgramTemplate
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
  bandsAvailable: boolean
  cycleMaxResults: MaxExposure[]
  currentPhase: CyclePhase
  daysSinceLastMax: number | null
  daysSinceLastWorkout: number | null
  fatigueAverage: number | null
  fatigueSensitivity: number
  jointPainAverage: number | null
  jointPainSensitivity: number
  latestFailurePoint: FailurePoint | null
  mainMovement: string
  programTemplate: ProgramTemplate
  sessionsLast7: number
}

export interface SaveSessionInput {
  session: Omit<WorkoutSession, 'id'>
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

export interface ProgressPoint {
  date: string
  value: number
}

export interface MaxHistoryItem {
  id: string
  date: string
  reps: number
  bodyweightKgSnapshot?: number
  videoUrl?: string
  trend: TrendClassification
  failurePoint?: FailurePoint
}

export interface RecentWorkoutItem extends WorkoutSession {
  entries: ExerciseEntry[]
  supportVolume: number
  maxReps: number | null
}

export interface CycleSummaryData {
  baselineMax: number | null
  cycleBestMax: number | null
  currentPhase: CyclePhase
  cycleWindow: CycleWindow
  daysElapsed: number
  daysRemaining: number
  maxSessions: number
  progressPercent: number
  supportSessions: number
  summary: string
  totalSessions: number
}

export interface ProgramEntryDraft {
  templateStepId: string
  label: string
  exerciseId: string
  exerciseName: string
  sets: string
  reps: string
  durationSeconds: string
  bandAssisted: boolean
  effort: string
  notes: string
}

export interface WeeklyVolumeSummary {
  brakeApplied: boolean
  completedPoints: number
  message: string
  remainingPoints: number
  targetPoints: number
  volumeStatus: 'behind' | 'on-track' | 'ahead'
  weekEnd: string
  weekNumber: number
  weekStart: string
}
