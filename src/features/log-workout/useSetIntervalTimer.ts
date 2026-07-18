import { useEffect, useState } from 'react'
import { playTone, type TimerSoundSettings } from '../../lib/timerSound'
import { useScreenWakeLock } from '../../lib/useScreenWakeLock'

export type SetTimerPhase = 'ready' | 'prep' | 'work' | 'rest' | 'complete'

interface SetTimerState {
  currentSet: number
  isRunning: boolean
  phase: SetTimerPhase
  previousPhase: SetTimerPhase | null
  restSeconds: number
  secondsRemaining: number
}

const COUNTDOWN_BEEP_SECONDS = 5
const ENDING_BEEP_SECONDS = 3

export function useSetIntervalTimer({
  onStart,
  prepBetweenSets,
  prepSeconds,
  restSeconds,
  setCount,
  soundSettings,
  workSeconds,
}: {
  onStart?: () => void
  prepBetweenSets: boolean
  prepSeconds: number
  restSeconds: number
  setCount: number
  soundSettings: TimerSoundSettings
  workSeconds: number
}) {
  const [timer, setTimer] = useState<SetTimerState>(() => ({
    currentSet: 1,
    isRunning: false,
    phase: 'ready',
    previousPhase: null,
    restSeconds,
    secondsRemaining: workSeconds,
  }))
  useScreenWakeLock(timer.isRunning)

  useEffect(() => {
    if (!timer.isRunning) return

    if (
      timer.phase === 'prep' &&
      timer.secondsRemaining > 0 &&
      timer.secondsRemaining <= COUNTDOWN_BEEP_SECONDS
    ) {
      playTone(soundSettings, 'countdown')
      return
    }

    if (
      (timer.phase === 'work' || timer.phase === 'rest') &&
      timer.secondsRemaining > 0 &&
      timer.secondsRemaining <= ENDING_BEEP_SECONDS
    ) {
      playTone(soundSettings, 'ending')
    }
  }, [soundSettings, timer.isRunning, timer.phase, timer.secondsRemaining])

  useEffect(() => {
    if (!timer.previousPhase || timer.previousPhase === timer.phase) return

    playTone(soundSettings, timer.phase === 'complete' ? 'complete' : 'alarm')
  }, [soundSettings, timer.phase, timer.previousPhase])

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
        if (!current.isRunning) return current

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
            phase: prepBetweenSets ? 'prep' : 'work',
            previousPhase: 'rest',
            secondsRemaining: prepBetweenSets ? prepSeconds : workSeconds,
          }
        }

        return current
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [
    prepBetweenSets,
    prepSeconds,
    setCount,
    timer.isRunning,
    timer.phase,
    workSeconds,
  ])

  function start() {
    onStart?.()
    setTimer((current) => ({
      ...current,
      currentSet: current.phase === 'complete' ? 1 : current.currentSet,
      isRunning: true,
      phase: current.phase === 'rest' ? 'rest' : 'prep',
      previousPhase: current.phase,
      secondsRemaining:
        current.phase === 'ready' || current.phase === 'complete'
          ? prepSeconds
          : current.secondsRemaining,
    }))
  }

  function pause() {
    setTimer((current) => ({ ...current, isRunning: false }))
  }

  function reset() {
    setTimer((current) => ({
      currentSet: 1,
      isRunning: false,
      phase: 'ready',
      previousPhase: null,
      restSeconds: current.restSeconds,
      secondsRemaining: workSeconds,
    }))
  }

  function updateRestMinutes(value: string) {
    const minutes = Number(value)
    if (!Number.isFinite(minutes) || minutes <= 0) return

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

  return { pause, reset, start, timer, updateRestMinutes }
}
