import {
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
import { todayDateString } from '../../lib/date'
import { createId } from '../../lib/id'
import { playTone, type TimerSoundSettings } from '../../lib/timerSound'
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'

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
const EMOM_REST_SECONDS = 60
const COUNTDOWN_BEEP_SECONDS = 5
const ENDING_BEEP_SECONDS = 3

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

function getEmomRoundReps(entry: WorkoutLogEntryDraft) {
  return entry.target.emomSegments?.[0]?.reps ?? entry.target.entryReps ?? 0
}

function getEmomRoundCount(entry: WorkoutLogEntryDraft) {
  return (
    entry.target.emomMinutes ??
    entry.target.emomSegments?.reduce(
      (sum, segment) => sum + segment.sets,
      0,
    ) ??
    entry.target.entrySets
  )
}

function getEmomWorkSeconds(reps: number) {
  return 15 + Math.max(0, reps - 3) * 5
}

function useTimerBeeps({
  isRunning,
  phase,
  previousPhase,
  secondsRemaining,
  soundSettings,
}: {
  isRunning: boolean
  phase: TimerPhase
  previousPhase: TimerPhase | null
  secondsRemaining: number
  soundSettings: TimerSoundSettings
}) {
  useEffect(() => {
    if (!isRunning) {
      return
    }

    if (
      phase === 'prep' &&
      secondsRemaining > 0 &&
      secondsRemaining <= COUNTDOWN_BEEP_SECONDS
    ) {
      playTone(soundSettings, 'countdown')
      return
    }

    if (
      (phase === 'work' || phase === 'rest') &&
      secondsRemaining > 0 &&
      secondsRemaining <= ENDING_BEEP_SECONDS
    ) {
      playTone(soundSettings, 'ending')
    }
  }, [isRunning, phase, secondsRemaining, soundSettings])

  useEffect(() => {
    if (!previousPhase || previousPhase === phase) {
      return
    }

    if (phase === 'work' || phase === 'rest' || phase === 'complete') {
      playTone(soundSettings, 'alarm')
    }
  }, [phase, previousPhase, soundSettings])
}

function EmomTimer({
  entry,
  soundSettings,
}: {
  entry: WorkoutLogEntryDraft
  soundSettings: TimerSoundSettings
}) {
  const roundReps = getEmomRoundReps(entry)
  const roundCount = getEmomRoundCount(entry)
  const workSeconds = getEmomWorkSeconds(roundReps)
  const [timer, setTimer] = useState(() => ({
    currentRound: 1,
    isRunning: false,
    phase: 'ready' as TimerPhase,
    previousPhase: null as TimerPhase | null,
    secondsRemaining: workSeconds,
  }))

  useTimerBeeps({
    isRunning: timer.isRunning,
    phase: timer.phase,
    previousPhase: timer.previousPhase,
    secondsRemaining: timer.secondsRemaining,
    soundSettings,
  })

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
        if (!current.isRunning) {
          return current
        }

        if (current.secondsRemaining > 1) {
          return {
            ...current,
            secondsRemaining: current.secondsRemaining - 1,
          }
        }

        if (current.phase === 'prep') {
          return {
            ...current,
            phase: 'work',
            previousPhase: 'prep',
            secondsRemaining: workSeconds,
          }
        }

        if (current.phase === 'work') {
          if (current.currentRound >= roundCount) {
            return {
              ...current,
              isRunning: false,
              phase: 'complete',
              previousPhase: 'work',
              secondsRemaining: 0,
            }
          }

          return {
            ...current,
            phase: 'rest',
            previousPhase: 'work',
            secondsRemaining: EMOM_REST_SECONDS,
          }
        }

        if (current.phase === 'rest') {
          return {
            ...current,
            currentRound: current.currentRound + 1,
            phase: 'prep',
            previousPhase: 'rest',
            secondsRemaining: PREP_SECONDS,
          }
        }

        return current
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [roundCount, timer.isRunning, timer.phase, workSeconds])

  function startTimer() {
    setTimer((current) => ({
      currentRound: current.phase === 'complete' ? 1 : current.currentRound,
      isRunning: true,
      phase: current.phase === 'rest' ? 'rest' : 'prep',
      previousPhase: current.phase,
      secondsRemaining:
        current.phase === 'ready' || current.phase === 'complete'
          ? PREP_SECONDS
          : current.secondsRemaining,
    }))
  }

  function resetTimer() {
    setTimer({
      currentRound: 1,
      isRunning: false,
      phase: 'ready',
      previousPhase: null,
      secondsRemaining: workSeconds,
    })
  }

  const phaseLabel =
    timer.phase === 'complete'
      ? 'Block complete'
      : timer.phase === 'prep'
        ? 'Get to the bar'
        : timer.phase === 'rest'
          ? 'Rest before next round'
          : timer.phase === 'work'
            ? 'Do pull-ups'
            : 'Ready'

  return (
    <div className="timer-panel">
      <div>
        <p className="metric-label">Pull-up block timer</p>
        <strong>{phaseLabel}</strong>
        <p className="muted-text">
          {PREP_SECONDS}s prep - {roundCount} rounds - {roundReps} reps - work{' '}
          {workSeconds}s - rest {EMOM_REST_SECONDS}s
        </p>
      </div>

      <div className="timer-panel__readout">
        <span>{formatTimer(timer.secondsRemaining)}</span>
        <small>
          Round {Math.min(timer.currentRound, roundCount)} / {roundCount}
        </small>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button button--primary button--compact"
          onClick={
            timer.isRunning
              ? () =>
                  setTimer((current) => ({
                    ...current,
                    isRunning: false,
                  }))
              : startTimer
          }
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
  soundSettings,
}: {
  entry: WorkoutLogEntryDraft
  soundSettings: TimerSoundSettings
}) {
  const holdSeconds = entry.target.entryDurationSeconds ?? 0
  const setCount = entry.target.entrySets
  const [timer, setTimer] = useState(() => ({
    currentSet: 1,
    isRunning: false,
    phase: 'ready' as TimerPhase,
    previousPhase: null as TimerPhase | null,
    restSeconds: DEFAULT_HOLD_REST_SECONDS,
    secondsRemaining: holdSeconds,
  }))

  useTimerBeeps({
    isRunning: timer.isRunning,
    phase: timer.phase,
    previousPhase: timer.previousPhase,
    secondsRemaining: timer.secondsRemaining,
    soundSettings,
  })

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
        if (!current.isRunning) {
          return current
        }

        if (current.secondsRemaining > 1) {
          return {
            ...current,
            secondsRemaining: current.secondsRemaining - 1,
          }
        }

        if (current.phase === 'prep') {
          return {
            ...current,
            phase: 'work',
            previousPhase: 'prep',
            secondsRemaining: holdSeconds,
          }
        }

        if (current.phase === 'work') {
          if (current.currentSet >= setCount) {
            return {
              ...current,
              isRunning: false,
              phase: 'complete',
              previousPhase: 'work',
              secondsRemaining: 0,
            }
          }

          return {
            ...current,
            phase: 'rest',
            previousPhase: 'work',
            secondsRemaining: current.restSeconds,
          }
        }

        if (current.phase === 'rest') {
          return {
            ...current,
            currentSet: current.currentSet + 1,
            phase: 'prep',
            previousPhase: 'rest',
            secondsRemaining: PREP_SECONDS,
          }
        }

        return current
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [holdSeconds, setCount, timer.isRunning, timer.phase])

  function startTimer() {
    setTimer((current) => ({
      ...current,
      currentSet: current.phase === 'complete' ? 1 : current.currentSet,
      isRunning: true,
      phase: current.phase === 'rest' ? 'rest' : 'prep',
      previousPhase: current.phase,
      secondsRemaining:
        current.phase === 'ready' || current.phase === 'complete'
          ? PREP_SECONDS
          : current.secondsRemaining,
    }))
  }

  function updateRestMinutes(value: string) {
    const minutes = Number(value)

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return
    }

    const nextRestSeconds = Math.round(minutes * 60)
    setTimer((current) => ({
      ...current,
      restSeconds: nextRestSeconds,
      secondsRemaining:
        current.phase === 'rest' && !current.isRunning
          ? nextRestSeconds
          : current.secondsRemaining,
    }))
  }

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
          {PREP_SECONDS}s prep - {setCount} holds - {holdSeconds}s work - rest{' '}
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
          onClick={
            timer.isRunning
              ? () =>
                  setTimer((current) => ({
                    ...current,
                    isRunning: false,
                  }))
              : startTimer
          }
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
          onClick={() =>
            setTimer({
              currentSet: 1,
              isRunning: false,
              phase: 'ready',
              previousPhase: null,
              restSeconds: timer.restSeconds,
              secondsRemaining: holdSeconds,
            })
          }
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function DurationTimer({
  entry,
  soundSettings,
}: {
  entry: WorkoutLogEntryDraft
  soundSettings: TimerSoundSettings
}) {
  const workSeconds = entry.target.entryDurationSeconds ?? 0
  const setCount = entry.target.entrySets
  const [timer, setTimer] = useState(() => ({
    currentSet: 1,
    isRunning: false,
    phase: 'ready' as TimerPhase,
    previousPhase: null as TimerPhase | null,
    restSeconds: DEFAULT_HOLD_REST_SECONDS,
    secondsRemaining: workSeconds,
  }))

  useTimerBeeps({
    isRunning: timer.isRunning,
    phase: timer.phase,
    previousPhase: timer.previousPhase,
    secondsRemaining: timer.secondsRemaining,
    soundSettings,
  })

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
        if (!current.isRunning) {
          return current
        }

        if (current.secondsRemaining > 1) {
          return {
            ...current,
            secondsRemaining: current.secondsRemaining - 1,
          }
        }

        if (current.phase === 'prep') {
          return {
            ...current,
            phase: 'work',
            previousPhase: 'prep',
            secondsRemaining: workSeconds,
          }
        }

        if (current.phase === 'work') {
          if (current.currentSet >= setCount) {
            return {
              ...current,
              isRunning: false,
              phase: 'complete',
              previousPhase: 'work',
              secondsRemaining: 0,
            }
          }

          return {
            ...current,
            phase: 'rest',
            previousPhase: 'work',
            secondsRemaining: current.restSeconds,
          }
        }

        if (current.phase === 'rest') {
          return {
            ...current,
            currentSet: current.currentSet + 1,
            phase: 'prep',
            previousPhase: 'rest',
            secondsRemaining: PREP_SECONDS,
          }
        }

        return current
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [setCount, timer.isRunning, timer.phase, workSeconds])

  function startTimer() {
    setTimer((current) => ({
      ...current,
      currentSet: current.phase === 'complete' ? 1 : current.currentSet,
      isRunning: true,
      phase: current.phase === 'rest' ? 'rest' : 'prep',
      previousPhase: current.phase,
      secondsRemaining:
        current.phase === 'ready' || current.phase === 'complete'
          ? PREP_SECONDS
          : current.secondsRemaining,
    }))
  }

  function updateRestMinutes(value: string) {
    const minutes = Number(value)

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return
    }

    const nextRestSeconds = Math.round(minutes * 60)
    setTimer((current) => ({
      ...current,
      restSeconds: nextRestSeconds,
      secondsRemaining:
        current.phase === 'rest' && !current.isRunning
          ? nextRestSeconds
          : current.secondsRemaining,
    }))
  }

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
          onClick={
            timer.isRunning
              ? () =>
                  setTimer((current) => ({
                    ...current,
                    isRunning: false,
                  }))
              : startTimer
          }
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
          onClick={() =>
            setTimer({
              currentSet: 1,
              isRunning: false,
              phase: 'ready',
              previousPhase: null,
              restSeconds: timer.restSeconds,
              secondsRemaining: workSeconds,
            })
          }
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function RestTimer({
  autoStartKey = 0,
  soundSettings,
}: {
  autoStartKey?: number
  soundSettings: TimerSoundSettings
}) {
  const hasRunRef = useRef(autoStartKey > 0)
  const [timer, setTimer] = useState(() => ({
    isRunning: autoStartKey > 0,
    restSeconds: DEFAULT_EXERCISE_REST_SECONDS,
    secondsRemaining: DEFAULT_EXERCISE_REST_SECONDS,
  }))

  useEffect(() => {
    if (
      timer.isRunning &&
      timer.secondsRemaining > 0 &&
      timer.secondsRemaining <= ENDING_BEEP_SECONDS
    ) {
      playTone(soundSettings, 'ending')
    }

    if (hasRunRef.current && !timer.isRunning && timer.secondsRemaining === 0) {
      playTone(soundSettings, 'alarm')
    }
  }, [soundSettings, timer.isRunning, timer.secondsRemaining])

  useEffect(() => {
    if (!timer.isRunning) {
      return
    }

    const intervalId = window.setInterval(() => {
      setTimer((current) => {
        if (!current.isRunning) {
          return current
        }

        if (current.secondsRemaining <= 1) {
          return {
            ...current,
            isRunning: false,
            secondsRemaining: 0,
          }
        }

        return {
          ...current,
          secondsRemaining: current.secondsRemaining - 1,
        }
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [timer.isRunning])

  function updateRestMinutes(value: string) {
    const minutes = Number(value)

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return
    }

    const nextRestSeconds = Math.round(minutes * 60)
    setTimer((current) => ({
      isRunning: current.isRunning,
      restSeconds: nextRestSeconds,
      secondsRemaining: current.isRunning
        ? current.secondsRemaining
        : nextRestSeconds,
    }))
  }

  return (
    <div className="timer-panel timer-panel--rest">
      <div>
        <p className="metric-label">Rest before next exercise</p>
        <strong>{formatTimer(timer.secondsRemaining)}</strong>
        <p className="muted-text">
          Start with 5 minutes. Adjust it if you need more time to stay fresh.
        </p>
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
            hasRunRef.current = true
            setTimer((current) => ({
              ...current,
              isRunning: !current.isRunning,
            }))
          }}
        >
          {timer.isRunning ? 'Pause rest' : 'Start rest'}
        </button>
        <button
          type="button"
          className="button button--ghost button--compact"
          onClick={() => {
            setTimer((current) => ({
              ...current,
              isRunning: false,
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
  const initialSessionType = workoutDraft?.sessionType ?? initialType
  const initialSupportFocus = normalizeSupportWorkoutFocus(
    workoutDraft?.supportFocus ?? data.recommendationState.defaultSupportFocus,
  )
  const [sessionType, setSessionType] =
    useState<SessionType>(initialSessionType)
  const [supportFocus, setSupportFocus] =
    useState<SupportWorkoutFocus>(initialSupportFocus)
  const [date, setDate] = useState(
    () => workoutDraft?.date ?? todayDateString(),
  )
  const [maxReps, setMaxReps] = useState(workoutDraft?.maxReps ?? '')
  const [videoLink, setVideoLink] = useState(workoutDraft?.videoLink ?? '')
  const [failurePoint, setFailurePoint] = useState<FailurePoint | ''>(
    workoutDraft?.failurePoint ?? '',
  )
  const [qualityFlag, setQualityFlag] = useState<QualityFlag | ''>(
    workoutDraft?.qualityFlag ?? '',
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

          <div className="inline-note">
            <p className="muted-text">
              Mark each set or row as you finish it. Changes save immediately as
              an in-progress draft on this device; Save workout still commits
              the session to History.
            </p>
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
                onChange={(event) => updateText(setDate, event.target.value)}
              />
            </label>
          </div>
        </Section>

        {sessionType === 'max' ? (
          <Section eyebrow="True max" title="Max test">
            <label className="field field--max">
              <span>True max reps</span>
              <input
                name="max-reps"
                autoComplete="off"
                inputMode="numeric"
                placeholder="0"
                value={maxReps}
                onChange={(event) => updateText(setMaxReps, event.target.value)}
              />
            </label>

            <AccordionSection
              eyebrow="Optional"
              title="Max test detail"
              isOpen={showMaxDetail}
              onToggle={() => setShowMaxDetail((current) => !current)}
              summary="Failure point, set quality, and video link"
            >
              <div className="field-grid field-grid--compact">
                <label className="field">
                  <span>Failure point</span>
                  <select
                    value={failurePoint}
                    onChange={(event) => {
                      markInteracted()
                      setFailurePoint(event.target.value as FailurePoint | '')
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
                      markInteracted()
                      setQualityFlag(event.target.value as QualityFlag | '')
                    }}
                  >
                    <option value="">Optional</option>
                    {QUALITY_FLAGS.map((item) => (
                      <option key={item} value={item}>
                        {item}
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
                  onChange={(event) =>
                    updateText(setVideoLink, event.target.value)
                  }
                />
              </label>
            </AccordionSection>
          </Section>
        ) : null}

        <Section eyebrow="Workout rows" title="Preset exercises">
          <div className="summary-bar">
            <p className="muted-text">
              Treat each row as today&apos;s prescription. Tap Pass or Fail as
              soon as that work is done.
            </p>
          </div>

          <div className="entry-list">
            {entries.length === 0 ? (
              <p className="muted-text">
                No preset rows are available for this workout yet.
              </p>
            ) : null}

            {entries.map((entry) => (
              <div key={entry.localId} className="entry-row preset-row">
                <div className="preset-row__copy">
                  <p className="metric-label">{entry.exerciseName}</p>
                  <strong>{entry.label}</strong>
                  <p className="preset-row__target">{entry.target.summary}</p>
                  {entry.notes ? (
                    <p className="muted-text preset-row__note">{entry.notes}</p>
                  ) : null}
                </div>

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
                      onClick={() => markEntryOutcome(entry.localId, outcome)}
                    >
                      {outcome}
                    </button>
                  ))}
                </div>

                {entry.target.mode === 'emom' ? (
                  <EmomTimer entry={entry} soundSettings={timerSoundSettings} />
                ) : null}

                {entry.target.mode === 'hold-seconds' &&
                typeof entry.target.entryDurationSeconds === 'number' ? (
                  <HoldTimer entry={entry} soundSettings={timerSoundSettings} />
                ) : null}

                {entry.target.mode === 'duration-seconds' &&
                typeof entry.target.entryDurationSeconds === 'number' ? (
                  <DurationTimer
                    entry={entry}
                    soundSettings={timerSoundSettings}
                  />
                ) : null}

                <RestTimer
                  key={`${entry.localId}-${restAutoStartByEntryId[entry.localId] ?? 0}`}
                  autoStartKey={restAutoStartByEntryId[entry.localId] ?? 0}
                  soundSettings={timerSoundSettings}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow="Finish" title="Save session">
          <AccordionSection
            eyebrow="Optional"
            title="Session notes"
            isOpen={showNotes}
            onToggle={() => setShowNotes((current) => !current)}
            summary="Add any extra notes for this workout"
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
