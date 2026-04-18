import { EXPORT_FORMAT_VERSION } from './defaults'
import type {
  AppData,
  AppSettings,
  AthleteProfile,
  Exercise,
  ExerciseEntry,
  ExportBundle,
  MaxTestResult,
  RecommendationState,
  WorkoutSession,
} from './types'
import { isIsoDateString, isIsoDateTime } from '../lib/date'

interface ValidationSuccess<T> {
  ok: true
  value: T
}

interface ValidationFailure {
  ok: false
  error: string
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

const SESSION_TYPES = new Set(['max', 'support', 'recovery', 'deload'])
const PHASES = new Set(['build', 'develop', 'peak', 'deload'])
const EXERCISE_TYPES = new Set(['max', 'support', 'recovery', 'custom'])
const UNITS = new Set(['reps', 'seconds', 'minutes', 'sets'])
const TRENDS = new Set(['rising', 'stable', 'falling'])
const DELOAD_LEVELS = new Set([
  'none',
  'volume_reduction',
  'soft_deload',
  'recovery_deload',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalNumber(value: unknown) {
  return value === undefined || typeof value === 'number'
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string'
}

function validateAthleteProfile(value: unknown): value is AthleteProfile {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.mainMovement === 'string' &&
    typeof value.cycleStartDate === 'string' &&
    isIsoDateString(value.cycleStartDate) &&
    typeof value.bodyweightTrackingEnabled === 'boolean' &&
    typeof value.bandsAvailable === 'boolean' &&
    typeof value.fatigueSensitivity === 'number' &&
    typeof value.jointPainSensitivity === 'number' &&
    Array.isArray(value.preferredSupportMethods) &&
    value.preferredSupportMethods.every((item) => typeof item === 'string') &&
    typeof value.notes === 'string'
  )
}

function validateExercise(value: unknown): value is Exercise {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    EXERCISE_TYPES.has(value.type) &&
    typeof value.active === 'boolean' &&
    typeof value.defaultUnit === 'string' &&
    UNITS.has(value.defaultUnit) &&
    Array.isArray(value.tags) &&
    value.tags.every((item) => typeof item === 'string')
  )
}

function validateWorkoutSession(value: unknown): value is WorkoutSession {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    isIsoDateString(value.date) &&
    typeof value.sessionType === 'string' &&
    SESSION_TYPES.has(value.sessionType) &&
    typeof value.phaseAtTime === 'string' &&
    PHASES.has(value.phaseAtTime) &&
    isOptionalNumber(value.bodyweightKg) &&
    isOptionalNumber(value.fatigueBefore) &&
    isOptionalNumber(value.fatigueAfter) &&
    isOptionalNumber(value.elbowPain) &&
    isOptionalNumber(value.shoulderPain) &&
    typeof value.notes === 'string'
  )
}

function validateExerciseEntry(value: unknown): value is ExerciseEntry {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.workoutSessionId === 'string' &&
    typeof value.exerciseId === 'string' &&
    isOptionalNumber(value.sets) &&
    isOptionalNumber(value.reps) &&
    isOptionalNumber(value.durationSeconds) &&
    (value.bandAssisted === undefined ||
      typeof value.bandAssisted === 'boolean') &&
    isOptionalNumber(value.effort) &&
    isOptionalString(value.notes) &&
    typeof value.isMaxTest === 'boolean'
  )
}

function validateMaxTestResult(value: unknown): value is MaxTestResult {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.workoutSessionId === 'string' &&
    typeof value.reps === 'number' &&
    typeof value.movement === 'string' &&
    isOptionalString(value.failurePoint) &&
    isOptionalString(value.qualityFlag) &&
    typeof value.trendClassification === 'string' &&
    TRENDS.has(value.trendClassification)
  )
}

function validateRecommendationState(
  value: unknown,
): value is RecommendationState {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.phase === 'string' &&
    PHASES.has(value.phase) &&
    typeof value.trend === 'string' &&
    TRENDS.has(value.trend) &&
    typeof value.nextSessionType === 'string' &&
    SESSION_TYPES.has(value.nextSessionType) &&
    Array.isArray(value.suggestedExercises) &&
    value.suggestedExercises.every((item) => typeof item === 'string') &&
    typeof value.supportEmphasis === 'string' &&
    typeof value.deloadLevel === 'string' &&
    DELOAD_LEVELS.has(value.deloadLevel) &&
    typeof value.explanation === 'string' &&
    typeof value.computedAt === 'string' &&
    isIsoDateTime(value.computedAt) &&
    typeof value.maxSessionDue === 'boolean'
  )
}

function validateAppSettings(value: unknown): value is AppSettings {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.defaultMovement === 'string' &&
    typeof value.bandsAvailable === 'boolean' &&
    typeof value.bodyweightTrackingEnabled === 'boolean' &&
    typeof value.fatigueSensitivity === 'number' &&
    typeof value.jointPainSensitivity === 'number' &&
    typeof value.exportFormatVersion === 'number'
  )
}

function validateAppData(value: unknown): value is AppData {
  if (!isRecord(value)) {
    return false
  }

  return (
    validateAthleteProfile(value.athleteProfile) &&
    validateAppSettings(value.settings) &&
    Array.isArray(value.exercises) &&
    value.exercises.every(validateExercise) &&
    Array.isArray(value.sessions) &&
    value.sessions.every(validateWorkoutSession) &&
    Array.isArray(value.exerciseEntries) &&
    value.exerciseEntries.every(validateExerciseEntry) &&
    Array.isArray(value.maxTests) &&
    value.maxTests.every(validateMaxTestResult) &&
    validateRecommendationState(value.recommendationState)
  )
}

export function createExportBundle(data: AppData): ExportBundle {
  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function serializeExportBundle(data: AppData) {
  return JSON.stringify(createExportBundle(data), null, 2)
}

export function parseImportBundle(
  rawText: string,
): ValidationResult<ExportBundle> {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText)
  } catch {
    return {
      ok: false,
      error: 'The selected file is not valid JSON.',
    }
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: 'The backup file must be a JSON object.',
    }
  }

  if (parsed.version !== EXPORT_FORMAT_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version. Expected ${EXPORT_FORMAT_VERSION}.`,
    }
  }

  if (
    typeof parsed.exportedAt !== 'string' ||
    !isIsoDateTime(parsed.exportedAt)
  ) {
    return {
      ok: false,
      error: 'The backup file is missing a valid export timestamp.',
    }
  }

  if (!validateAppData(parsed.data)) {
    return {
      ok: false,
      error: 'The backup file structure is invalid or incomplete.',
    }
  }

  return {
    ok: true,
    value: parsed as unknown as ExportBundle,
  }
}
