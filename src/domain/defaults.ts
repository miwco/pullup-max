import type {
  AppData,
  AppSettings,
  AthleteProfile,
  Exercise,
  ProgramTemplate,
  RecommendationState,
} from './types'
import { DEFAULT_CYCLE_LENGTH_DAYS } from './cycle'
import { createId } from '../lib/id'
import { todayDateString } from '../lib/date'
import { createDefaultProgramTemplate } from './programTemplate'

export const EXPORT_FORMAT_VERSION = 4

const DEFAULT_EXERCISE_SPECS: Array<
  Omit<Exercise, 'id' | 'active' | 'builtIn'>
> = [
  {
    name: 'Pull-up',
    type: 'max',
    defaultUnit: 'reps',
    tags: ['main movement', 'max test'],
  },
  {
    name: 'Band-assisted pull-up',
    type: 'support',
    defaultUnit: 'reps',
    tags: ['band-assisted', 'volume'],
  },
  {
    name: 'Scapular pull-up',
    type: 'support',
    defaultUnit: 'reps',
    tags: ['warm-up', 'start/bottom'],
  },
  {
    name: 'Dead hang',
    type: 'support',
    defaultUnit: 'seconds',
    tags: ['hang', 'grip'],
  },
  {
    name: 'Active hang',
    type: 'support',
    defaultUnit: 'seconds',
    tags: ['hang', 'scap'],
  },
  {
    name: 'Top hold',
    type: 'support',
    defaultUnit: 'seconds',
    tags: ['top', 'isometric'],
  },
  {
    name: 'Top-half pull-up',
    type: 'support',
    defaultUnit: 'reps',
    tags: ['top'],
  },
  {
    name: 'Mid-range hold',
    type: 'support',
    defaultUnit: 'seconds',
    tags: ['middle', 'isometric'],
  },
  {
    name: 'Mid-pause pull-up',
    type: 'support',
    defaultUnit: 'reps',
    tags: ['middle', 'pause'],
  },
  {
    name: 'Negative pull-up',
    type: 'support',
    defaultUnit: 'reps',
    tags: ['middle', 'eccentric'],
  },
  {
    name: 'Paused pull-up from dead hang',
    type: 'support',
    defaultUnit: 'reps',
    tags: ['start/bottom', 'pause'],
  },
  {
    name: 'Bottom-range partial pull-up',
    type: 'support',
    defaultUnit: 'reps',
    tags: ['start/bottom', 'partial'],
  },
  {
    name: 'Grip endurance work',
    type: 'support',
    defaultUnit: 'seconds',
    tags: ['grip'],
  },
  {
    name: 'EMOM pull-up block',
    type: 'support',
    defaultUnit: 'minutes',
    tags: ['emom', 'volume'],
  },
]

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
    notes: '',
  }
}

export function createDefaultSettings(): AppSettings {
  return {
    bandsAvailable: true,
    bodyweightTrackingEnabled: true,
    cycleLengthDays: DEFAULT_CYCLE_LENGTH_DAYS,
    fatigueSensitivity: 3,
    jointPainSensitivity: 3,
    exportFormatVersion: EXPORT_FORMAT_VERSION,
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
    programTemplate,
    recommendationState: createDefaultRecommendationState(),
  }
}
