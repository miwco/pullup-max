import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { AccordionSection } from '../../components/AccordionSection'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/appContext'
import type {
  FailurePoint,
  ProgramEntryDraft,
  QualityFlag,
  SessionType,
  SupportFocus,
  WorkoutLogDraft,
  WorkoutLogEntryDraft,
} from '../../domain/types'
import { formatLongDate, todayDateString } from '../../lib/date'
import { createId } from '../../lib/id'
import { formatQualityFlag, getQualityTone } from '../../lib/qualityFlag'
import { playTone, type TimerSoundSettings } from '../../lib/timerSound'
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'
import { getLatestLoggedMaxReps } from '../../domain/selectors'
import { useScreenWakeLock } from '../../lib/useScreenWakeLock'
import { requestTimerStop, subscribeToTimerStop } from '../../lib/timerEvents'
import { useSetIntervalTimer } from './useSetIntervalTimer'

interface LogWorkoutScreenProps {
  prefill: boolean
  requestedType: SessionType | null
  onSaved: () => void
}

const FAILURE_POINTS: FailurePoint[] = [
  'top',
  'middle',
  'start/bottom',
  'grip',
  'not sure',
]

const QUALITY_FLAGS: QualityFlag[] = ['clean', 'grindy', 'partial']
const QUALITY_FLAG_LABELS: Record<QualityFlag, string> = {
  clean: 'clean',
  grindy: 'hard',
  partial: 'very hard',
}
type SupportWorkoutFocus = Extract<
  SupportFocus,
  'top' | 'middle' | 'start/bottom'
>
const SUPPORT_WORKOUT_OPTIONS: Array<{
  id: SupportWorkoutFocus
  label: string
}> = [
  { id: 'top', label: 'top' },
  { id: 'middle', label: 'middle' },
  { id: 'start/bottom', label: 'low' },
]
const PREP_SECONDS = 10
const DEFAULT_EXERCISE_REST_SECONDS = 5 * 60
const DEFAULT_HOLD_REST_SECONDS = 2 * 60
const DEFAULT_MAX_TO_BLOCK_REST_SECONDS = 7 * 60
const EMOM_REST_SECONDS = 60
const COUNTDOWN_BEEP_SECONDS = 5
const EMOM_REST_WARNING_SECONDS = 5
const TIMER_STORAGE_PREFIX = 'pullup-max:timer'

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const nextNumber = Number(value)
  return Number.isFinite(nextNumber) ? nextNumber : undefined
}

function normalizeSupportWorkoutFocus(
  supportFocus: SupportFocus | undefined,
): SupportWorkoutFocus {
  if (
    supportFocus === 'top' ||
    supportFocus === 'middle' ||
    supportFocus === 'start/bottom'
  ) {
    return supportFocus
  }

  return 'middle'
}

function toDrafts(prefillRows: ProgramEntryDraft[]): WorkoutLogEntryDraft[] {
  return prefillRows.map((row) => ({
    ...row,
    localId: createId('draft'),
  }))
}

function serializeEntry(entry: ProgramEntryDraft) {
  return {
    templateStepId: entry.templateStepId,
    presetKey: entry.presetKey,
    outcome: entry.outcome,
  }
}

function createEntriesSignature(entries: ProgramEntryDraft[]) {
  return JSON.stringify(entries.map(serializeEntry))
}

function formatDraftSavedAt(value: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type TimerPhase = 'ready' | 'prep' | 'work' | 'rest' | 'complete'

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function getEmomWorkSeconds(reps: number) {
  return 15 + Math.max(0, reps - 3) * 5
}

function getEmomRoundPlan(entry: WorkoutLogEntryDraft) {
  const segmentReps =
    entry.target.emomSegments?.flatMap((segment) =>
      Array.from({ length: segment.sets }, () => segment.reps),
    ) ?? []
  const roundCount =
    entry.target.emomMinutes || segmentReps.length || entry.target.entrySets
  const fallbackReps = Math.max(
    1,
    Math.round((entry.target.entryReps ?? roundCount) / roundCount),
  )
  const lastSegmentReps = segmentReps.at(-1)

  return Array.from(
    { length: roundCount },
    (_, index) => segmentReps[index] ?? lastSegmentReps ?? fallbackReps,
  )
}

function formatEmomSetRepTarget(roundPlan: number[]) {
  const groups = roundPlan.reduce<Array<{ sets: number; reps: number }>>(
    (result, reps) => {
      const latest = result[result.length - 1]

      if (latest?.reps === reps) {
        latest.sets += 1
      } else {
        result.push({ sets: 1, reps })
      }

      return result
    },
    [],
  )

  return groups
    .map(
      ({ sets, reps }) =>
        `${sets} ${sets === 1 ? 'set' : 'sets'} × ${reps} ${reps === 1 ? 'rep' : 'reps'}`,
    )
    .join(' + ')
}

function getStoredTimerKey(key: string) {
  return `${TIMER_STORAGE_PREFIX}:${key}`
}

function readStoredTimer<T>(key: string): T | null {
  try {
    const stored = window.localStorage.getItem(getStoredTimerKey(key))
    return stored ? (JSON.parse(stored) as T) : null
  } catch {
    return null
  }
}

function writeStoredTimer<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(getStoredTimerKey(key), JSON.stringify(value))
  } catch {
    // Timer persistence is helpful, but the visible timer still works without it.
  }
}

function clearStoredTimer(key: string) {
  try {
    window.localStorage.removeItem(getStoredTimerKey(key))
  } catch {
    // Ignore storage cleanup failures.
  }
}

function EmomTimer({
  entry,
  onInteract,
  onStart,
  soundSettings,
  timerKey,
}: {
  entry: WorkoutLogEntryDraft
  onInteract: () => void
  onStart?: () => void
  soundSettings: TimerSoundSettings
  timerKey: string
}) {
  const roundPlan = useMemo(() => getEmomRoundPlan(entry), [entry])
  const roundCount = roundPlan.length
  const targetSignature = `${entry.presetKey}:${entry.target.summary}:${roundPlan.join(',')}`
  const initialSeconds = getEmomWorkSeconds(roundPlan[0] ?? 1)
  const beepKeyRef = useRef('')
  const initialTimer = useMemo(
    () => ({
      currentRound: 1,
      isRunning: false,
      lastUpdatedAt: null as number | null,
      phase: 'ready' as TimerPhase,
      previousPhase: null as TimerPhase | null,
      secondsRemaining: initialSeconds,
      targetSignature,
    }),
    [initialSeconds, targetSignature],
  )

  const advanceTimer = useCallback(
    (
      current: typeof initialTimer,
      elapsedSeconds: number,
      now: number,
    ): typeof initialTimer => {
      if (
        !current.isRunning ||
        current.phase === 'ready' ||
        current.phase === 'complete'
      ) {
        return {
          ...current,
          lastUpdatedAt: current.isRunning ? now : current.lastUpdatedAt,
        }
      }

      let next = { ...current }
      let remainingElapsed = Math.max(0, elapsedSeconds)

      while (remainingElapsed > 0 && next.isRunning) {
        if (next.secondsRemaining > remainingElapsed) {
          next = {
            ...next,
            secondsRemaining: next.secondsRemaining - remainingElapsed,
            lastUpdatedAt: now,
          }
          remainingElapsed = 0
          break
        }

        remainingElapsed -= next.secondsRemaining

        if (next.phase === 'prep') {
          next = {
            ...next,
            phase: 'work',
            previousPhase: 'prep',
            secondsRemaining: getEmomWorkSeconds(
              roundPlan[next.currentRound - 1] ?? 1,
            ),
          }
          continue
        }

        if (next.phase === 'work') {
          if (next.currentRound >= roundCount) {
            next = {
              ...next,
              isRunning: false,
              lastUpdatedAt: null,
              phase: 'complete',
              previousPhase: 'work',
              secondsRemaining: 0,
            }
            break
          }

          next = {
            ...next,
            phase: 'rest',
            previousPhase: 'work',
            secondsRemaining: EMOM_REST_SECONDS,
          }
          continue
        }

        if (next.phase === 'rest') {
          const nextRound = Math.min(roundCount, next.currentRound + 1)
          next = {
            ...next,
            currentRound: nextRound,
            phase: 'work',
            previousPhase: 'rest',
            secondsRemaining: getEmomWorkSeconds(roundPlan[nextRound - 1] ?? 1),
          }
          continue
        }

        remainingElapsed = 0
      }

      return {
        ...next,
        lastUpdatedAt: next.isRunning ? now : next.lastUpdatedAt,
      }
    },
    [roundCount, roundPlan],
  )

  const [timer, setTimer] = useState(() => {
    const stored = readStoredTimer<typeof initialTimer>(timerKey)

    if (stored?.targetSignature === targetSignature) {
      const now = Date.now()
      const elapsedSeconds =
        stored.isRunning && stored.lastUpdatedAt
          ? Math.floor((now - stored.lastUpdatedAt) / 1000)
          : 0
      return advanceTimer(stored, elapsedSeconds, now)
    }

    return initialTimer
  })
  useScreenWakeLock(timer.isRunning)

  useEffect(() => {
    writeStoredTimer(timerKey, timer)
  }, [timer, timerKey])

  useEffect(() => {
    if (
      !timer.isRunning ||
      timer.phase === 'ready' ||
      timer.phase === 'complete'
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      setTimer((current) => {
        const now = Date.now()
        const elapsedSeconds = current.lastUpdatedAt
          ? Math.floor((now - current.lastUpdatedAt) / 1000)
          : 0

        if (elapsedSeconds <= 0) {
          return current
        }

        return advanceTimer(current, elapsedSeconds, now)
      })
    }, 500)

    return () => window.clearInterval(intervalId)
  }, [advanceTimer, timer.isRunning, timer.phase])

  useEffect(() => {
    if (!timer.isRunning) {
      return
    }

    const shouldCountdownBeep =
      timer.secondsRemaining > 0 &&
      ((timer.phase === 'prep' &&
        timer.secondsRemaining <= COUNTDOWN_BEEP_SECONDS) ||
        (timer.phase === 'rest' &&
          timer.secondsRemaining <= EMOM_REST_WARNING_SECONDS))

    if (!shouldCountdownBeep) {
      return
    }

    const beepKey = `${timer.phase}:${timer.currentRound}:${timer.secondsRemaining}`

    if (beepKeyRef.current === beepKey) {
      return
    }

    beepKeyRef.current = beepKey
    playTone(soundSettings, timer.phase === 'rest' ? 'ending' : 'countdown')
  }, [
    soundSettings,
    timer.currentRound,
    timer.isRunning,
    timer.phase,
    timer.secondsRemaining,
  ])

  useEffect(() => {
    if (!timer.previousPhase || timer.previousPhase === timer.phase) {
      return
    }

    if (timer.phase === 'complete') {
      playTone(soundSettings, 'complete')
    } else if (timer.phase === 'rest') {
      const currentReps = roundPlan[timer.currentRound - 1]
      const nextReps = roundPlan[timer.currentRound]
      playTone(
        soundSettings,
        currentReps !== undefined &&
          nextReps !== undefined &&
          currentReps !== nextReps
          ? 'rep-change'
          : 'alarm',
      )
    } else if (timer.phase === 'work') {
      playTone(soundSettings, 'alarm')
    }
  }, [
    roundPlan,
    soundSettings,
    timer.currentRound,
    timer.phase,
    timer.previousPhase,
  ])

  function startTimer() {
    onInteract()
    onStart?.()
    setTimer((current) => {
      const shouldRestart = current.phase === 'complete'
      const currentRound = shouldRestart ? 1 : current.currentRound
      const phase =
        current.phase === 'ready' || shouldRestart ? 'prep' : current.phase

      return {
        ...current,
        currentRound,
        isRunning: true,
        lastUpdatedAt: Date.now(),
        phase,
        previousPhase: current.phase,
        secondsRemaining:
          current.phase === 'ready' || shouldRestart
            ? PREP_SECONDS
            : current.secondsRemaining,
      }
    })
  }

  function pauseTimer() {
    onInteract()
    setTimer((current) => ({
      ...current,
      isRunning: false,
      lastUpdatedAt: null,
    }))
  }

  function resetTimer() {
    onInteract()
    clearStoredTimer(timerKey)
    setTimer(initialTimer)
  }

  const currentReps = roundPlan[timer.currentRound - 1] ?? 1
  const nextRound =
    timer.phase === 'rest'
      ? Math.min(roundCount, timer.currentRound + 1)
      : timer.currentRound
  const nextReps = roundPlan[nextRound - 1] ?? currentReps
  const phaseLabel =
    timer.phase === 'complete'
      ? 'Block complete'
      : timer.phase === 'prep'
        ? 'Get to the bar'
        : timer.phase === 'rest'
          ? 'Rest'
          : timer.phase === 'work'
            ? 'Work'
            : 'Ready'
  const instruction =
    timer.phase === 'rest'
      ? `Next set ${nextRound}: ${nextReps} reps`
      : timer.phase === 'work' || timer.phase === 'prep'
        ? `Set ${timer.currentRound}: ${currentReps} reps`
        : formatEmomSetRepTarget(roundPlan)

  return (
    <div
      className={`timer-panel timer-panel--emom${timer.isRunning ? ' is-active' : ''}`}
    >
      <div>
        <p className="metric-label">Pull-up block timer</p>
        <strong>{phaseLabel}</strong>
        {timer.phase === 'ready' ? (
          <p className="muted-text">10 seconds before first set</p>
        ) : null}
      </div>

      <div className="timer-panel__readout">
        <span>{formatTimer(timer.secondsRemaining)}</span>
        <small>
          Set {Math.min(nextRound, roundCount)} / {roundCount}
        </small>
      </div>

      <div className="timer-panel__instruction">
        <span>{timer.phase}</span>
        <strong>{instruction}</strong>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button button--primary button--compact"
          onClick={timer.isRunning ? pauseTimer : startTimer}
        >
          {timer.isRunning
            ? 'Pause'
            : timer.phase === 'ready'
              ? 'Start'
              : 'Resume'}
        </button>
        <button
          type="button"
          className="button button--ghost button--compact"
          onClick={resetTimer}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function HoldTimer({
  entry,
  onStart,
  soundSettings,
}: {
  entry: WorkoutLogEntryDraft
  onStart?: () => void
  soundSettings: TimerSoundSettings
}) {
  const holdSeconds = entry.target.entryDurationSeconds ?? 0
  const setCount = entry.target.entrySets
  const { pause, reset, start, timer, updateRestMinutes } = useSetIntervalTimer(
    {
      onStart,
      prepBetweenSets: false,
      prepSeconds: PREP_SECONDS,
      restSeconds: DEFAULT_HOLD_REST_SECONDS,
      setCount,
      soundSettings,
      workSeconds: holdSeconds,
    },
  )

  const phaseLabel =
    timer.phase === 'complete'
      ? 'Hold complete'
      : timer.phase === 'prep'
        ? 'Get to the bar'
        : timer.phase === 'rest'
          ? 'Rest before next hold'
          : timer.phase === 'work'
            ? 'Hold now'
            : 'Ready'

  return (
    <div className="timer-panel">
      <div>
        <p className="metric-label">Hold timer</p>
        <strong>{phaseLabel}</strong>
        <p className="muted-text">
          {PREP_SECONDS}s prep before hold 1 - {setCount} holds - {holdSeconds}s
          work - rest {formatTimer(timer.restSeconds)}
        </p>
      </div>

      <div className="timer-panel__readout">
        <span>{formatTimer(timer.secondsRemaining)}</span>
        <small>
          Set {Math.min(timer.currentSet, setCount)} / {setCount}
        </small>
      </div>

      <label className="field timer-panel__input">
        <span>Rest min</span>
        <input
          type="number"
          min="1"
          step="1"
          value={Math.round(timer.restSeconds / 60)}
          onChange={(event) => updateRestMinutes(event.target.value)}
        />
      </label>

      <div className="button-row">
        <button
          type="button"
          className="button button--primary button--compact"
          onClick={timer.isRunning ? pause : start}
        >
          {timer.isRunning
            ? 'Pause'
            : timer.phase === 'ready'
              ? 'Start'
              : 'Resume'}
        </button>
        <button
          type="button"
          className="button button--ghost button--compact"
          onClick={reset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function DurationTimer({
  entry,
  onStart,
  soundSettings,
}: {
  entry: WorkoutLogEntryDraft
  onStart?: () => void
  soundSettings: TimerSoundSettings
}) {
  const workSeconds = entry.target.entryDurationSeconds ?? 0
  const setCount = entry.target.entrySets
  const { pause, reset, start, timer, updateRestMinutes } = useSetIntervalTimer(
    {
      onStart,
      prepBetweenSets: true,
      prepSeconds: PREP_SECONDS,
      restSeconds: DEFAULT_HOLD_REST_SECONDS,
      setCount,
      soundSettings,
      workSeconds,
    },
  )

  const phaseLabel =
    timer.phase === 'complete'
      ? 'Work complete'
      : timer.phase === 'prep'
        ? 'Get ready'
        : timer.phase === 'rest'
          ? 'Rest before next set'
          : timer.phase === 'work'
            ? 'Work now'
            : 'Ready'

  return (
    <div className="timer-panel">
      <div>
        <p className="metric-label">Timed exercise timer</p>
        <strong>{phaseLabel}</strong>
        <p className="muted-text">
          {PREP_SECONDS}s prep - {setCount} sets - {workSeconds}s work - rest{' '}
          {formatTimer(timer.restSeconds)}
        </p>
      </div>

      <div className="timer-panel__readout">
        <span>{formatTimer(timer.secondsRemaining)}</span>
        <small>
          Set {Math.min(timer.currentSet, setCount)} / {setCount}
        </small>
      </div>

      <label className="field timer-panel__input">
        <span>Rest min</span>
        <input
          type="number"
          min="1"
          step="1"
          value={Math.round(timer.restSeconds / 60)}
          onChange={(event) => updateRestMinutes(event.target.value)}
        />
      </label>

      <div className="button-row">
        <button
          type="button"
          className="button button--primary button--compact"
          onClick={timer.isRunning ? pause : start}
        >
          {timer.isRunning
            ? 'Pause'
            : timer.phase === 'ready'
              ? 'Start'
              : 'Resume'}
        </button>
        <button
          type="button"
          className="button button--ghost button--compact"
          onClick={reset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function RestTimer({
  autoStartKey = 0,
  defaultRestSeconds = DEFAULT_EXERCISE_REST_SECONDS,
  label = 'Rest before next exercise',
  onInteract,
  soundSettings,
  storageKey,
}: {
  autoStartKey?: number
  defaultRestSeconds?: number
  label?: string
  onInteract?: () => void
  soundSettings: TimerSoundSettings
  storageKey: string
}) {
  const hasRunRef = useRef(autoStartKey > 0)
  const lastWarningSecondRef = useRef<number | null>(null)
  const completionCuePlayedRef = useRef(false)
  const [timer, setTimer] = useState(() => {
    const initialTimer = {
      isRunning: autoStartKey > 0,
      lastUpdatedAt: autoStartKey > 0 ? Date.now() : null,
      restSeconds: defaultRestSeconds,
      secondsRemaining: defaultRestSeconds,
    }

    if (autoStartKey > 0) {
      return initialTimer
    }

    const stored = readStoredTimer<typeof initialTimer>(storageKey)

    if (!stored) {
      return initialTimer
    }

    const now = Date.now()
    const elapsedSeconds =
      stored.isRunning && stored.lastUpdatedAt
        ? Math.floor((now - stored.lastUpdatedAt) / 1000)
        : 0
    const nextSeconds = Math.max(0, stored.secondsRemaining - elapsedSeconds)

    return {
      ...stored,
      isRunning: stored.isRunning && nextSeconds > 0,
      lastUpdatedAt: stored.isRunning && nextSeconds > 0 ? now : null,
      secondsRemaining: nextSeconds,
    }
  })
  useEffect(() => {
    return subscribeToTimerStop(storageKey, () => {
      setTimer((current) => ({
        ...current,
        isRunning: false,
        lastUpdatedAt: null,
      }))
    })
  }, [storageKey])
  useScreenWakeLock(timer.isRunning)

  useEffect(() => {
    writeStoredTimer(storageKey, timer)
  }, [storageKey, timer])

  useEffect(() => {
    if (!timer.isRunning) {
      return
    }

    const intervalId = window.setInterval(() => {
      setTimer((current) => {
        if (!current.isRunning || !current.lastUpdatedAt) {
          return current
        }

        const now = Date.now()
        const elapsedSeconds = Math.floor((now - current.lastUpdatedAt) / 1000)

        if (elapsedSeconds <= 0) {
          return current
        }

        const nextSeconds = Math.max(
          0,
          current.secondsRemaining - elapsedSeconds,
        )

        return {
          ...current,
          isRunning: nextSeconds > 0,
          lastUpdatedAt: nextSeconds > 0 ? now : null,
          secondsRemaining: nextSeconds,
        }
      })
    }, 500)

    return () => window.clearInterval(intervalId)
  }, [timer.isRunning])

  useEffect(() => {
    const isWarningSecond =
      timer.isRunning &&
      timer.secondsRemaining > 0 &&
      timer.secondsRemaining <= EMOM_REST_WARNING_SECONDS

    if (
      isWarningSecond &&
      lastWarningSecondRef.current !== timer.secondsRemaining
    ) {
      lastWarningSecondRef.current = timer.secondsRemaining
      playTone(soundSettings, 'ending')
    }

    if (timer.secondsRemaining > EMOM_REST_WARNING_SECONDS) {
      lastWarningSecondRef.current = null
    }

    if (
      hasRunRef.current &&
      !timer.isRunning &&
      timer.secondsRemaining === 0 &&
      !completionCuePlayedRef.current
    ) {
      completionCuePlayedRef.current = true
      playTone(soundSettings, 'alarm')
    }
  }, [soundSettings, timer.isRunning, timer.secondsRemaining])

  function updateRestMinutes(value: string) {
    const minutes = Number(value)

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return
    }

    const nextRestSeconds = Math.round(minutes * 60)
    onInteract?.()
    setTimer((current) => ({
      isRunning: current.isRunning,
      lastUpdatedAt: current.isRunning ? Date.now() : null,
      restSeconds: nextRestSeconds,
      secondsRemaining: current.isRunning
        ? current.secondsRemaining
        : nextRestSeconds,
    }))
  }

  return (
    <div
      className={`timer-panel timer-panel--rest${timer.isRunning ? ' is-active' : ''}`}
    >
      <div>
        <p className="metric-label">{label}</p>
        <div className="timer-panel__readout">
          <span>{formatTimer(timer.secondsRemaining)}</span>
          <small>{timer.isRunning ? 'Resting' : 'Ready'}</small>
        </div>
      </div>

      <label className="field timer-panel__input">
        <span>Rest min</span>
        <input
          type="number"
          min="1"
          step="1"
          value={Math.round(timer.restSeconds / 60)}
          onChange={(event) => updateRestMinutes(event.target.value)}
        />
      </label>

      <div className="button-row">
        <button
          type="button"
          className="button button--ghost button--compact"
          onClick={() => {
            onInteract?.()
            hasRunRef.current = true
            completionCuePlayedRef.current = false
            lastWarningSecondRef.current = null

            if (!timer.isRunning) {
              playTone(soundSettings, 'start')
            }

            setTimer((current) => ({
              ...current,
              isRunning: !current.isRunning,
              lastUpdatedAt: !current.isRunning ? Date.now() : null,
            }))
          }}
        >
          {timer.isRunning ? 'Pause rest' : 'Start rest'}
        </button>
        <button
          type="button"
          className="button button--ghost button--compact"
          onClick={() => {
            onInteract?.()
            clearStoredTimer(storageKey)
            completionCuePlayedRef.current = false
            lastWarningSecondRef.current = null
            setTimer((current) => ({
              ...current,
              isRunning: false,
              lastUpdatedAt: null,
              secondsRemaining: current.restSeconds,
            }))
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export function LogWorkoutScreen({
  prefill,
  requestedType,
  onSaved,
}: LogWorkoutScreenProps) {
  const {
    clearWorkoutDraft,
    data,
    getProgramPrefill,
    saveSession,
    saveWorkoutDraft,
    workoutDraft,
  } = useAppState()
  const recommendedType = data.recommendationState.nextSessionType
  const initialType = requestedType ?? recommendedType
  const todayAtOpen = todayDateString()
  const draftDateWasUpdated =
    prefill && !!workoutDraft && workoutDraft.date < todayAtOpen
  const initialSessionType = workoutDraft?.sessionType ?? initialType
  const initialSupportFocus = normalizeSupportWorkoutFocus(
    workoutDraft?.supportFocus ?? data.recommendationState.defaultSupportFocus,
  )
  const latestMaxReps = getLatestLoggedMaxReps(
    data.maxTests,
    data.sessions,
    data.athleteProfile.mainMovement,
  )
  const [sessionType, setSessionType] =
    useState<SessionType>(initialSessionType)
  const [supportFocus, setSupportFocus] =
    useState<SupportWorkoutFocus>(initialSupportFocus)
  const [date, setDate] = useState(() =>
    draftDateWasUpdated ? todayAtOpen : (workoutDraft?.date ?? todayAtOpen),
  )
  const [maxReps, setMaxReps] = useState(
    workoutDraft?.maxReps ||
      (latestMaxReps === null ? '' : String(latestMaxReps)),
  )
  const [videoLink, setVideoLink] = useState(workoutDraft?.videoLink ?? '')
  const [failurePoint, setFailurePoint] = useState<FailurePoint | ''>(
    workoutDraft?.failurePoint ?? '',
  )
  const [qualityFlag, setQualityFlag] = useState<QualityFlag | ''>(
    workoutDraft?.qualityFlag ?? '',
  )
  const [maxTestSaved, setMaxTestSaved] = useState(
    () => workoutDraft?.maxTestSaved ?? false,
  )
  const [notes, setNotes] = useState(workoutDraft?.notes ?? '')
  const [entries, setEntries] = useState<WorkoutLogEntryDraft[]>(() =>
    workoutDraft?.entries.length
      ? workoutDraft.entries
      : toDrafts(
          getProgramPrefill(
            initialSessionType,
            initialSessionType === 'support' ? initialSupportFocus : undefined,
          ),
        ),
  )
  const [showMaxDetail, setShowMaxDetail] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [entriesBaselineSignature, setEntriesBaselineSignature] = useState(() =>
    createEntriesSignature(
      toDrafts(
        getProgramPrefill(
          initialSessionType,
          initialSessionType === 'support' ? initialSupportFocus : undefined,
        ),
      ),
    ),
  )
  const [hasInteracted, setHasInteracted] = useState(() => !!workoutDraft)
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>(
    workoutDraft ? 'saved' : 'idle',
  )
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(
    workoutDraft?.updatedAt ?? null,
  )
  const [restAutoStartByEntryId, setRestAutoStartByEntryId] = useState<
    Record<string, number>
  >({})
  const [maxRestAutoStartKey, setMaxRestAutoStartKey] = useState(0)
  const workoutRowsRef = useRef<HTMLDivElement | null>(null)
  const currentEntriesSignature = createEntriesSignature(entries)
  const timerSoundSettings = useMemo(
    () => ({
      soundId: data.settings.timerSoundId,
      volume: data.settings.timerVolume,
    }),
    [data.settings.timerSoundId, data.settings.timerVolume],
  )
  const savedAtLabel = formatDraftSavedAt(draftSavedAt)
  const draftStatusLabel =
    draftSaveStatus === 'saving'
      ? 'Saving draft'
      : draftSaveStatus === 'error'
        ? 'Draft not saved'
        : draftSaveStatus === 'saved'
          ? savedAtLabel
            ? `Draft saved ${savedAtLabel}`
            : 'Draft saved'
          : 'Draft ready'

  useUnsavedChangesPrompt(
    draftSaveStatus === 'saving' || draftSaveStatus === 'error',
  )

  const currentDraft: WorkoutLogDraft = useMemo(
    () => ({
      id: 'current-workout',
      date,
      elbowPain: '',
      entries,
      failurePoint,
      fatigueAfter: '',
      fatigueBefore: '',
      maxReps,
      maxTestSaved,
      notes,
      qualityFlag,
      sessionType,
      shoulderPain: '',
      supportFocus,
      updatedAt: new Date().toISOString(),
      videoLink,
    }),
    [
      date,
      entries,
      failurePoint,
      maxReps,
      maxTestSaved,
      notes,
      qualityFlag,
      sessionType,
      supportFocus,
      videoLink,
    ],
  )

  useEffect(() => {
    if (!hasInteracted) {
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (cancelled) {
        return
      }

      setDraftSaveStatus('saving')

      void saveWorkoutDraft(currentDraft).then((success) => {
        if (cancelled) {
          return
        }

        if (success) {
          setDraftSaveStatus('saved')
          setDraftSavedAt(currentDraft.updatedAt)
          return
        }

        setDraftSaveStatus('error')
      })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [currentDraft, hasInteracted, saveWorkoutDraft])

  function markInteracted() {
    setHasInteracted(true)
  }

  function updateText(setter: Dispatch<SetStateAction<string>>, value: string) {
    markInteracted()
    setter(value)
  }

  function updateMaxTest() {
    markInteracted()
    setMaxTestSaved(false)
  }

  function updateEntry(
    localId: string,
    updates: Partial<WorkoutLogEntryDraft>,
  ) {
    markInteracted()
    setEntries((current) =>
      current.map((entry) =>
        entry.localId === localId ? { ...entry, ...updates } : entry,
      ),
    )
  }

  function markEntryOutcome(
    localId: string,
    outcome: WorkoutLogEntryDraft['outcome'],
  ) {
    updateEntry(localId, { outcome })

    const entryIndex = entries.findIndex((entry) => entry.localId === localId)
    const hasNextExercise = entryIndex >= 0 && entryIndex < entries.length - 1

    if (!hasNextExercise) {
      return
    }

    playTone(timerSoundSettings, 'start')
    setRestAutoStartByEntryId((current) => ({
      ...current,
      [localId]: (current[localId] ?? 0) + 1,
    }))
  }

  function loadPrefill(nextType: SessionType, nextSupportFocus = supportFocus) {
    markInteracted()
    const nextEntries = toDrafts(
      getProgramPrefill(
        nextType,
        nextType === 'support' ? nextSupportFocus : undefined,
      ),
    )
    setEntries(nextEntries)
    setEntriesBaselineSignature(createEntriesSignature(nextEntries))
  }

  async function handleClearDraft() {
    if (
      !window.confirm(
        "Clear the saved in-progress workout and reload today's prescription?",
      )
    ) {
      return
    }

    await clearWorkoutDraft()

    const nextSupportFocus = normalizeSupportWorkoutFocus(
      data.recommendationState.defaultSupportFocus,
    )
    const nextEntries = toDrafts(
      getProgramPrefill(
        initialType,
        initialType === 'support' ? nextSupportFocus : undefined,
      ),
    )
    setSessionType(initialType)
    setSupportFocus(nextSupportFocus)
    setDate(todayDateString())
    setMaxReps('')
    setMaxTestSaved(false)
    setVideoLink('')
    setFailurePoint('')
    setQualityFlag('')
    setNotes('')
    setEntries(nextEntries)
    setEntriesBaselineSignature(createEntriesSignature(nextEntries))
    setHasInteracted(false)
    setDraftSaveStatus('idle')
    setDraftSavedAt(null)
  }

  function canReplaceWorkoutRows() {
    return (
      currentEntriesSignature === entriesBaselineSignature ||
      window.confirm(
        'Discard the current row outcomes and load the default program?',
      )
    )
  }

  function isValidVideoLink(value: string) {
    if (!value.trim()) {
      return true
    }

    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  function handleSaveMaxTest() {
    const parsedMaxReps = parseOptionalNumber(maxReps)

    if (!parsedMaxReps || parsedMaxReps <= 0) {
      setFormError('Max day needs a valid max reps number.')
      return
    }

    if (!isValidVideoLink(videoLink)) {
      setFormError('Video link must be a valid http or https URL.')
      return
    }

    markInteracted()
    setFormError(null)
    setMaxTestSaved(true)
    setShowMaxDetail(false)
    playTone(timerSoundSettings, 'start')
    setMaxRestAutoStartKey((current) => current + 1)

    window.setTimeout(() => {
      if (typeof workoutRowsRef.current?.scrollIntoView !== 'function') {
        return
      }

      workoutRowsRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 0)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving) {
      return
    }

    setFormError(null)

    const parsedMaxReps = parseOptionalNumber(maxReps)

    if (sessionType === 'max' && (!parsedMaxReps || parsedMaxReps <= 0)) {
      setFormError('Max day needs a valid max reps number.')
      return
    }

    if (sessionType === 'max' && !isValidVideoLink(videoLink)) {
      setFormError('Video link must be a valid http or https URL.')
      return
    }

    if (entries.some((entry) => !entry.outcome)) {
      setFormError('Mark every preset row as Pass or Fail before saving.')
      return
    }

    const cleanedEntries = entries
      .filter((entry) => entry.exerciseId)
      .map((entry) => ({
        exerciseId: entry.exerciseId,
        sets: entry.target.entrySets,
        reps: entry.target.entryReps,
        durationSeconds: entry.target.entryDurationSeconds,
        notes: entry.label !== entry.exerciseName ? entry.label : undefined,
        presetKey: entry.presetKey,
        outcome: entry.outcome || undefined,
        presetTargetMode: entry.target.mode,
        presetTargetSummary: entry.target.summary,
        isMaxTest: false,
      }))

    setIsSaving(true)

    const success = await saveSession({
      session: {
        date,
        sessionType,
        notes: notes.trim(),
      },
      entries: cleanedEntries,
      maxTest:
        sessionType === 'max' && parsedMaxReps
          ? {
              reps: parsedMaxReps,
              videoUrl: videoLink.trim() || undefined,
              failurePoint: failurePoint || undefined,
              qualityFlag: qualityFlag || undefined,
            }
          : undefined,
    })

    setIsSaving(false)

    if (success) {
      await clearWorkoutDraft()
      onSaved()
    }
  }

  return (
    <div className="screen-stack">
      {draftDateWasUpdated ? (
        <div className="notice notice--warning" role="status">
          <span>
            This saved draft was dated {formatLongDate(workoutDraft.date)}. Its
            session date was updated to today; you can change it below if
            needed.
          </span>
        </div>
      ) : null}
      <form className="screen-stack" onSubmit={handleSubmit}>
        <Section eyebrow="Fast logging" title="Workout">
          <div className="summary-bar">
            <p className="muted-text">
              Recommended today: <strong>{recommendedType}</strong>
            </p>
            <StatusPill
              label={draftStatusLabel}
              tone={draftSaveStatus === 'error' ? 'warning' : 'success'}
            />
          </div>

          {hasInteracted ? (
            <div className="button-row">
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => void handleClearDraft()}
              >
                Clear draft
              </button>
            </div>
          ) : null}

          <div className="segment-row" role="tablist" aria-label="Session type">
            {(['max', 'support'] as SessionType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`segment-row__item${sessionType === type ? ' is-active' : ''}`}
                onClick={() => {
                  if (type !== sessionType && !canReplaceWorkoutRows()) {
                    return
                  }

                  markInteracted()
                  setSessionType(type)
                  loadPrefill(type, supportFocus)
                }}
              >
                {type}
              </button>
            ))}
          </div>

          {sessionType === 'support' ? (
            <div
              className="segment-row segment-row--triple"
              role="tablist"
              aria-label="Support workout"
            >
              {SUPPORT_WORKOUT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`segment-row__item${supportFocus === option.id ? ' is-active' : ''}`}
                  onClick={() => {
                    if (
                      option.id !== supportFocus &&
                      !canReplaceWorkoutRows()
                    ) {
                      return
                    }

                    markInteracted()
                    setSupportFocus(option.id)
                    loadPrefill('support', option.id)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="field-grid field-grid--compact">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                name="session-date"
                value={date}
                max={todayAtOpen}
                onChange={(event) => updateText(setDate, event.target.value)}
              />
            </label>
          </div>
        </Section>

        {sessionType === 'max' ? (
          <Section eyebrow="True max" title="Max test">
            {maxTestSaved ? (
              <>
                <div className="summary-bar">
                  <div className="chip-row">
                    <StatusPill
                      label={`${maxReps} reps`}
                      tone={getQualityTone(qualityFlag)}
                    />
                    {formatQualityFlag(qualityFlag) ? (
                      <StatusPill
                        label={formatQualityFlag(qualityFlag)!}
                        tone={getQualityTone(qualityFlag)}
                      />
                    ) : null}
                    {failurePoint ? (
                      <StatusPill label={failurePoint} tone="accent" />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    onClick={() => {
                      markInteracted()
                      setMaxTestSaved(false)
                    }}
                  >
                    Edit max
                  </button>
                </div>
                <RestTimer
                  key={`max-rest-${maxRestAutoStartKey}`}
                  autoStartKey={maxRestAutoStartKey}
                  defaultRestSeconds={DEFAULT_MAX_TO_BLOCK_REST_SECONDS}
                  label="Rest before pull-up block"
                  onInteract={markInteracted}
                  soundSettings={timerSoundSettings}
                  storageKey={`rest:max:${date}`}
                />
              </>
            ) : (
              <>
                <label className="field field--max">
                  <span>True max reps</span>
                  <input
                    name="max-reps"
                    autoComplete="off"
                    inputMode="numeric"
                    placeholder="0"
                    value={maxReps}
                    onChange={(event) => {
                      updateMaxTest()
                      setMaxReps(event.target.value)
                    }}
                  />
                </label>

                <AccordionSection
                  eyebrow="Optional"
                  title="Max test detail"
                  isOpen={showMaxDetail}
                  onToggle={() => setShowMaxDetail((current) => !current)}
                  summary="Details"
                >
                  <div className="field-grid field-grid--compact">
                    <label className="field">
                      <span>Failure point</span>
                      <select
                        value={failurePoint}
                        onChange={(event) => {
                          updateMaxTest()
                          setFailurePoint(
                            event.target.value as FailurePoint | '',
                          )
                        }}
                      >
                        <option value="">Optional</option>
                        {FAILURE_POINTS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Set quality</span>
                      <select
                        value={qualityFlag}
                        onChange={(event) => {
                          updateMaxTest()
                          setQualityFlag(event.target.value as QualityFlag | '')
                        }}
                      >
                        <option value="">Optional</option>
                        {QUALITY_FLAGS.map((item) => (
                          <option key={item} value={item}>
                            {QUALITY_FLAG_LABELS[item]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    <span>Video link</span>
                    <input
                      type="url"
                      name="max-video-url"
                      autoComplete="off"
                      spellCheck={false}
                      inputMode="url"
                      placeholder="https://example.com/attempt..."
                      value={videoLink}
                      onChange={(event) => {
                        updateMaxTest()
                        setVideoLink(event.target.value)
                      }}
                    />
                  </label>
                </AccordionSection>

                <div className="action-row action-row--end">
                  <button
                    type="button"
                    className="button button--primary button--compact"
                    onClick={handleSaveMaxTest}
                  >
                    Save max
                  </button>
                </div>
              </>
            )}
          </Section>
        ) : null}

        <div ref={workoutRowsRef}>
          <Section eyebrow="Workout rows" title="Preset exercises">
            <div className="entry-list">
              {entries.length === 0 ? (
                <p className="muted-text">
                  No preset rows are available for this workout yet.
                </p>
              ) : null}

              {entries.map((entry, entryIndex) => {
                const previousEntry = entries[entryIndex - 1]
                const stopPreviousRestTimer = () => {
                  if (previousEntry) {
                    requestTimerStop(
                      `rest:${date}:${previousEntry.presetKey}:${previousEntry.localId}`,
                    )
                  }
                }

                return (
                  <div key={entry.localId} className="entry-row preset-row">
                    <div className="preset-row__copy">
                      <p className="metric-label">{entry.exerciseName}</p>
                      <strong>{entry.label}</strong>
                      <p className="preset-row__target">
                        {entry.target.summary}
                      </p>
                    </div>

                    {entry.target.mode === 'emom' ? (
                      <EmomTimer
                        entry={entry}
                        onInteract={markInteracted}
                        onStart={stopPreviousRestTimer}
                        soundSettings={timerSoundSettings}
                        timerKey={`emom:${date}:${entry.presetKey}:${entry.target.summary}`}
                      />
                    ) : null}

                    {entry.target.mode === 'hold-seconds' &&
                    typeof entry.target.entryDurationSeconds === 'number' ? (
                      <HoldTimer
                        entry={entry}
                        onStart={stopPreviousRestTimer}
                        soundSettings={timerSoundSettings}
                      />
                    ) : null}

                    {entry.target.mode === 'duration-seconds' &&
                    typeof entry.target.entryDurationSeconds === 'number' ? (
                      <DurationTimer
                        entry={entry}
                        onStart={stopPreviousRestTimer}
                        soundSettings={timerSoundSettings}
                      />
                    ) : null}

                    <div
                      className="segment-row preset-row__actions"
                      role="radiogroup"
                      aria-label={`Outcome for ${entry.label}`}
                    >
                      {(['pass', 'fail'] as const).map((outcome) => (
                        <button
                          key={outcome}
                          type="button"
                          className={`segment-row__item${entry.outcome === outcome ? ' is-active' : ''}`}
                          aria-pressed={entry.outcome === outcome}
                          onClick={() =>
                            markEntryOutcome(entry.localId, outcome)
                          }
                        >
                          {outcome}
                        </button>
                      ))}
                    </div>

                    {entryIndex < entries.length - 1 ? (
                      <RestTimer
                        key={`${entry.localId}-${restAutoStartByEntryId[entry.localId] ?? 0}`}
                        autoStartKey={
                          restAutoStartByEntryId[entry.localId] ?? 0
                        }
                        onInteract={markInteracted}
                        soundSettings={timerSoundSettings}
                        storageKey={`rest:${date}:${entry.presetKey}:${entry.localId}`}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </Section>
        </div>

        <Section eyebrow="Finish" title="Save session">
          <AccordionSection
            eyebrow="Optional"
            title="Session notes"
            isOpen={showNotes}
            onToggle={() => setShowNotes((current) => !current)}
            summary="Notes"
          >
            <label className="field">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => updateText(setNotes, event.target.value)}
              />
            </label>
          </AccordionSection>

          {formError ? <p className="form-error">{formError}</p> : null}
          <button type="submit" className="button button--primary">
            {isSaving ? 'Saving...' : 'Save workout'}
          </button>
        </Section>
      </form>
    </div>
  )
}
