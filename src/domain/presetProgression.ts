import type {
  ExerciseEntry,
  PresetProgressionState,
  ProgramStep,
  ResolvedPresetTarget,
} from './types'

const EMOM_DEFAULT_MINUTES = 10

function clampToPositiveInteger(value: number | undefined, fallback = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return fallback
  }

  return Math.round(value)
}

function getResolvedEmomMinutes(step: ProgramStep) {
  if (typeof step.emomMinutes !== 'number') {
    return EMOM_DEFAULT_MINUTES
  }

  return EMOM_DEFAULT_MINUTES
}

function getInitialEmomBaseReps(latestMaxReps: number | null) {
  if (latestMaxReps === null || latestMaxReps < 8) {
    return 2
  }

  if (latestMaxReps >= 13) {
    return 4
  }

  return 3
}

function resolveEmomStage(
  minutes: number,
  baseReps: number,
  stageOffset: number,
) {
  const normalizedOffset = Math.max(0, stageOffset)
  const stepsPerTier = Math.ceil(minutes / 2)
  const tierOffset = Math.floor(normalizedOffset / stepsPerTier)
  const mixedStep = normalizedOffset % stepsPerTier

  if (mixedStep === 0) {
    const reps = baseReps + tierOffset

    return {
      segments: [{ sets: minutes, reps }],
      totalReps: minutes * reps,
    }
  }

  const lowerReps = baseReps + tierOffset
  const higherReps = lowerReps + 1
  const higherSets = Math.min(minutes, mixedStep * 2)
  const lowerSets = Math.max(0, minutes - higherSets)

  return {
    segments: [
      { sets: higherSets, reps: higherReps },
      { sets: lowerSets, reps: lowerReps },
    ].filter((segment) => segment.sets > 0),
    totalReps: higherSets * higherReps + lowerSets * lowerReps,
  }
}

function formatRepSummary(step: ProgramStep, reps: number) {
  const sets = clampToPositiveInteger(step.sets)
  return `${sets}x${reps}`
}

function formatHoldSummary(step: ProgramStep, seconds: number) {
  const sets = clampToPositiveInteger(step.sets)
  return `${sets}x${seconds}s hold`
}

function formatDurationSummary(step: ProgramStep, seconds: number) {
  const sets = clampToPositiveInteger(step.sets)
  return `${sets}x${seconds}s`
}

function formatEmomSummary(
  minutes: number,
  segments: Array<{ sets: number; reps: number }>,
) {
  if (segments.length === 1) {
    return `${minutes}m EMOM @ ${segments[0]!.reps}`
  }

  return `${minutes}m EMOM: ${segments
    .map((segment) => `${segment.sets}x${segment.reps}`)
    .join(' + ')}`
}

export function getPresetKey(step: ProgramStep) {
  return step.id
}

export function getPresetStepMode(step: ProgramStep) {
  if (
    typeof step.emomMinutes === 'number' ||
    typeof step.emomReps === 'number'
  ) {
    return 'emom' as const
  }

  if (typeof step.holdSeconds === 'number') {
    return 'hold-seconds' as const
  }

  if (typeof step.durationSeconds === 'number') {
    return 'duration-seconds' as const
  }

  return 'reps' as const
}

export function resolvePresetTarget(
  step: ProgramStep,
  state: PresetProgressionState | undefined,
  latestMaxReps: number | null,
): ResolvedPresetTarget {
  const mode = getPresetStepMode(step)

  if (mode === 'emom') {
    const minutes = getResolvedEmomMinutes(step)
    const baseReps =
      state?.mode === 'emom'
        ? state.emomBaseReps
        : getInitialEmomBaseReps(latestMaxReps)
    const stageOffset = state?.mode === 'emom' ? state.emomStageOffset : 0
    const resolvedStage = resolveEmomStage(minutes, baseReps, stageOffset)

    return {
      mode,
      summary: formatEmomSummary(minutes, resolvedStage.segments),
      entrySets: 1,
      entryReps: resolvedStage.totalReps,
      emomMinutes: minutes,
      emomSegments: resolvedStage.segments,
    }
  }

  if (mode === 'hold-seconds') {
    const seconds =
      state?.mode === mode
        ? state.currentValue
        : clampToPositiveInteger(step.holdSeconds)

    return {
      mode,
      summary: formatHoldSummary(step, seconds),
      entrySets: clampToPositiveInteger(step.sets),
      entryDurationSeconds: seconds,
    }
  }

  if (mode === 'duration-seconds') {
    const seconds =
      state?.mode === mode
        ? state.currentValue
        : clampToPositiveInteger(step.durationSeconds)

    return {
      mode,
      summary: formatDurationSummary(step, seconds),
      entrySets: clampToPositiveInteger(step.sets),
      entryDurationSeconds: seconds,
    }
  }

  const reps =
    state?.mode === mode
      ? state.currentValue
      : clampToPositiveInteger(step.minReps ?? step.reps)

  return {
    mode,
    summary: formatRepSummary(step, reps),
    entrySets: clampToPositiveInteger(step.sets),
    entryReps: reps,
  }
}

export function advancePresetProgression(
  step: ProgramStep,
  currentState: PresetProgressionState | undefined,
  latestMaxReps: number | null,
): PresetProgressionState {
  const presetKey = getPresetKey(step)
  const mode = getPresetStepMode(step)

  if (mode === 'emom') {
    return {
      presetKey,
      mode,
      emomBaseReps:
        currentState?.mode === 'emom'
          ? currentState.emomBaseReps
          : getInitialEmomBaseReps(latestMaxReps),
      emomStageOffset:
        currentState?.mode === 'emom' ? currentState.emomStageOffset + 1 : 1,
    }
  }

  if (mode === 'hold-seconds') {
    const currentValue =
      currentState?.mode === mode
        ? currentState.currentValue
        : clampToPositiveInteger(step.holdSeconds)

    return {
      presetKey,
      mode,
      currentValue: currentValue + 2,
    }
  }

  if (mode === 'duration-seconds') {
    const currentValue =
      currentState?.mode === mode
        ? currentState.currentValue
        : clampToPositiveInteger(step.durationSeconds)

    return {
      presetKey,
      mode,
      currentValue: currentValue + 5,
    }
  }

  const currentValue =
    currentState?.mode === mode
      ? currentState.currentValue
      : clampToPositiveInteger(step.minReps ?? step.reps)
  const nextValue =
    typeof step.maxReps === 'number'
      ? Math.min(step.maxReps, currentValue + 1)
      : currentValue + 1

  return {
    presetKey,
    mode,
    currentValue: nextValue,
  }
}

export function applyPresetOutcomes(
  currentStates: PresetProgressionState[],
  entries: ExerciseEntry[],
  stepLookup: Map<string, ProgramStep>,
  latestMaxReps: number | null,
) {
  const nextStates = new Map(
    currentStates.map((state) => [state.presetKey, structuredClone(state)]),
  )

  entries.forEach((entry) => {
    if (entry.outcome !== 'pass' || !entry.presetKey) {
      return
    }

    const step = stepLookup.get(entry.presetKey)

    if (!step) {
      return
    }

    nextStates.set(
      entry.presetKey,
      advancePresetProgression(
        step,
        nextStates.get(entry.presetKey),
        latestMaxReps,
      ),
    )
  })

  return [...nextStates.values()]
}
