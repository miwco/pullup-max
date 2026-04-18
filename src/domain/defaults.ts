import type {
  AppData,
  AppSettings,
  AthleteProfile,
  Exercise,
  RecommendationState,
} from './types'
import { createId } from '../lib/id'
import { todayDateString } from '../lib/date'

export const EXPORT_FORMAT_VERSION = 1

export const DEFAULT_SUPPORT_METHODS = [
  'Density pull-up block',
  'Ladder pull-up block',
  'Cluster pull-up block',
  'Band-assisted pull-up',
]

export const DEFAULT_EXERCISES: Exercise[] = [
  {
    id: createId('exercise'),
    name: 'Pull-up',
    type: 'max',
    active: true,
    defaultUnit: 'reps',
    tags: ['main movement', 'max test'],
  },
  {
    id: createId('exercise'),
    name: 'Band-assisted pull-up',
    type: 'support',
    active: true,
    defaultUnit: 'reps',
    tags: ['band-assisted', 'volume', 'deload'],
  },
  {
    id: createId('exercise'),
    name: 'Density pull-up block',
    type: 'support',
    active: true,
    defaultUnit: 'minutes',
    tags: ['density', 'endurance'],
  },
  {
    id: createId('exercise'),
    name: 'Ladder pull-up block',
    type: 'support',
    active: true,
    defaultUnit: 'sets',
    tags: ['ladder', 'endurance'],
  },
  {
    id: createId('exercise'),
    name: 'Cluster pull-up block',
    type: 'support',
    active: true,
    defaultUnit: 'sets',
    tags: ['cluster', 'power'],
  },
  {
    id: createId('exercise'),
    name: 'Dead hang',
    type: 'recovery',
    active: true,
    defaultUnit: 'seconds',
    tags: ['hang', 'grip'],
  },
  {
    id: createId('exercise'),
    name: 'Active hang',
    type: 'recovery',
    active: true,
    defaultUnit: 'seconds',
    tags: ['hang', 'scap'],
  },
  {
    id: createId('exercise'),
    name: 'Scapular pull-up',
    type: 'recovery',
    active: true,
    defaultUnit: 'reps',
    tags: ['scap', 'start'],
  },
  {
    id: createId('exercise'),
    name: 'Top hold',
    type: 'support',
    active: true,
    defaultUnit: 'seconds',
    tags: ['finish', 'isometric'],
  },
  {
    id: createId('exercise'),
    name: 'Negative pull-up',
    type: 'support',
    active: true,
    defaultUnit: 'reps',
    tags: ['eccentric', 'middle'],
  },
  {
    id: createId('exercise'),
    name: 'Bottom-pause pull-up',
    type: 'support',
    active: true,
    defaultUnit: 'reps',
    tags: ['start', 'pause'],
  },
  {
    id: createId('exercise'),
    name: 'Mid-pause pull-up',
    type: 'support',
    active: true,
    defaultUnit: 'reps',
    tags: ['middle', 'pause'],
  },
  {
    id: createId('exercise'),
    name: 'Top-half pull-up',
    type: 'support',
    active: true,
    defaultUnit: 'reps',
    tags: ['finish', 'top-half'],
  },
]

export function createDefaultAthleteProfile(
  today = todayDateString(),
): AthleteProfile {
  return {
    id: 'athlete-default',
    mainMovement: 'Pull-up',
    cycleStartDate: today,
    bodyweightTrackingEnabled: false,
    bandsAvailable: true,
    fatigueSensitivity: 3,
    jointPainSensitivity: 3,
    preferredSupportMethods: [...DEFAULT_SUPPORT_METHODS],
    notes: '',
  }
}

export function createDefaultSettings(): AppSettings {
  return {
    defaultMovement: 'Pull-up',
    bandsAvailable: true,
    bodyweightTrackingEnabled: false,
    fatigueSensitivity: 3,
    jointPainSensitivity: 3,
    exportFormatVersion: EXPORT_FORMAT_VERSION,
  }
}

export function createDefaultRecommendationState(): RecommendationState {
  return {
    id: 'recommendation-current',
    phase: 'build',
    trend: 'stable',
    nextSessionType: 'max',
    suggestedExercises: ['Pull-up', 'Scapular pull-up', 'Active hang'],
    supportEmphasis: 'establish the first clean max test',
    deloadLevel: 'none',
    explanation:
      'You do not have a max test yet. Start with one clean all-out set to anchor the plan.',
    computedAt: new Date().toISOString(),
    maxSessionDue: true,
  }
}

export function createSeedData(today = todayDateString()): AppData {
  return {
    athleteProfile: createDefaultAthleteProfile(today),
    settings: createDefaultSettings(),
    exercises: structuredClone(DEFAULT_EXERCISES),
    sessions: [],
    exerciseEntries: [],
    maxTests: [],
    recommendationState: createDefaultRecommendationState(),
  }
}
