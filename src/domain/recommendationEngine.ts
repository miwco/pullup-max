import { getSupportBandExerciseName } from './mainMovement'
import {
  applyCompetitionPrepAdjustments,
  applyEasySupportAdjustments,
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

export function isMaxReady(daysSinceLastWorkout: number | null) {
  return daysSinceLastWorkout === null || daysSinceLastWorkout >= 3
}

export function shouldEaseSupport(input: RecommendationInput) {
  const fatigueHigh =
    input.fatigueAverage !== null && input.fatigueAverage >= 4
  const trend = classifyTrend(input.cycleMaxResults)

  return (
    trend === 'falling' ||
    fatigueHigh ||
    input.supportPainOverride ||
    input.sessionsLast7 >= 4
  )
}

function getSupportFocus(input: RecommendationInput): SupportFocus {
  return getSupportFocusFromFailurePoint(input.latestFailurePoint)
}

export function getAdjustedProgramSteps(
  input: RecommendationInput,
  sessionType: 'max' | 'support',
) {
  const supportFocus = getSupportFocus(input)
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

  if (sessionType === 'support') {
    if (input.currentPhase === 'competition-prep') {
      steps = applyCompetitionPrepAdjustments(input.programTemplate, steps)
    }

    if (input.currentPhase === 'build' || shouldEaseSupport(input)) {
      steps = applyEasySupportAdjustments(steps, input.bandsAvailable)
    }
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
    if (input.currentPhase === 'competition-prep') {
      return 'Max day is not ready yet. Competition prep is active, so keep Support light, specific, and fresh this week.'
    }

    if (input.currentPhase === 'build') {
      return 'Max day is not ready yet. Build phase favors easier clean Support work while you build reliable volume.'
    }

    if (shouldEaseSupport(input)) {
      return 'Max day is not ready yet. Use an easier clean Support day and keep the stress under control.'
    }

    if (supportFocus === 'generic') {
      return 'Max day is not ready yet. Use the default clean Support day and keep the reps controlled.'
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

  if (input.currentPhase === 'competition-prep') {
    return 'You are ready for a Max day. Competition prep is active, so keep the rest of the week fresh and specific.'
  }

  return 'You are ready for a Max day. Continue the current two-session structure.'
}

export function createRecommendation(
  input: RecommendationInput,
  exercises: Exercise[],
): RecommendationState {
  const maxReadinessSatisfied = isMaxReady(input.daysSinceLastWorkout)
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
