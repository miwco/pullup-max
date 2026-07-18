import { getSupportBandExerciseName } from './mainMovement'
import {
  applyEasySupportAdjustments,
  applyPhaseAdjustments,
  getExerciseNamesForProgramSteps,
  getProgramStepsForSession,
  resolveProgramStepsForSession,
  getSupportFocusFromFailurePoint,
} from './programTemplate'
import type {
  Exercise,
  MaxExposure,
  ProgramStep,
  RecommendationInput,
  RecommendationState,
  SupportFocus,
  TrendClassification,
} from './types'

const SUPPORT_ROTATION: Array<
  Extract<SupportFocus, 'top' | 'middle' | 'start/bottom'>
> = ['top', 'middle', 'start/bottom']

function sortMaxResults(results: MaxExposure[]) {
  return [...results].sort((left, right) => left.date.localeCompare(right.date))
}

function findLatestResult(results: MaxExposure[]) {
  return sortMaxResults(results).at(-1) ?? null
}

export function getBaselineMax(results: MaxExposure[]) {
  const sorted = sortMaxResults(results)

  if (sorted.length === 0) {
    return null
  }

  if (sorted.length === 1) {
    return sorted[0]!.reps
  }

  return Math.max(...sorted.slice(0, -1).map((result) => result.reps))
}

export function classifyTrend(results: MaxExposure[]): TrendClassification {
  const sorted = sortMaxResults(results)

  if (sorted.length <= 1) {
    return 'stable'
  }

  const latest = sorted.at(-1)!
  const previous = sorted.at(-2)!
  const baseline = getBaselineMax(sorted)

  if (baseline === null) {
    return 'stable'
  }

  if (latest.reps > baseline) {
    return 'rising'
  }

  if (previous.reps < baseline && latest.reps < baseline) {
    return 'falling'
  }

  return 'stable'
}

export function isMaxReady(
  daysSinceLastWorkout: number | null,
  daysSinceLastMax: number | null,
) {
  const workoutFresh =
    daysSinceLastWorkout === null || daysSinceLastWorkout >= 3
  const maxGapMet = daysSinceLastMax === null || daysSinceLastMax >= 7
  return workoutFresh && maxGapMet
}

export function shouldEaseSupport(input: RecommendationInput) {
  const fatigueHigh = input.fatigueAverage !== null && input.fatigueAverage >= 4
  const trend = classifyTrend(input.cycleMaxResults)

  return (
    trend === 'falling' ||
    fatigueHigh ||
    input.supportPainOverride ||
    input.sessionsLast7 >= 4
  )
}

function getSupportFocus(input: RecommendationInput): SupportFocus {
  const failurePointFocus = getSupportFocusFromFailurePoint(
    input.latestFailurePoint,
  )

  if (failurePointFocus !== 'generic') {
    return failurePointFocus
  }

  const latestRotatedFocus = input.supportFocusHistory?.at(-1)

  if (!latestRotatedFocus) {
    return SUPPORT_ROTATION[0]!
  }

  const currentIndex = SUPPORT_ROTATION.indexOf(latestRotatedFocus)
  const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1

  return SUPPORT_ROTATION[nextIndex % SUPPORT_ROTATION.length]!
}

export function getAdjustedProgramSteps(
  input: RecommendationInput,
  sessionType: 'max' | 'support',
  supportFocusOverride?: SupportFocus,
) {
  const supportFocus = supportFocusOverride ?? getSupportFocus(input)
  let steps: ProgramStep[] = getProgramStepsForSession(
    input.programTemplate,
    sessionType,
    supportFocus,
  )

  steps = resolveProgramStepsForSession({
    exercises: input.exercises,
    mainMovement: input.mainMovement,
    sessionType,
    steps,
    supportPainOverride: input.supportPainOverride,
  })

  steps = applyPhaseAdjustments(
    input.programTemplate,
    steps,
    sessionType,
    input.currentPhase,
    input.bandsAvailable,
  )

  if (
    sessionType === 'support' &&
    input.currentPhase !== 'build' &&
    shouldEaseSupport(input)
  ) {
    steps = applyEasySupportAdjustments(steps, input.bandsAvailable)
  }

  return steps
}

function getSuggestedExercises(
  input: RecommendationInput,
  exercises: Exercise[],
  nextSessionType: 'max' | 'support',
) {
  const steps = getAdjustedProgramSteps(input, nextSessionType)

  const names = getExerciseNamesForProgramSteps(steps, exercises)

  if (
    nextSessionType === 'support' &&
    (input.currentPhase === 'build' || shouldEaseSupport(input)) &&
    input.bandsAvailable
  ) {
    const bandExerciseName = getSupportBandExerciseName(
      input.mainMovement,
      nextSessionType,
      input.supportPainOverride,
    )

    return [
      bandExerciseName,
      ...names.filter((name) => name !== bandExerciseName),
    ].slice(0, 5)
  }

  return names.slice(0, 5)
}

function buildExplanation(
  input: RecommendationInput,
  maxReady: boolean,
  trend: TrendClassification,
  supportFocus: SupportFocus,
) {
  if (!maxReady) {
    if (input.currentPhase === 'peak') {
      return 'Max day is not ready yet. Peak phase is active, so keep Support light, specific, and fresh this week.'
    }

    if (input.currentPhase === 'build') {
      return 'Max day is not ready yet. Build phase favors easier clean Support work while you build reliable volume.'
    }

    if (shouldEaseSupport(input)) {
      return 'Max day is not ready yet. Use an easier clean Support day and keep the stress under control.'
    }

    if (
      getSupportFocusFromFailurePoint(input.latestFailurePoint) === 'generic' &&
      supportFocus !== 'generic'
    ) {
      return `Max day is not ready yet. No clear failure point was logged, so rotate to the ${supportFocus} support block.`
    }

    return `Max day is not ready yet. Use the ${supportFocus} support block from the most recent max-day result.`
  }

  if (input.cycleMaxResults.length === 0) {
    return input.currentPhase === 'build'
      ? 'You are ready for a Max day. Build phase starts by anchoring the cycle with one true all-out max set.'
      : 'You are ready for a Max day. Log one true all-out max set to anchor the plan.'
  }

  if (trend === 'falling') {
    return 'You are ready for a Max day. Trend is falling, so keep the follow-up support work easier and cleaner.'
  }

  if (input.currentPhase === 'peak') {
    return 'You are ready for a Max day. Peak phase is active, so keep the rest of the week fresh and specific.'
  }

  return 'You are ready for a Max day. Continue the current two-session structure.'
}

export function buildRecommendationReasons(input: RecommendationInput) {
  const reasons: string[] = []

  if (input.daysSinceLastMax === null) {
    reasons.push('No max test is logged in the current history.')
  } else if (input.daysSinceLastMax >= 7) {
    reasons.push(
      `The last max test was ${input.daysSinceLastMax} days ago, meeting the 7-day minimum.`,
    )
  } else {
    reasons.push(
      `The last max test was ${input.daysSinceLastMax} days ago; 7 days are required.`,
    )
  }

  if (input.daysSinceLastWorkout === null) {
    reasons.push('No recent workout or GG set is limiting freshness.')
  } else {
    const fullRestDays = Math.max(0, input.daysSinceLastWorkout - 1)
    reasons.push(
      `${fullRestDays} full rest day${fullRestDays === 1 ? '' : 's'} since the last workout or GG set; 2 are required for a Max day.`,
    )
  }

  const trend = classifyTrend(input.cycleMaxResults)
  reasons.push(
    `${input.currentPhase} phase and a ${trend} max trend set the current workload.`,
  )

  if (input.supportPainOverride) {
    reasons.push('Recent joint-pain data is keeping Support work easier.')
  } else if (input.fatigueAverage !== null && input.fatigueAverage >= 4) {
    reasons.push(
      `Recent average fatigue is ${input.fatigueAverage}/5, so Support work is reduced.`,
    )
  } else if (input.sessionsLast7 >= 4) {
    reasons.push(
      `${input.sessionsLast7} workouts were logged in the last 7 days, so Support stress is reduced.`,
    )
  } else {
    const failureFocus = getSupportFocusFromFailurePoint(
      input.latestFailurePoint,
    )
    if (failureFocus !== 'generic') {
      reasons.push(
        `The latest max failed at ${input.latestFailurePoint}, which selects the ${failureFocus} support focus.`,
      )
    }
  }

  return reasons
}

export function createRecommendation(
  input: RecommendationInput,
  exercises: Exercise[],
): RecommendationState {
  const maxReadinessSatisfied = isMaxReady(
    input.daysSinceLastWorkout,
    input.daysSinceLastMax,
  )
  const nextSessionType = maxReadinessSatisfied ? 'max' : 'support'
  const trend = classifyTrend(input.cycleMaxResults)
  const defaultSupportFocus = getSupportFocus(input)

  return {
    id: 'recommendation-current',
    nextSessionType,
    maxReadinessSatisfied,
    daysSinceLastMax: input.daysSinceLastMax,
    daysSinceLastWorkout: input.daysSinceLastWorkout,
    baselineMax: getBaselineMax(input.cycleMaxResults),
    currentPhase: input.currentPhase,
    trend,
    defaultSupportFocus,
    suggestedExercises: getSuggestedExercises(
      input,
      exercises,
      nextSessionType,
    ),
    explanation: buildExplanation(
      input,
      maxReadinessSatisfied,
      trend,
      defaultSupportFocus,
    ),
    computedAt: new Date().toISOString(),
  }
}

export function getLatestFailurePoint(results: MaxExposure[]) {
  return findLatestResult(results)?.failurePoint ?? null
}
