import type {
  AppData,
  AppSettings,
  AthleteProfile,
  Exercise,
  ProgramTemplate,
  RecommendationState,
} from './types'
import { DEFAULT_CYCLE_LENGTH_DAYS, getCycleEndDateForLength } from './cycle'
import { createId } from '../lib/id'
import { todayDateString } from '../lib/date'
import { createMovementExerciseSpecs, MAIN_MOVEMENTS } from './mainMovement'
import { createDefaultProgramTemplate } from './programTemplate'

export const EXPORT_FORMAT_VERSION = 8

const DEFAULT_EXERCISE_SPECS: Array<
  Omit<Exercise, 'id' | 'active' | 'builtIn'>
> = MAIN_MOVEMENTS.flatMap((mainMovement) =>
  createMovementExerciseSpecs(mainMovement).map((exercise) => ({
    ...exercise,
    type: exercise.tags.includes('main movement')
      ? ('max' as const)
      : ('support' as const),
  })),
)

export function createDefaultExercises(): Exercise[] {
  return DEFAULT_EXERCISE_SPECS.map((exercise) => ({
    ...exercise,
    id: createId('exercise'),
    active: true,
    builtIn: true,
  }))
}

export function createDefaultAthleteProfile(
  today = todayDateString(),
): AthleteProfile {
  return {
    id: 'athlete-default',
    mainMovement: 'Pull-up',
    cycleStartDate: today,
    cycleEndDate: getCycleEndDateForLength(today, DEFAULT_CYCLE_LENGTH_DAYS),
    notes: '',
  }
}

export function createDefaultSettings(): AppSettings {
  return {
    bandsAvailable: true,
    bodyweightTrackingEnabled: true,
    cycleLengthDays: DEFAULT_CYCLE_LENGTH_DAYS,
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    onboardingDismissed: false,
    timerSoundId: 'bright',
    timerVolume: 0.7,
  }
}

export function createDefaultRecommendationState(): RecommendationState {
  return {
    id: 'recommendation-current',
    nextSessionType: 'max',
    maxReadinessSatisfied: true,
    daysSinceLastMax: null,
    daysSinceLastWorkout: null,
    baselineMax: null,
    currentPhase: 'build',
    trend: 'stable',
    defaultSupportFocus: 'generic',
    suggestedExercises: ['Pull-up', 'EMOM pull-up block', 'Top hold'],
    explanation:
      'You do not have a max session logged yet. Start with one clean all-out max set.',
    computedAt: new Date().toISOString(),
  }
}

export function createSeedData(today = todayDateString()): AppData {
  const exercises = createDefaultExercises()
  const programTemplate: ProgramTemplate =
    createDefaultProgramTemplate(exercises)

  return {
    athleteProfile: createDefaultAthleteProfile(today),
    settings: createDefaultSettings(),
    exercises,
    bodyweightEntries: [],
    sessions: [],
    exerciseEntries: [],
    maxTests: [],
    presetProgressions: [],
    programTemplate,
    recommendationState: createDefaultRecommendationState(),
  }
}
