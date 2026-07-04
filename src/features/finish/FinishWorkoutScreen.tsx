import { useMemo, useState } from 'react'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/appContext'
import {
  expandFinishDipPlan,
  FINISH_DIP_SET_COUNT,
  FINISH_SET_COUNT,
  getFinishTargetSummary,
} from '../../domain/finishWorkout'
import type {
  FinishExerciseId,
  FinishWorkoutSettings,
  PresetOutcome,
} from '../../domain/types'
import { todayDateString } from '../../lib/date'
import type { TimerSoundSettings } from '../../lib/timerSound'
import { PersistentWorkoutTimer } from './PersistentWorkoutTimer'
import { createDipSteps, createTimedSetSteps } from './finishTimerPlan'
import { clearFinishTimers } from './finishTimerStorage'

const EXERCISES: Array<{ id: FinishExerciseId; label: string }> = [
  { id: 'back-extension', label: 'Back extension' },
  { id: 'abs', label: 'Ab exercise' },
  { id: 'dips', label: 'Dips' },
  { id: 'squat-jumps', label: 'Squat jumps' },
]

function OutcomeButtons({
  label,
  outcome,
  onSelect,
}: {
  label: string
  outcome?: PresetOutcome
  onSelect: (outcome: PresetOutcome) => void
}) {
  return (
    <div className="segment-row finish-outcome" aria-label={`${label} result`}>
      {(['pass', 'fail'] as const).map((value) => (
        <button
          key={value}
          type="button"
          className={`segment-row__item${outcome === value ? ' is-active' : ''}`}
          onClick={() => onSelect(value)}
        >
          {value}
        </button>
      ))}
    </div>
  )
}

export function FinishWorkoutScreen() {
  const {
    data,
    finishWorkoutDraft,
    saveFinishWorkout,
    saveFinishWorkoutDraft,
    saveFinishWorkoutSettings,
  } = useAppState()
  const today = todayDateString()
  const finishWorkout = data.finishWorkout
  const [outcomes, setOutcomes] = useState<
    Partial<Record<FinishExerciseId, PresetOutcome>>
  >(() =>
    finishWorkoutDraft?.date === today ? finishWorkoutDraft.outcomes : {},
  )
  const [settings, setSettings] = useState<FinishWorkoutSettings>(
    finishWorkout.settings,
  )
  const [saving, setSaving] = useState(false)
  const [restStartedFor, setRestStartedFor] = useState<
    Partial<Record<FinishExerciseId, number>>
  >({})
  const soundSettings = useMemo<TimerSoundSettings>(
    () => ({
      soundId: data.settings.timerSoundId,
      volume: data.settings.timerVolume,
    }),
    [data.settings.timerSoundId, data.settings.timerVolume],
  )
  const dipPlan = useMemo(
    () => expandFinishDipPlan(finishWorkout.progression),
    [finishWorkout.progression],
  )
  const latestSession = finishWorkout.sessions.at(-1)

  async function recordOutcome(
    exerciseId: FinishExerciseId,
    outcome: PresetOutcome,
  ) {
    const nextOutcomes = { ...outcomes, [exerciseId]: outcome }
    setOutcomes(nextOutcomes)
    await saveFinishWorkoutDraft({
      id: 'current-finish-workout',
      date: today,
      outcomes: nextOutcomes,
      updatedAt: new Date().toISOString(),
    })

    if (exerciseId !== 'squat-jumps') {
      setRestStartedFor((current) => ({
        ...current,
        [exerciseId]: (current[exerciseId] ?? 0) + 1,
      }))
    }
  }

  async function updateSettings(updates: Partial<FinishWorkoutSettings>) {
    const next = { ...settings, ...updates }
    setSettings(next)
    await saveFinishWorkoutSettings(next)
  }

  function normalizeRestSeconds(value: number, fallback: number) {
    return Math.min(1800, Math.max(15, Math.round(value || fallback)))
  }

  async function handleSave() {
    if (!EXERCISES.every(({ id }) => outcomes[id])) {
      return
    }

    setSaving(true)
    const saved = await saveFinishWorkout({
      date: today,
      outcomes: outcomes as Record<FinishExerciseId, PresetOutcome>,
    })
    setSaving(false)

    if (saved) {
      setOutcomes({})
      setRestStartedFor({})
      clearFinishTimers()
    }
  }

  return (
    <div className="screen-stack finish-workout">
      <Section
        title="Finish"
        eyebrow="Optional full-body"
        action={
          latestSession ? (
            <StatusPill tone="neutral" label={`Last ${latestSession.date}`} />
          ) : undefined
        }
      >
        <div className="finish-settings">
          <label className="field">
            <span>Rest between exercises (seconds)</span>
            <input
              type="number"
              min="15"
              max="1800"
              value={settings.betweenExerciseRestSeconds}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  betweenExerciseRestSeconds: Number(event.target.value),
                }))
              }
              onBlur={() =>
                void updateSettings({
                  betweenExerciseRestSeconds: normalizeRestSeconds(
                    settings.betweenExerciseRestSeconds,
                    120,
                  ),
                })
              }
            />
          </label>
        </div>
      </Section>

      {EXERCISES.map(({ id, label }, index) => {
        const exerciseLabel = label
        const outcome = outcomes[id]
        const target = getFinishTargetSummary(id, {
          ...finishWorkout,
          settings,
        })
        const timerSteps =
          id === 'back-extension'
            ? createTimedSetSteps(
                exerciseLabel,
                finishWorkout.progression.backExtensionSeconds,
                settings.backExtensionRestSeconds,
              )
            : id === 'abs'
              ? createTimedSetSteps(
                  exerciseLabel,
                  finishWorkout.progression.absSeconds,
                  settings.absRestSeconds,
                )
              : id === 'dips'
                ? createDipSteps(dipPlan)
                : null

        return (
          <Section
            key={id}
            className={
              outcome ? 'finish-exercise is-complete' : 'finish-exercise'
            }
            title={`${index + 1}. ${exerciseLabel}`}
            eyebrow={target}
            action={
              outcome ? (
                <StatusPill
                  tone={outcome === 'pass' ? 'success' : 'danger'}
                  label={outcome}
                />
              ) : undefined
            }
          >
            {id === 'back-extension' || id === 'abs' ? (
              <label className="field finish-rest-field">
                <span>Rest between sets (seconds)</span>
                <input
                  type="number"
                  min="15"
                  max="1800"
                  value={
                    id === 'back-extension'
                      ? settings.backExtensionRestSeconds
                      : settings.absRestSeconds
                  }
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    setSettings((current) => ({
                      ...current,
                      [id === 'back-extension'
                        ? 'backExtensionRestSeconds'
                        : 'absRestSeconds']: value,
                    }))
                  }}
                  onBlur={() => {
                    const key =
                      id === 'back-extension'
                        ? 'backExtensionRestSeconds'
                        : 'absRestSeconds'
                    void updateSettings({
                      [key]: normalizeRestSeconds(settings[key], 105),
                    })
                  }}
                />
              </label>
            ) : null}

            {timerSteps ? (
              <PersistentWorkoutTimer
                label={id === 'dips' ? 'Dip EMOM' : exerciseLabel}
                soundSettings={soundSettings}
                storageKey={`${today}:${id}`}
                steps={timerSteps}
                totalSets={
                  id === 'dips' ? FINISH_DIP_SET_COUNT : FINISH_SET_COUNT
                }
              />
            ) : (
              <div className="finish-rep-target">
                <strong>{finishWorkout.progression.squatJumpReps}</strong>
                <span>reps</span>
              </div>
            )}

            <OutcomeButtons
              label={exerciseLabel}
              outcome={outcome}
              onSelect={(value) => void recordOutcome(id, value)}
            />

            {id !== 'squat-jumps' && outcome ? (
              <PersistentWorkoutTimer
                key={`${id}-${restStartedFor[id] ?? 0}`}
                autoStart
                label="Next exercise"
                soundSettings={soundSettings}
                storageKey={`${today}:transition:${id}`}
                steps={[
                  {
                    phase: 'rest',
                    seconds: settings.betweenExerciseRestSeconds,
                    instruction: `Next: ${EXERCISES[index + 1]?.label ?? ''}`,
                  },
                ]}
              />
            ) : null}
          </Section>
        )
      })}

      <button
        type="button"
        className="button button--primary finish-save"
        disabled={saving || !EXERCISES.every(({ id }) => outcomes[id])}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving...' : 'Save Finish workout'}
      </button>
    </div>
  )
}
