import type {
  DeloadLevel,
  FailurePoint,
  MaxExposure,
  ProgramPhase,
  RecommendationInput,
  RecommendationState,
  SessionType,
  TrendClassification,
} from './types'

const FAILURE_POINT_EXERCISES: Record<
  Exclude<FailurePoint, 'not sure'>,
  string[]
> = {
  start: [
    'Scapular pull-up',
    'Dead hang',
    'Active hang',
    'Band-assisted pull-up',
    'Bottom-pause pull-up',
  ],
  middle: [
    'Band-assisted pull-up',
    'Cluster pull-up block',
    'Mid-pause pull-up',
    'Negative pull-up',
    'Density pull-up block',
  ],
  finish: [
    'Top hold',
    'Top-half pull-up',
    'Band-assisted pull-up',
    'Cluster pull-up block',
  ],
  'grip/hang': ['Dead hang', 'Active hang', 'Band-assisted pull-up'],
  'general endurance': [
    'Density pull-up block',
    'Ladder pull-up block',
    'Cluster pull-up block',
    'Band-assisted pull-up',
  ],
}

const FAILURE_POINT_EMPHASIS: Record<
  Exclude<FailurePoint, 'not sure'>,
  string
> = {
  start: 'bottom-position strength and hang control',
  middle: 'mid-range pulling strength',
  finish: 'top-end finish strength',
  'grip/hang': 'hang tolerance without annoying the elbows',
  'general endurance': 'set endurance and repeatable submax volume',
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sortMaxResults(results: MaxExposure[]) {
  return [...results].sort((left, right) => left.date.localeCompare(right.date))
}

function fatigueThreshold(sensitivity: number) {
  return Math.max(2.8, Math.min(4.2, 4.4 - sensitivity * 0.35))
}

function painThreshold(sensitivity: number) {
  return Math.max(1.8, Math.min(4, 3.6 - sensitivity * 0.3))
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function preferAvailable(availableExercises: string[], desired: string[]) {
  const lookup = new Map(
    availableExercises.map((exerciseName) => [
      exerciseName.toLowerCase(),
      exerciseName,
    ]),
  )

  return dedupe(
    desired.map(
      (exerciseName) => lookup.get(exerciseName.toLowerCase()) ?? exerciseName,
    ),
  )
}

export function classifyTrend(results: MaxExposure[]): TrendClassification {
  const sorted = sortMaxResults(results).slice(-3)

  if (sorted.length <= 1) {
    return 'stable'
  }

  const latest = sorted.at(-1)!
  const previous = sorted.at(-2)!
  const oldest = sorted[0]
  const baseline = average(sorted.slice(0, -1).map((result) => result.reps))
  const repeatedDecline =
    sorted.length >= 3 &&
    oldest !== undefined &&
    previous.reps < oldest.reps &&
    latest.reps < previous.reps
  const qualityImproved =
    latest.reps >= Math.round(baseline) &&
    (latest.qualityFlag === 'cleaner' || latest.qualityFlag === 'stronger')

  if (repeatedDecline) {
    return 'falling'
  }

  if (latest.reps > roundToSingleDecimal(baseline) || qualityImproved) {
    return 'rising'
  }

  return 'stable'
}

export function getStableExposureCount(results: MaxExposure[]) {
  const sorted = sortMaxResults(results)

  if (sorted.length === 0) {
    return 0
  }

  let count = 1

  for (let index = sorted.length - 1; index > 0; index -= 1) {
    const current = sorted[index]!
    const previous = sorted[index - 1]!

    if (Math.abs(current.reps - previous.reps) <= 1) {
      count += 1
      continue
    }

    break
  }

  return count
}

export function getFailurePointPriority(
  repeatedFailurePoint: FailurePoint | null,
  jointPainAverage: number | null,
  jointPainSensitivity: number,
) {
  if (!repeatedFailurePoint || repeatedFailurePoint === 'not sure') {
    return []
  }

  const desired = [...FAILURE_POINT_EXERCISES[repeatedFailurePoint]]
  const painElevated =
    jointPainAverage !== null &&
    jointPainAverage >= painThreshold(jointPainSensitivity)

  if (painElevated) {
    return desired.filter((exerciseName) => exerciseName !== 'Dead hang')
  }

  return desired
}

export function getMaxSessionDue(
  input: Pick<
    RecommendationInput,
    | 'daysSinceLastMax'
    | 'fatigueAverage'
    | 'fatigueSensitivity'
    | 'jointPainAverage'
    | 'jointPainSensitivity'
    | 'totalMaxSessions'
  >,
) {
  const fatigueElevated =
    input.fatigueAverage !== null &&
    input.fatigueAverage >= fatigueThreshold(input.fatigueSensitivity)
  const painElevated =
    input.jointPainAverage !== null &&
    input.jointPainAverage >= painThreshold(input.jointPainSensitivity)

  if (input.totalMaxSessions === 0 || input.daysSinceLastMax === null) {
    return true
  }

  if (painElevated) {
    return false
  }

  if (input.daysSinceLastMax >= 10) {
    return true
  }

  if (input.daysSinceLastMax >= 7 && !fatigueElevated) {
    return true
  }

  return false
}

export function selectDeloadLevel(
  input: Pick<
    RecommendationInput,
    | 'fatigueAverage'
    | 'fatigueSensitivity'
    | 'jointPainAverage'
    | 'jointPainSensitivity'
    | 'lastMaxResults'
    | 'sessionsLast14'
    | 'sessionsLast7'
  >,
) {
  const trend = classifyTrend(input.lastMaxResults)
  const stableExposureCount = getStableExposureCount(input.lastMaxResults)
  const fatigueHigh =
    input.fatigueAverage !== null &&
    input.fatigueAverage >= fatigueThreshold(input.fatigueSensitivity)
  const fatigueModerate =
    input.fatigueAverage !== null &&
    input.fatigueAverage >= fatigueThreshold(input.fatigueSensitivity) - 0.6
  const painHigh =
    input.jointPainAverage !== null &&
    input.jointPainAverage >= painThreshold(input.jointPainSensitivity)
  const densityHigh = input.sessionsLast7 >= 4 || input.sessionsLast14 >= 7

  if (trend === 'falling' && painHigh) {
    return 'recovery_deload'
  }

  if (trend === 'falling' && fatigueHigh) {
    return 'soft_deload'
  }

  if (
    stableExposureCount >= 3 &&
    (fatigueHigh || (fatigueModerate && densityHigh))
  ) {
    return 'volume_reduction'
  }

  return 'none'
}

export function selectPhase(
  input: Pick<
    RecommendationInput,
    | 'cycleAgeDays'
    | 'daysSinceLastMax'
    | 'fatigueAverage'
    | 'fatigueSensitivity'
    | 'jointPainAverage'
    | 'jointPainSensitivity'
    | 'lastMaxResults'
    | 'sessionsLast14'
    | 'totalMaxSessions'
  > & { deloadLevel: DeloadLevel },
) {
  if (input.deloadLevel !== 'none') {
    return 'deload'
  }

  const trend = classifyTrend(input.lastMaxResults)
  const fatigueHigh =
    input.fatigueAverage !== null &&
    input.fatigueAverage >= fatigueThreshold(input.fatigueSensitivity)
  const painHigh =
    input.jointPainAverage !== null &&
    input.jointPainAverage >= painThreshold(input.jointPainSensitivity)

  if (
    input.totalMaxSessions < 2 ||
    input.cycleAgeDays < 21 ||
    input.sessionsLast14 < 4
  ) {
    return 'build'
  }

  if (
    input.totalMaxSessions >= 4 &&
    trend !== 'falling' &&
    !fatigueHigh &&
    !painHigh &&
    input.daysSinceLastMax !== null &&
    input.daysSinceLastMax >= 5 &&
    input.sessionsLast14 <= 6
  ) {
    return 'peak'
  }

  return 'develop'
}

function pickSupportEmphasis(
  repeatedFailurePoint: FailurePoint | null,
  phase: ProgramPhase,
) {
  if (repeatedFailurePoint && repeatedFailurePoint !== 'not sure') {
    return FAILURE_POINT_EMPHASIS[repeatedFailurePoint]
  }

  if (phase === 'build') {
    return 'clean volume and repeatable technique'
  }

  if (phase === 'peak') {
    return 'sharp specific work with low extra fatigue'
  }

  if (phase === 'deload') {
    return 'keep the pattern while stress comes down'
  }

  return 'specific support work that carries over to the max set'
}

function pickNextSessionType(
  trend: TrendClassification,
  phase: ProgramPhase,
  deloadLevel: DeloadLevel,
  maxSessionDue: boolean,
  sessionsLast7: number,
): SessionType {
  if (deloadLevel === 'recovery_deload') {
    return 'recovery'
  }

  if (deloadLevel === 'soft_deload') {
    return 'deload'
  }

  if (maxSessionDue && deloadLevel !== 'volume_reduction') {
    return 'max'
  }

  if (deloadLevel === 'volume_reduction') {
    return 'support'
  }

  if (trend === 'rising') {
    return sessionsLast7 >= 3 ? 'recovery' : 'support'
  }

  if (phase === 'peak' && sessionsLast7 >= 2) {
    return 'recovery'
  }

  return sessionsLast7 >= 4 ? 'recovery' : 'support'
}

function pickSuggestedExercises(
  input: RecommendationInput,
  phase: ProgramPhase,
  nextSessionType: SessionType,
  deloadLevel: DeloadLevel,
) {
  const failurePriority = getFailurePointPriority(
    input.repeatedFailurePoint,
    input.jointPainAverage,
    input.jointPainSensitivity,
  )
  const bandPreferred =
    input.bandsAvailable &&
    (deloadLevel !== 'none' ||
      input.sessionsLast7 >= 3 ||
      (input.fatigueAverage !== null &&
        input.fatigueAverage >=
          fatigueThreshold(input.fatigueSensitivity) - 0.4))
  const preferredMethods = input.preferredSupportMethods.length
    ? input.preferredSupportMethods
    : ['Density pull-up block', 'Ladder pull-up block', 'Cluster pull-up block']

  let desired: string[] = []

  if (nextSessionType === 'max') {
    desired = [input.mainMovement, ...failurePriority.slice(0, 2)]
  } else if (nextSessionType === 'support') {
    if (phase === 'build') {
      desired = [
        bandPreferred ? 'Band-assisted pull-up' : input.mainMovement,
        'Scapular pull-up',
        'Active hang',
      ]
    } else if (phase === 'peak') {
      desired = [
        input.mainMovement,
        'Cluster pull-up block',
        ...failurePriority,
      ]
    } else {
      desired = [...preferredMethods, ...failurePriority]
    }
  } else if (nextSessionType === 'recovery') {
    desired = ['Band-assisted pull-up', 'Active hang', 'Scapular pull-up']

    if (
      input.repeatedFailurePoint === 'start' ||
      input.repeatedFailurePoint === 'grip/hang'
    ) {
      desired.push('Dead hang')
    }
  } else {
    desired = [
      'Band-assisted pull-up',
      'Scapular pull-up',
      'Active hang',
      ...failurePriority,
    ]
  }

  if (!input.bandsAvailable) {
    desired = desired.filter(
      (exerciseName) => exerciseName !== 'Band-assisted pull-up',
    )
  }

  if (deloadLevel === 'volume_reduction' && input.bandsAvailable) {
    desired.unshift('Band-assisted pull-up')
  }

  return preferAvailable(input.availableExercises, desired).slice(0, 4)
}

function buildExplanation(
  trend: TrendClassification,
  deloadLevel: DeloadLevel,
  maxSessionDue: boolean,
  daysSinceLastMax: number | null,
) {
  if (deloadLevel === 'recovery_deload') {
    return 'Performance is dropping and joint stress is elevated. Prioritize recovery.'
  }

  if (deloadLevel === 'soft_deload') {
    return 'Your recent max results are dropping. Use a lighter session to recover.'
  }

  if (deloadLevel === 'volume_reduction') {
    return 'Your max is holding, but fatigue is rising. Reduce support stress before a full deload.'
  }

  if (maxSessionDue) {
    if (daysSinceLastMax === null) {
      return 'You do not have a max test yet. Start with one clean all-out set to anchor the plan.'
    }

    return `It has been ${daysSinceLastMax} days since your last max test and recovery looks acceptable.`
  }

  if (trend === 'rising') {
    return 'Your max reps are still improving. Keep going.'
  }

  return 'Your max is stable and recovery looks acceptable. No deload is needed.'
}

export function createRecommendation(
  input: RecommendationInput,
): RecommendationState {
  const trend = classifyTrend(input.lastMaxResults)
  const deloadLevel = selectDeloadLevel(input)
  const maxSessionDue = getMaxSessionDue(input)
  const phase = selectPhase({
    ...input,
    deloadLevel,
  })
  const nextSessionType = pickNextSessionType(
    trend,
    phase,
    deloadLevel,
    maxSessionDue,
    input.sessionsLast7,
  )

  return {
    id: 'recommendation-current',
    phase,
    trend,
    nextSessionType,
    suggestedExercises: pickSuggestedExercises(
      input,
      phase,
      nextSessionType,
      deloadLevel,
    ),
    supportEmphasis: pickSupportEmphasis(input.repeatedFailurePoint, phase),
    deloadLevel,
    explanation: buildExplanation(
      trend,
      deloadLevel,
      maxSessionDue,
      input.daysSinceLastMax,
    ),
    computedAt: new Date().toISOString(),
    maxSessionDue,
  }
}
