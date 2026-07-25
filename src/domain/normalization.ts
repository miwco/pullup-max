import {
  EXPORT_FORMAT_VERSION,
  createDefaultRecommendationState,
  createSeedData,
} from './defaults'
import { clampCycleLengthDays, getCycleEndDateForLength } from './cycle'
import { createDefaultProgramTemplate } from './programTemplate'
import {
  createDefaultFinishWorkoutData,
  FINISH_EXERCISE_IDS,
} from './finishWorkout'
import type {
  AppData,
  AppSettings,
  AthleteProfile,
  BodyweightEntry,
  Exercise,
  ExerciseEntry,
  FinishExerciseId,
  FinishWorkoutData,
  FinishWorkoutSession,
  FailurePoint,
  GreaseGrooveEntry,
  MaxTestResult,
  PresetOutcome,
  PresetProgressionState,
  PresetTargetMode,
  ProgramBlock,
  ProgramStep,
  ProgramTemplate,
  QualityFlag,
  TimerSoundId,
  TrainingCycleRecord,
  TrendClassification,
  WorkoutSession,
} from './types'
import { createId } from '../lib/id'
import { isIsoDateString, isIsoDateTime, todayDateString } from '../lib/date'

const VALID_FAILURE_POINTS = new Set<FailurePoint>([
  'top',
  'middle',
  'start/bottom',
  'grip',
  'not sure',
])
const VALID_TRENDS = new Set<TrendClassification>([
  'rising',
  'stable',
  'falling',
])
const VALID_QUALITY_FLAGS = new Set<QualityFlag>(['clean', 'grindy', 'partial'])
const VALID_PRESET_OUTCOMES = new Set<PresetOutcome>(['pass', 'fail'])
const VALID_PRESET_TARGET_MODES = new Set<PresetTargetMode>([
  'emom',
  'reps',
  'hold-seconds',
  'duration-seconds',
])
const VALID_TIMER_SOUND_IDS = new Set<TimerSoundId>(['soft', 'bright', 'low'])
const LEGACY_QUALITY_FLAGS = new Map<string, QualityFlag>([
  ['cleaner', 'clean'],
  ['stronger', 'clean'],
  ['grindy', 'grindy'],
  ['partial', 'partial'],
])
const VALID_FINISH_EXERCISE_IDS = new Set<FinishExerciseId>(FINISH_EXERCISE_IDS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeFailurePoint(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  if (VALID_FAILURE_POINTS.has(value as FailurePoint)) {
    return value as FailurePoint
  }

  if (value === 'finish') {
    return 'top'
  }

  if (value === 'start') {
    return 'start/bottom'
  }

  if (value === 'grip/hang') {
    return 'grip'
  }

  return undefined
}

function normalizeQualityFlag(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  if (VALID_QUALITY_FLAGS.has(value as QualityFlag)) {
    return value as QualityFlag
  }

  return LEGACY_QUALITY_FLAGS.get(value)
}

function normalizeAthleteProfile(
  value: unknown,
  today: string,
  cycleLengthDays: number,
): AthleteProfile | null {
  if (!isRecord(value)) {
    return null
  }

  const cycleStartDate =
    typeof value.cycleStartDate === 'string' &&
    isIsoDateString(value.cycleStartDate)
      ? value.cycleStartDate
      : today
  const cycleEndDate =
    typeof value.cycleEndDate === 'string' &&
    isIsoDateString(value.cycleEndDate) &&
    value.cycleEndDate >= cycleStartDate
      ? value.cycleEndDate
      : getCycleEndDateForLength(cycleStartDate, cycleLengthDays)

  return {
    id: typeof value.id === 'string' ? value.id : 'athlete-default',
    mainMovement: 'Pull-up',
    cycleStartDate,
    cycleEndDate,
    notes: typeof value.notes === 'string' ? value.notes : '',
  }
}

function normalizeSettings(value: unknown): AppSettings | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    bodyweightTrackingEnabled:
      typeof value.bodyweightTrackingEnabled === 'boolean'
        ? value.bodyweightTrackingEnabled
        : true,
    cycleLengthDays: clampCycleLengthDays(
      typeof value.cycleLengthDays === 'number' ? value.cycleLengthDays : 90,
    ),
    exportFormatVersion:
      typeof value.exportFormatVersion === 'number'
        ? value.exportFormatVersion
        : 7,
    onboardingDismissed:
      typeof value.onboardingDismissed === 'boolean'
        ? value.onboardingDismissed
        : true,
    timerSoundId:
      typeof value.timerSoundId === 'string' &&
      VALID_TIMER_SOUND_IDS.has(value.timerSoundId as TimerSoundId)
        ? (value.timerSoundId as TimerSoundId)
        : 'bright',
    timerVolume:
      typeof value.timerVolume === 'number' &&
      Number.isFinite(value.timerVolume)
        ? Math.min(1, Math.max(0, value.timerVolume))
        : 0.7,
  }
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback
}

function normalizeFinishWorkout(value: unknown): FinishWorkoutData {
  const fallback = createDefaultFinishWorkoutData()

  if (!isRecord(value)) {
    return fallback
  }

  const settings = isRecord(value.settings) ? value.settings : {}
  const progression = isRecord(value.progression) ? value.progression : {}
  const sessions = Array.isArray(value.sessions)
    ? value.sessions.flatMap((item): FinishWorkoutSession[] => {
        if (
          !isRecord(item) ||
          typeof item.id !== 'string' ||
          typeof item.date !== 'string' ||
          !isIsoDateString(item.date) ||
          typeof item.completedAt !== 'string' ||
          !Array.isArray(item.entries)
        ) {
          return []
        }

        const entries = item.entries.flatMap((entry) => {
          if (
            !isRecord(entry) ||
            typeof entry.exerciseId !== 'string' ||
            !VALID_FINISH_EXERCISE_IDS.has(
              entry.exerciseId as FinishExerciseId,
            ) ||
            typeof entry.outcome !== 'string' ||
            !VALID_PRESET_OUTCOMES.has(entry.outcome as PresetOutcome) ||
            typeof entry.targetSummary !== 'string'
          ) {
            return []
          }

          return [
            {
              exerciseId: entry.exerciseId as FinishExerciseId,
              outcome: entry.outcome as PresetOutcome,
              targetSummary: entry.targetSummary,
            },
          ]
        })

        return entries.length === FINISH_EXERCISE_IDS.length
          ? [
              {
                id: item.id,
                date: item.date,
                completedAt: item.completedAt,
                entries,
              },
            ]
          : []
      })
    : []

  return {
    settings: {
      backExtensionRestSeconds: normalizePositiveInteger(
        settings.backExtensionRestSeconds,
        fallback.settings.backExtensionRestSeconds,
      ),
      absRestSeconds: normalizePositiveInteger(
        settings.absRestSeconds,
        fallback.settings.absRestSeconds,
      ),
      betweenExerciseRestSeconds: normalizePositiveInteger(
        settings.betweenExerciseRestSeconds,
        fallback.settings.betweenExerciseRestSeconds,
      ),
    },
    progression: {
      backExtensionSeconds: normalizePositiveInteger(
        progression.backExtensionSeconds,
        fallback.progression.backExtensionSeconds,
      ),
      absSeconds: normalizePositiveInteger(
        progression.absSeconds,
        fallback.progression.absSeconds,
      ),
      dipBaseReps: normalizePositiveInteger(
        progression.dipBaseReps,
        fallback.progression.dipBaseReps,
      ),
      dipStageOffset:
        typeof progression.dipStageOffset === 'number' &&
        Number.isFinite(progression.dipStageOffset) &&
        progression.dipStageOffset >= 0
          ? Math.round(progression.dipStageOffset)
          : fallback.progression.dipStageOffset,
      squatJumpReps: normalizePositiveInteger(
        progression.squatJumpReps,
        fallback.progression.squatJumpReps,
      ),
    },
    sessions,
  }
}

function normalizeExerciseType(value: unknown) {
  if (value === 'max' || value === 'support' || value === 'custom') {
    return value
  }

  if (value === 'recovery') {
    return 'support'
  }

  return 'custom'
}

function normalizeExercises(value: unknown) {
  const seeded = createSeedData(todayDateString()).exercises

  if (!Array.isArray(value)) {
    return seeded
  }

  const defaultNames = new Set(seeded.map((exercise) => exercise.name))
  const normalized = value.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    if (
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.defaultUnit !== 'string'
    ) {
      return []
    }

    return [
      {
        id: item.id,
        name: item.name,
        type: normalizeExerciseType(item.type),
        active: typeof item.active === 'boolean' ? item.active : true,
        builtIn:
          typeof item.builtIn === 'boolean'
            ? item.builtIn
            : defaultNames.has(item.name),
        defaultUnit:
          item.defaultUnit === 'reps' ||
          item.defaultUnit === 'seconds' ||
          item.defaultUnit === 'minutes' ||
          item.defaultUnit === 'sets'
            ? item.defaultUnit
            : 'reps',
        tags: Array.isArray(item.tags)
          ? item.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
      } satisfies Exercise,
    ]
  })

  return normalized.length > 0 ? normalized : seeded
}

function normalizeSessionType(value: unknown) {
  if (value === 'max' || value === 'support') {
    return value
  }

  if (value === 'recovery' || value === 'deload') {
    return 'support'
  }

  return null
}

function normalizeSessions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as WorkoutSession[]
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    const sessionType = normalizeSessionType(item.sessionType)

    if (
      !sessionType ||
      typeof item.id !== 'string' ||
      typeof item.date !== 'string' ||
      !isIsoDateString(item.date)
    ) {
      return []
    }

    return [
      {
        id: item.id,
        date: item.date,
        sessionType,
        bodyweightKg:
          typeof item.bodyweightKg === 'number' ? item.bodyweightKg : undefined,
        fatigueBefore:
          typeof item.fatigueBefore === 'number'
            ? item.fatigueBefore
            : undefined,
        fatigueAfter:
          typeof item.fatigueAfter === 'number' ? item.fatigueAfter : undefined,
        elbowPain:
          typeof item.elbowPain === 'number' ? item.elbowPain : undefined,
        shoulderPain:
          typeof item.shoulderPain === 'number' ? item.shoulderPain : undefined,
        notes: typeof item.notes === 'string' ? item.notes : '',
      } satisfies WorkoutSession,
    ]
  })
}

function normalizeEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as ExerciseEntry[]
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    if (
      typeof item.id !== 'string' ||
      typeof item.workoutSessionId !== 'string' ||
      typeof item.exerciseId !== 'string'
    ) {
      return []
    }

    return [
      {
        id: item.id,
        workoutSessionId: item.workoutSessionId,
        exerciseId: item.exerciseId,
        sets: typeof item.sets === 'number' ? item.sets : undefined,
        reps: typeof item.reps === 'number' ? item.reps : undefined,
        durationSeconds:
          typeof item.durationSeconds === 'number'
            ? item.durationSeconds
            : undefined,
        bandAssisted:
          typeof item.bandAssisted === 'boolean'
            ? item.bandAssisted
            : undefined,
        effort: typeof item.effort === 'number' ? item.effort : undefined,
        notes: typeof item.notes === 'string' ? item.notes : undefined,
        presetKey:
          typeof item.presetKey === 'string' ? item.presetKey : undefined,
        outcome:
          typeof item.outcome === 'string' &&
          VALID_PRESET_OUTCOMES.has(item.outcome as PresetOutcome)
            ? (item.outcome as PresetOutcome)
            : undefined,
        presetTargetMode:
          typeof item.presetTargetMode === 'string' &&
          VALID_PRESET_TARGET_MODES.has(
            item.presetTargetMode as PresetTargetMode,
          )
            ? (item.presetTargetMode as PresetTargetMode)
            : undefined,
        presetTargetSummary:
          typeof item.presetTargetSummary === 'string'
            ? item.presetTargetSummary
            : undefined,
        isMaxTest: typeof item.isMaxTest === 'boolean' ? item.isMaxTest : false,
      } satisfies ExerciseEntry,
    ]
  })
}

function normalizePresetProgressions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as PresetProgressionState[]
  }

  return value.reduce<PresetProgressionState[]>((normalized, item) => {
    if (!isRecord(item) || typeof item.presetKey !== 'string') {
      return normalized
    }

    if (
      item.mode === 'emom' &&
      typeof item.emomBaseReps === 'number' &&
      typeof item.emomStageOffset === 'number'
    ) {
      normalized.push({
        presetKey: item.presetKey,
        mode: 'emom',
        emomBaseReps: item.emomBaseReps,
        emomStageOffset: item.emomStageOffset,
      } satisfies PresetProgressionState)

      return normalized
    }

    if (
      (item.mode === 'reps' ||
        item.mode === 'hold-seconds' ||
        item.mode === 'duration-seconds') &&
      typeof item.currentValue === 'number'
    ) {
      normalized.push({
        presetKey: item.presetKey,
        mode: item.mode,
        currentValue: item.currentValue,
      } satisfies PresetProgressionState)
    }

    return normalized
  }, [])
}

function normalizeMaxTests(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as MaxTestResult[]
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    if (
      typeof item.id !== 'string' ||
      typeof item.workoutSessionId !== 'string' ||
      typeof item.reps !== 'number' ||
      typeof item.movement !== 'string'
    ) {
      return []
    }

    return [
      {
        id: item.id,
        workoutSessionId: item.workoutSessionId,
        reps: item.reps,
        movement: item.movement,
        videoUrl: normalizeUrl(item.videoUrl),
        bodyweightKgSnapshot:
          typeof item.bodyweightKgSnapshot === 'number'
            ? item.bodyweightKgSnapshot
            : undefined,
        failurePoint: normalizeFailurePoint(item.failurePoint),
        qualityFlag: normalizeQualityFlag(item.qualityFlag),
        trendClassification:
          typeof item.trendClassification === 'string' &&
          VALID_TRENDS.has(item.trendClassification as TrendClassification)
            ? (item.trendClassification as TrendClassification)
            : 'stable',
      } satisfies MaxTestResult,
    ]
  })
}

function normalizeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

function normalizeBodyweightEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as BodyweightEntry[]
  }

  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.date !== 'string' ||
      !isIsoDateString(item.date) ||
      typeof item.weightKg !== 'number'
    ) {
      return []
    }

    return [
      {
        id: item.id,
        date: item.date,
        weightKg: item.weightKg,
      } satisfies BodyweightEntry,
    ]
  })
}

function normalizeCycleHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as TrainingCycleRecord[]
  }

  const uniqueWindows = new Set<string>()

  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.startDate !== 'string' ||
      !isIsoDateString(item.startDate) ||
      typeof item.endDate !== 'string' ||
      !isIsoDateString(item.endDate) ||
      item.endDate < item.startDate ||
      typeof item.lengthDays !== 'number' ||
      !Number.isInteger(item.lengthDays) ||
      item.lengthDays < 1 ||
      typeof item.completedAt !== 'string' ||
      !isIsoDateTime(item.completedAt)
    ) {
      return []
    }

    const windowKey = `${item.startDate}:${item.endDate}`
    if (uniqueWindows.has(windowKey)) {
      return []
    }
    uniqueWindows.add(windowKey)

    return [
      {
        id: item.id,
        startDate: item.startDate,
        endDate: item.endDate,
        lengthDays: item.lengthDays,
        completedAt: item.completedAt,
      } satisfies TrainingCycleRecord,
    ]
  })
}

function normalizeGreaseGrooveEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as GreaseGrooveEntry[]
  }

  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.date !== 'string' ||
      !isIsoDateString(item.date) ||
      typeof item.reps !== 'number' ||
      !Number.isInteger(item.reps) ||
      item.reps <= 0 ||
      typeof item.loggedAt !== 'string' ||
      !isIsoDateTime(item.loggedAt)
    ) {
      return []
    }

    return [
      {
        id: item.id,
        date: item.date,
        reps: item.reps,
        loggedAt: item.loggedAt,
      } satisfies GreaseGrooveEntry,
    ]
  })
}

function normalizeProgramStep(
  value: unknown,
  exercises: Exercise[],
  fallbackStep?: ProgramStep,
) {
  const resolvedFallbackStep: ProgramStep = fallbackStep ?? {
    id: createId('step'),
    title: '',
    exerciseId: exercises[0]?.id ?? '',
    notes: '',
  }

  if (!isRecord(value)) {
    return resolvedFallbackStep
  }

  const exerciseId =
    typeof value.exerciseId === 'string' &&
    exercises.some((exercise) => exercise.id === value.exerciseId)
      ? value.exerciseId
      : resolvedFallbackStep.exerciseId

  return {
    id: typeof value.id === 'string' ? value.id : createId('step'),
    title:
      typeof value.title === 'string'
        ? value.title
        : resolvedFallbackStep.title,
    exerciseId,
    sets:
      typeof value.sets === 'number' ? value.sets : resolvedFallbackStep.sets,
    reps:
      typeof value.reps === 'number' ? value.reps : resolvedFallbackStep.reps,
    minReps:
      typeof value.minReps === 'number'
        ? value.minReps
        : resolvedFallbackStep.minReps,
    maxReps:
      typeof value.maxReps === 'number'
        ? value.maxReps
        : resolvedFallbackStep.maxReps,
    holdSeconds:
      typeof value.holdSeconds === 'number'
        ? value.holdSeconds
        : resolvedFallbackStep.holdSeconds,
    durationSeconds:
      typeof value.durationSeconds === 'number'
        ? value.durationSeconds
        : resolvedFallbackStep.durationSeconds,
    emomMinutes:
      typeof value.emomMinutes === 'number'
        ? value.emomMinutes
        : resolvedFallbackStep.emomMinutes,
    emomReps:
      typeof value.emomReps === 'number'
        ? value.emomReps
        : resolvedFallbackStep.emomReps,
    bandAllowed:
      typeof value.bandAllowed === 'boolean'
        ? value.bandAllowed
        : resolvedFallbackStep.bandAllowed,
    bodyweightOption:
      value.bodyweightOption === 'bodyweight' ||
      value.bodyweightOption === 'band' ||
      value.bodyweightOption === 'either'
        ? value.bodyweightOption
        : resolvedFallbackStep.bodyweightOption,
    captureAsMaxTest:
      typeof value.captureAsMaxTest === 'boolean'
        ? value.captureAsMaxTest
        : resolvedFallbackStep.captureAsMaxTest,
    notes:
      typeof value.notes === 'string'
        ? value.notes
        : resolvedFallbackStep.notes,
  }
}

function normalizeProgramBlock(
  value: unknown,
  exercises: Exercise[],
  fallbackBlock: ProgramBlock,
) {
  if (!isRecord(value)) {
    return fallbackBlock
  }

  const { steps } = value

  if (!Array.isArray(steps)) {
    return fallbackBlock
  }

  return {
    title:
      typeof value.title === 'string' && value.title.trim()
        ? value.title
        : fallbackBlock.title,
    steps:
      steps.length === 0
        ? []
        : steps.map((step, index) =>
            normalizeProgramStep(
              step,
              exercises,
              fallbackBlock.steps[index] ?? fallbackBlock.steps.at(-1),
            ),
          ),
  }
}

function isLegacyDefaultMaxDay(template: ProgramTemplate) {
  const warmupTitles = template.maxDay.warmup.steps.map((step) => step.title)
  const mainSetTitles = template.maxDay.mainSet.steps.map((step) => step.title)
  const volumeNotes = template.maxDay.volumeBlock.steps[0]?.notes ?? ''
  const finisherNotes = template.maxDay.finisher.steps[0]?.notes ?? ''

  return (
    warmupTitles.join('|') ===
      [
        'Dead hang',
        'Scapular pull-ups',
        'Easy band-assisted pull-ups',
        'Easy bodyweight set',
      ].join('|') &&
    mainSetTitles.join('|') === 'All-out max set' &&
    volumeNotes === 'Adjust reps if needed so all 10 minutes stay clean.' &&
    finisherNotes === 'Chin above the bar.'
  )
}

function normalizeProgramTemplate(value: unknown, exercises: Exercise[]) {
  const fallback = createDefaultProgramTemplate(exercises)

  if (!isRecord(value)) {
    return fallback
  }

  const normalized = {
    maxDay: {
      warmup: normalizeProgramBlock(
        isRecord(value.maxDay) ? value.maxDay.warmup : undefined,
        exercises,
        fallback.maxDay.warmup,
      ),
      mainSet: normalizeProgramBlock(
        isRecord(value.maxDay) ? value.maxDay.mainSet : undefined,
        exercises,
        fallback.maxDay.mainSet,
      ),
      volumeBlock: normalizeProgramBlock(
        isRecord(value.maxDay) ? value.maxDay.volumeBlock : undefined,
        exercises,
        fallback.maxDay.volumeBlock,
      ),
      finisher: normalizeProgramBlock(
        isRecord(value.maxDay) ? value.maxDay.finisher : undefined,
        exercises,
        fallback.maxDay.finisher,
      ),
    },
    supportDayBase: normalizeProgramBlock(
      value.supportDayBase,
      exercises,
      fallback.supportDayBase,
    ),
    supportFallback: normalizeProgramBlock(
      value.supportFallback,
      exercises,
      fallback.supportFallback,
    ),
    weakPointBlocks: {
      top: normalizeProgramBlock(
        isRecord(value.weakPointBlocks) ? value.weakPointBlocks.top : undefined,
        exercises,
        fallback.weakPointBlocks.top,
      ),
      middle: normalizeProgramBlock(
        isRecord(value.weakPointBlocks)
          ? value.weakPointBlocks.middle
          : undefined,
        exercises,
        fallback.weakPointBlocks.middle,
      ),
      'start/bottom': normalizeProgramBlock(
        isRecord(value.weakPointBlocks)
          ? value.weakPointBlocks['start/bottom']
          : undefined,
        exercises,
        fallback.weakPointBlocks['start/bottom'],
      ),
      grip: normalizeProgramBlock(
        isRecord(value.weakPointBlocks)
          ? value.weakPointBlocks.grip
          : undefined,
        exercises,
        fallback.weakPointBlocks.grip,
      ),
    },
  } satisfies ProgramTemplate

  if (isLegacyDefaultMaxDay(normalized)) {
    return {
      ...normalized,
      maxDay: fallback.maxDay,
    } satisfies ProgramTemplate
  }

  return normalized
}

export function normalizeAppData(value: unknown, today = todayDateString()) {
  if (!isRecord(value)) {
    return null
  }

  const settings = normalizeSettings(value.settings)

  if (!settings) {
    return null
  }

  const athleteProfile = normalizeAthleteProfile(
    value.athleteProfile,
    today,
    settings.cycleLengthDays,
  )

  if (!athleteProfile) {
    return null
  }

  const exercises = normalizeExercises(value.exercises)

  return {
    athleteProfile,
    settings: {
      ...settings,
      exportFormatVersion: EXPORT_FORMAT_VERSION,
    },
    cycleHistory: normalizeCycleHistory(value.cycleHistory),
    exercises,
    bodyweightEntries: normalizeBodyweightEntries(value.bodyweightEntries),
    greaseGrooveEntries: normalizeGreaseGrooveEntries(
      value.greaseGrooveEntries,
    ),
    sessions: normalizeSessions(value.sessions),
    exerciseEntries: normalizeEntries(value.exerciseEntries),
    maxTests: normalizeMaxTests(value.maxTests),
    presetProgressions: normalizePresetProgressions(value.presetProgressions),
    programTemplate: normalizeProgramTemplate(value.programTemplate, exercises),
    finishWorkout: normalizeFinishWorkout(value.finishWorkout),
    recommendationState: createDefaultRecommendationState(),
  } satisfies AppData
}
