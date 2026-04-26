import { createDefaultRecommendationState, createSeedData } from './defaults'
import { clampCycleLengthDays, getCycleEndDateForLength } from './cycle'
import { normalizeMainMovement } from './mainMovement'
import { createDefaultProgramTemplate } from './programTemplate'
import type {
  AppData,
  AppSettings,
  AthleteProfile,
  BodyweightEntry,
  Exercise,
  ExerciseEntry,
  FailurePoint,
  MaxTestResult,
  PresetOutcome,
  PresetProgressionState,
  PresetTargetMode,
  ProgramBlock,
  ProgramStep,
  ProgramTemplate,
  QualityFlag,
  TrendClassification,
  WorkoutSession,
} from './types'
import { createId } from '../lib/id'
import { isIsoDateString, todayDateString } from '../lib/date'

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
const LEGACY_QUALITY_FLAGS = new Map<string, QualityFlag>([
  ['cleaner', 'clean'],
  ['stronger', 'clean'],
  ['grindy', 'grindy'],
  ['partial', 'partial'],
])

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
    mainMovement: normalizeMainMovement(value.mainMovement),
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
    bandsAvailable:
      typeof value.bandsAvailable === 'boolean' ? value.bandsAvailable : true,
    cycleLengthDays: clampCycleLengthDays(
      typeof value.cycleLengthDays === 'number' ? value.cycleLengthDays : 90,
    ),
    exportFormatVersion:
      typeof value.exportFormatVersion === 'number'
        ? value.exportFormatVersion
        : 7,
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
      exportFormatVersion: 7,
    },
    exercises,
    bodyweightEntries: normalizeBodyweightEntries(value.bodyweightEntries),
    sessions: normalizeSessions(value.sessions),
    exerciseEntries: normalizeEntries(value.exerciseEntries),
    maxTests: normalizeMaxTests(value.maxTests),
    presetProgressions: normalizePresetProgressions(value.presetProgressions),
    programTemplate: normalizeProgramTemplate(value.programTemplate, exercises),
    recommendationState: createDefaultRecommendationState(),
  } satisfies AppData
}
