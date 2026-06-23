export type SessionType = 'max' | 'support'
export type ExerciseType = 'max' | 'support' | 'custom'
export type DefaultUnit = 'reps' | 'seconds' | 'minutes' | 'sets'
export type CyclePhase = 'build' | 'develop' | 'peak'
export type MainMovement =
  | 'Pull-up'
  | 'Chin-up'
  | 'Neutral-grip pull-up'
  | 'Ring pull-up'
export type PresetOutcome = 'pass' | 'fail'
export type PresetTargetMode =
  | 'emom'
  | 'reps'
  | 'hold-seconds'
  | 'duration-seconds'
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
  mainMovement: MainMovement
  cycleStartDate: string
  cycleEndDate: string
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
  presetKey?: string
  outcome?: PresetOutcome
  presetTargetMode?: PresetTargetMode
  presetTargetSummary?: string
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

export interface EmomSegment {
  sets: number
  reps: number
}

export interface ResolvedPresetTarget {
  mode: PresetTargetMode
  summary: string
  entrySets: number
  entryReps?: number
  entryDurationSeconds?: number
  emomMinutes?: number
  emomSegments?: EmomSegment[]
}

export type PresetProgressionState =
  | {
      presetKey: string
      mode: 'emom'
      emomBaseReps: number
      emomStageOffset: number
    }
  | {
      presetKey: string
      mode: Exclude<PresetTargetMode, 'emom'>
      currentValue: number
    }

export interface AppSettings {
  bodyweightTrackingEnabled: boolean
  bandsAvailable: boolean
  cycleLengthDays: number
  exportFormatVersion: number
  onboardingDismissed: boolean
}

export interface AppData {
  athleteProfile: AthleteProfile
  settings: AppSettings
  exercises: Exercise[]
  bodyweightEntries: BodyweightEntry[]
  sessions: WorkoutSession[]
  exerciseEntries: ExerciseEntry[]
  maxTests: MaxTestResult[]
  presetProgressions: PresetProgressionState[]
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
  exercises: Exercise[]
  fatigueAverage: number | null
  supportPainOverride: boolean
  latestFailurePoint: FailurePoint | null
  mainMovement: MainMovement
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
  repDelta: number | null
  bodyweightKgSnapshot?: number
  bodyweightDeltaKg: number | null
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
  presetKey: string
  label: string
  exerciseId: string
  exerciseName: string
  target: ResolvedPresetTarget
  notes: string
  outcome: PresetOutcome | ''
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
