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
  FinishWorkoutProgression,
  FinishWorkoutSettings,
  PresetOutcome,
} from '../../domain/types'
import { todayDateString } from '../../lib/date'
import { requestTimerStop } from '../../lib/timerEvents'
import { playTone, type TimerSoundSettings } from '../../lib/timerSound'
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
    saveFinishWorkoutProgression,
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
  const [editingExercise, setEditingExercise] =
    useState<FinishExerciseId | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [editingSaving, setEditingSaving] = useState(false)
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

  function openExerciseEditor(exerciseId: FinishExerciseId) {
    setEditingExercise(exerciseId)
    setEditError('')

    if (exerciseId === 'back-extension') {
      setEditValue(String(finishWorkout.progression.backExtensionSeconds))
    } else if (exerciseId === 'abs') {
      setEditValue(String(finishWorkout.progression.absSeconds))
    } else if (exerciseId === 'dips') {
      setEditValue(String(finishWorkout.progression.dipBaseReps))
    } else {
      setEditValue('')
    }
  }

  function closeExerciseEditor() {
    setEditingExercise(null)
    setEditValue('')
    setEditError('')
  }

  async function saveExerciseEdit() {
    if (!editingExercise) {
      return
    }

    if (editingExercise === 'squat-jumps') {
      closeExerciseEditor()
      return
    }

    const parsedValue = Number(editValue)
    const minimum = editingExercise === 'dips' ? 1 : 5
    const maximum = editingExercise === 'dips' ? 20 : 600

    if (
      !Number.isInteger(parsedValue) ||
      parsedValue < minimum ||
      parsedValue > maximum
    ) {
      setEditError(
        editingExercise === 'dips'
          ? 'Enter a whole number from 1 to 20 reps.'
          : 'Enter a whole number from 5 to 600 seconds.',
      )
      return
    }

    const progression: FinishWorkoutProgression = {
      ...finishWorkout.progression,
    }

    if (editingExercise === 'back-extension') {
      progression.backExtensionSeconds = parsedValue
    } else if (editingExercise === 'abs') {
      progression.absSeconds = parsedValue
    } else {
      progression.dipBaseReps = parsedValue
      progression.dipStageOffset = 0
    }

    setEditingSaving(true)
    const saved = await saveFinishWorkoutProgression(progression)
    setEditingSaving(false)

    if (saved) {
      closeExerciseEditor()
    }
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
      playTone(soundSettings, 'complete')
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
        const timerKey = `${today}:${id}:${
          id === 'back-extension'
            ? finishWorkout.progression.backExtensionSeconds
            : id === 'abs'
              ? finishWorkout.progression.absSeconds
              : id === 'dips'
                ? dipPlan.join(',')
                : 'fixed'
        }`
        const stopPreviousRestTimer = () => {
          const previousExercise = EXERCISES[index - 1]

          if (previousExercise) {
            requestTimerStop(`${today}:transition:${previousExercise.id}`)
          }
        }

        return (
          <Section
            key={id}
            className={
              outcome ? 'finish-exercise is-complete' : 'finish-exercise'
            }
            title={`${index + 1}. ${exerciseLabel}`}
            eyebrow={target}
            action={
              <div className="finish-exercise__actions">
                <button
                  type="button"
                  className="icon-button finish-edit-button"
                  aria-expanded={editingExercise === id}
                  aria-label={
                    id === 'squat-jumps'
                      ? 'About Squat jumps target'
                      : `Edit ${label}`
                  }
                  title={
                    id === 'squat-jumps'
                      ? 'About Squat jumps target'
                      : `Edit ${label}`
                  }
                  onClick={() => openExerciseEditor(id)}
                >
                  <span aria-hidden="true">
                    {id === 'squat-jumps' ? 'i' : '✎'}
                  </span>
                </button>
                {outcome ? (
                  <StatusPill
                    tone={outcome === 'pass' ? 'success' : 'danger'}
                    label={outcome}
                  />
                ) : null}
              </div>
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

            {editingExercise === id ? (
              <form
                className="finish-edit-panel"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveExerciseEdit()
                }}
              >
                {id === 'squat-jumps' ? (
                  <p className="muted-text">
                    Squat jumps increase automatically after a passed workout.
                  </p>
                ) : (
                  <label className="field">
                    <span>
                      {id === 'dips' ? 'Reps per set' : 'Work seconds'}
                    </span>
                    <input
                      type="number"
                      min={id === 'dips' ? 1 : 5}
                      max={id === 'dips' ? 20 : 600}
                      step="1"
                      value={editValue}
                      aria-describedby={
                        editError ? `finish-edit-error-${id}` : undefined
                      }
                      aria-invalid={editError ? 'true' : undefined}
                      onChange={(event) => {
                        setEditValue(event.target.value)
                        setEditError('')
                      }}
                    />
                  </label>
                )}
                {editError ? (
                  <p
                    className="field-error"
                    id={`finish-edit-error-${id}`}
                    role="alert"
                  >
                    {editError}
                  </p>
                ) : null}
                <div className="button-row">
                  <button
                    type="submit"
                    className="button button--primary button--compact"
                    disabled={editingSaving}
                  >
                    {id === 'squat-jumps'
                      ? 'Done'
                      : editingSaving
                        ? 'Saving...'
                        : 'Save'}
                  </button>
                  {id !== 'squat-jumps' ? (
                    <button
                      type="button"
                      className="button button--ghost button--compact"
                      disabled={editingSaving}
                      onClick={closeExerciseEditor}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}

            {timerSteps ? (
              <PersistentWorkoutTimer
                key={timerKey}
                label={id === 'dips' ? 'Dip EMOM' : exerciseLabel}
                onStart={stopPreviousRestTimer}
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
