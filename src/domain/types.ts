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
export type TimerSoundId = 'soft' | 'bright' | 'low'
export type FinishExerciseId = 'back-extension' | 'abs' | 'dips' | 'squat-jumps'
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
export type SupportRotationFocus = Extract<
  SupportFocus,
  'top' | 'middle' | 'start/bottom'
>
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

export interface GreaseGrooveEntry {
  id: string
  date: string
  reps: number
  loggedAt: string
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
  timerSoundId: TimerSoundId
  timerVolume: number
}

export interface FinishWorkoutSettings {
  backExtensionRestSeconds: number
  absRestSeconds: number
  betweenExerciseRestSeconds: number
}

export interface FinishWorkoutProgression {
  backExtensionSeconds: number
  absSeconds: number
  dipBaseReps: number
  dipStageOffset: number
  squatJumpReps: number
}

export interface FinishWorkoutEntry {
  exerciseId: FinishExerciseId
  outcome: PresetOutcome
  targetSummary: string
}

export interface FinishWorkoutSession {
  id: string
  date: string
  completedAt: string
  entries: FinishWorkoutEntry[]
}

export interface FinishWorkoutData {
  settings: FinishWorkoutSettings
  progression: FinishWorkoutProgression
  sessions: FinishWorkoutSession[]
}

export interface FinishWorkoutDraft {
  id: 'current-finish-workout'
  date: string
  outcomes: Partial<Record<FinishExerciseId, PresetOutcome>>
  updatedAt: string
}

export interface SaveFinishWorkoutInput {
  date: string
  outcomes: Record<FinishExerciseId, PresetOutcome>
}

export interface AppData {
  athleteProfile: AthleteProfile
  settings: AppSettings
  exercises: Exercise[]
  bodyweightEntries: BodyweightEntry[]
  greaseGrooveEntries: GreaseGrooveEntry[]
  sessions: WorkoutSession[]
  exerciseEntries: ExerciseEntry[]
  maxTests: MaxTestResult[]
  presetProgressions: PresetProgressionState[]
  programTemplate: ProgramTemplate
  finishWorkout: FinishWorkoutData
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
  supportFocusHistory: SupportRotationFocus[]
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
  qualityFlag?: QualityFlag
}

export interface RecentWorkoutItem extends WorkoutSession {
  entries: ExerciseEntry[]
  trainingLoadPoints: number | null
  maxReps: number | null
  maxRepDelta: number | null
  maxBodyweightKgSnapshot?: number
  maxFailurePoint?: FailurePoint
  maxVideoUrl?: string
  qualityFlag?: QualityFlag
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

export interface WorkoutLogEntryDraft extends ProgramEntryDraft {
  localId: string
}

export interface WorkoutLogDraft {
  id: 'current-workout'
  date: string
  elbowPain: string
  entries: WorkoutLogEntryDraft[]
  failurePoint: FailurePoint | ''
  fatigueAfter: string
  fatigueBefore: string
  maxReps: string
  maxTestSaved?: boolean
  notes: string
  qualityFlag: QualityFlag | ''
  sessionType: SessionType
  shoulderPain: string
  supportFocus?: Extract<SupportFocus, 'top' | 'middle' | 'start/bottom'>
  updatedAt: string
  videoLink: string
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
