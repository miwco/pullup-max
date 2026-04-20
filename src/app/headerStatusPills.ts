import type {
  CyclePhase,
  SessionType,
  TrendClassification,
} from '../domain/types'

export type HeaderStatusPillTone =
  | 'neutral'
  | 'accent'
  | 'warning'
  | 'success'

export interface HeaderStatusPillItem {
  id: string
  label: string
  title: string
  body: string
  tone?: HeaderStatusPillTone
  align?: 'start' | 'end'
}

interface HeaderStatusPillInput {
  currentPhase: CyclePhase
  mainMovement: string
  nextSessionType: SessionType
  trend: TrendClassification
}

function getNextWorkoutBody(nextSessionType: SessionType) {
  if (nextSessionType === 'max') {
    return 'This is the workout the app recommends you log next. Max means you currently meet the freshness rules for a true max test: at least 7 days since the last max test and 2 full days since the most recent workout.'
  }

  return 'This means the app does not recommend a true max test yet. Support day is the default until you have enough recovery and freshness for the next real max attempt.'
}

function getTrendBody(trend: TrendClassification) {
  switch (trend) {
    case 'rising':
      return 'Your latest max is above your current baseline. Rising means recent max-test results are moving up, which is the clearest sign that max strength-endurance is improving.'
    case 'falling':
      return 'Your recent max-test results are below baseline twice in a row. Falling means performance has dropped enough that support work should stay cleaner and easier until the trend turns around.'
    case 'stable':
    default:
      return 'Your recent max results are holding around baseline. Stable means one small dip can happen, but the next max test returns to at least baseline instead of continuing downward.'
  }
}

function getPhaseBody(currentPhase: CyclePhase) {
  switch (currentPhase) {
    case 'build':
      return 'Build is the early part of the cycle. The goal here is to build tolerance and reliable clean volume without rushing max attempts.'
    case 'develop':
      return 'Develop is the middle part of the cycle. The goal here is to turn your base into more specific pull-up performance with regular support exposure.'
    case 'competition-prep':
    default:
      return 'Competition prep is the final part of the cycle. The goal here is to stay specific, reduce extra fatigue, and keep you fresh for strong max attempts.'
  }
}

export function getHeaderStatusPillItems({
  currentPhase,
  mainMovement,
  nextSessionType,
  trend,
}: HeaderStatusPillInput): HeaderStatusPillItem[] {
  return [
    {
      id: 'next-workout',
      label: `Next ${nextSessionType}`,
      title: 'Next workout',
      body: getNextWorkoutBody(nextSessionType),
      tone: 'accent',
      align: 'start',
    },
    {
      id: 'main-movement',
      label: mainMovement,
      title: 'Main movement',
      body: 'This is the movement the whole plan is anchored to. Recommendations, max tracking, and support work are all built around improving your max strict reps in this movement.',
      tone: 'neutral',
      align: 'start',
    },
    {
      id: 'trend',
      label: `Trend ${trend}`,
      title: 'Trend',
      body: getTrendBody(trend),
      tone: trend === 'falling' ? 'warning' : 'success',
      align: 'end',
    },
    {
      id: 'current-phase',
      label: currentPhase,
      title: 'Current phase',
      body: getPhaseBody(currentPhase),
      tone: 'neutral',
      align: 'end',
    },
  ]
}
