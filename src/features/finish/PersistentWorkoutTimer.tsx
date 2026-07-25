import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playTone, type TimerSoundSettings } from '../../lib/timerSound'
import type { WorkoutTimerStep } from './finishTimerPlan'
import { FINISH_TIMER_STORAGE_PREFIX } from './finishTimerStorage'
import { useScreenWakeLock } from '../../lib/useScreenWakeLock'
import {
  requestExclusiveTimerStart,
  subscribeToTimerStop,
} from '../../lib/timerEvents'

interface StoredTimer {
  isRunning: boolean
  lastUpdatedAt: number | null
  previousPhase: WorkoutTimerStep['phase'] | 'ready' | 'complete' | null
  secondsRemaining: number
  signature: string
  stepIndex: number
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`
}

function readTimer(key: string): StoredTimer | null {
  try {
    const value = window.localStorage.getItem(
      `${FINISH_TIMER_STORAGE_PREFIX}:${key}`,
    )
    return value ? (JSON.parse(value) as StoredTimer) : null
  } catch {
    return null
  }
}

function writeTimer(key: string, timer: StoredTimer) {
  try {
    window.localStorage.setItem(
      `${FINISH_TIMER_STORAGE_PREFIX}:${key}`,
      JSON.stringify(timer),
    )
  } catch {
    // The timer remains usable when localStorage is unavailable.
  }
}

export function PersistentWorkoutTimer({
  autoStart = false,
  exclusiveGroupId,
  label,
  onStart,
  soundSettings,
  storageKey,
  steps,
  totalSets,
}: {
  autoStart?: boolean
  exclusiveGroupId?: string
  label: string
  onStart?: () => void
  soundSettings: TimerSoundSettings
  storageKey: string
  steps: WorkoutTimerStep[]
  totalSets?: number
}) {
  const signature = useMemo(
    () =>
      JSON.stringify(
        steps.map(({ phase, seconds, instruction }) => [
          phase,
          seconds,
          instruction,
        ]),
      ),
    [steps],
  )
  const initialTimer = useMemo<StoredTimer>(
    () => ({
      isRunning: false,
      lastUpdatedAt: null,
      previousPhase: null,
      secondsRemaining: steps[0]?.seconds ?? 0,
      signature,
      stepIndex: -1,
    }),
    [signature, steps],
  )
  const storedTimer = useMemo(() => readTimer(storageKey), [storageKey])

  const advanceTimer = useCallback(
    (current: StoredTimer, elapsedSeconds: number, now: number) => {
      let next = { ...current }
      let elapsed = Math.max(0, elapsedSeconds)

      while (elapsed > 0 && next.isRunning) {
        if (next.secondsRemaining > elapsed) {
          next.secondsRemaining -= elapsed
          elapsed = 0
          break
        }

        elapsed -= next.secondsRemaining
        const previousPhase = steps[next.stepIndex]?.phase ?? 'ready'
        const nextIndex = next.stepIndex + 1

        if (nextIndex >= steps.length) {
          next = {
            ...next,
            isRunning: false,
            lastUpdatedAt: null,
            previousPhase,
            secondsRemaining: 0,
            stepIndex: steps.length,
          }
          break
        }

        const nextStep = steps[nextIndex]
        if (!nextStep) {
          break
        }

        next = {
          ...next,
          previousPhase,
          secondsRemaining: nextStep.seconds,
          stepIndex: nextIndex,
        }
      }

      return {
        ...next,
        lastUpdatedAt: next.isRunning ? now : null,
      }
    },
    [steps],
  )

  const [timer, setTimer] = useState(() => {
    if (storedTimer?.signature === signature) {
      const now = Date.now()
      const elapsed =
        storedTimer.isRunning && storedTimer.lastUpdatedAt
          ? Math.floor((now - storedTimer.lastUpdatedAt) / 1000)
          : 0
      return advanceTimer(storedTimer, elapsed, now)
    }

    if (autoStart && steps[0]) {
      return {
        ...initialTimer,
        isRunning: true,
        lastUpdatedAt: Date.now(),
        secondsRemaining: steps[0].seconds,
        stepIndex: 0,
      }
    }

    return initialTimer
  })
  const lastBeepRef = useRef('')
  const playAutoStartCueRef = useRef(
    autoStart && !storedTimer && timer.isRunning,
  )
  const announceRunningTimerRef = useRef(timer.isRunning)
  const currentStep = steps[timer.stepIndex]
  const isComplete = timer.stepIndex >= steps.length
  const phase = isComplete ? 'complete' : (currentStep?.phase ?? 'ready')
  useScreenWakeLock(timer.isRunning)

  useEffect(() => {
    return subscribeToTimerStop(
      storageKey,
      () => {
        setTimer((current) => ({
          ...current,
          isRunning: false,
          lastUpdatedAt: null,
        }))
      },
      exclusiveGroupId,
    )
  }, [exclusiveGroupId, storageKey])

  const startTimer = useCallback(
    (playStartCue: boolean) => {
      onStart?.()

      if (exclusiveGroupId) {
        requestExclusiveTimerStart(exclusiveGroupId, storageKey)
      }

      if (playStartCue) {
        playTone(soundSettings, 'start')
      }

      setTimer((current) => {
        const restart = current.stepIndex >= steps.length
        const stepIndex =
          current.stepIndex < 0 || restart ? 0 : current.stepIndex
        return {
          ...current,
          isRunning: true,
          lastUpdatedAt: Date.now(),
          previousPhase: restart ? 'complete' : current.previousPhase,
          secondsRemaining:
            current.stepIndex < 0 || restart
              ? (steps[stepIndex]?.seconds ?? 0)
              : current.secondsRemaining,
          stepIndex,
        }
      })
    },
    [exclusiveGroupId, onStart, soundSettings, steps, storageKey],
  )

  useEffect(() => {
    writeTimer(storageKey, timer)
  }, [storageKey, timer])

  useEffect(() => {
    if (announceRunningTimerRef.current && exclusiveGroupId) {
      announceRunningTimerRef.current = false
      requestExclusiveTimerStart(exclusiveGroupId, storageKey)
    }
  }, [exclusiveGroupId, storageKey])

  useEffect(() => {
    if (playAutoStartCueRef.current) {
      playAutoStartCueRef.current = false
      playTone(soundSettings, 'start')
    }
  }, [soundSettings])

  useEffect(() => {
    if (!timer.isRunning) {
      return
    }

    const intervalId = window.setInterval(() => {
      setTimer((current) => {
        const now = Date.now()
        const elapsed = current.lastUpdatedAt
          ? Math.floor((now - current.lastUpdatedAt) / 1000)
          : 0
        return elapsed > 0 ? advanceTimer(current, elapsed, now) : current
      })
    }, 500)

    return () => window.clearInterval(intervalId)
  }, [advanceTimer, timer.isRunning])

  useEffect(() => {
    if (!timer.isRunning || !currentStep || timer.secondsRemaining <= 0) {
      return
    }

    const warningWindow = currentStep.phase === 'work' ? 3 : 5
    if (timer.secondsRemaining > warningWindow) {
      return
    }

    const beepKey = `${timer.stepIndex}:${timer.secondsRemaining}`
    if (lastBeepRef.current === beepKey) {
      return
    }

    lastBeepRef.current = beepKey
    playTone(
      soundSettings,
      currentStep.phase === 'prep' ? 'countdown' : 'ending',
    )
  }, [
    currentStep,
    soundSettings,
    timer.isRunning,
    timer.secondsRemaining,
    timer.stepIndex,
  ])

  useEffect(() => {
    if (!timer.previousPhase || timer.previousPhase === phase) {
      return
    }

    if (phase === 'complete') {
      playTone(soundSettings, steps.length === 1 ? 'alarm' : 'complete')
      return
    }

    if (phase === 'rest' && timer.previousPhase === 'work') {
      const previousStep = steps[timer.stepIndex - 1]
      const nextStep = steps[timer.stepIndex + 1]
      const isDipPrescriptionChange =
        previousStep?.instruction.includes('dips') &&
        nextStep?.instruction.includes('dips') &&
        previousStep.instruction !== nextStep.instruction

      playTone(soundSettings, isDipPrescriptionChange ? 'rep-change' : 'alarm')
      return
    }

    playTone(soundSettings, 'alarm')
  }, [phase, soundSettings, steps, timer.previousPhase, timer.stepIndex])

  function pauseTimer() {
    setTimer((current) => ({
      ...current,
      isRunning: false,
      lastUpdatedAt: null,
    }))
  }

  function resetTimer() {
    try {
      window.localStorage.removeItem(
        `${FINISH_TIMER_STORAGE_PREFIX}:${storageKey}`,
      )
    } catch {
      // Ignore cleanup failures.
    }
    setTimer(initialTimer)
  }

  const setLabel = currentStep?.setNumber
    ? `Set ${currentStep.setNumber}${totalSets ? ` / ${totalSets}` : ''}`
    : undefined
  const phaseLabel =
    phase === 'complete'
      ? 'Complete'
      : phase === 'prep'
        ? 'Prepare'
        : phase === 'work'
          ? 'Work'
          : phase === 'rest'
            ? 'Rest'
            : 'Ready'

  return (
    <div className={`timer-panel${timer.isRunning ? ' is-active' : ''}`}>
      <div className="finish-timer__heading">
        <p className="metric-label">{label}</p>
        <strong>{phaseLabel}</strong>
      </div>
      <div className="timer-panel__readout" aria-live="polite">
        <span>{formatTimer(timer.secondsRemaining)}</span>
        <small>{setLabel ?? phaseLabel}</small>
      </div>
      <div className="timer-panel__instruction">
        <span>{phase}</span>
        <strong>
          {isComplete
            ? `${label} complete`
            : (currentStep?.instruction ?? 'Start when ready')}
        </strong>
      </div>
      <div className="button-row">
        <button
          type="button"
          className="button button--primary button--compact"
          onClick={timer.isRunning ? pauseTimer : () => startTimer(true)}
        >
          {timer.isRunning ? 'Pause' : timer.stepIndex < 0 ? 'Start' : 'Resume'}
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
