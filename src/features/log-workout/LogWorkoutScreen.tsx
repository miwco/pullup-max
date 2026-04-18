import { useState } from 'react'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/AppProvider'
import type {
  Exercise,
  FailurePoint,
  QualityFlag,
  SessionType,
} from '../../domain/types'
import { createId } from '../../lib/id'
import { todayDateString } from '../../lib/date'

interface LogWorkoutScreenProps {
  prefill: boolean
  requestedType: SessionType | null
  onSaved: () => void
}

interface EntryDraft {
  localId: string
  exerciseId: string
  sets: string
  reps: string
  durationSeconds: string
  bandAssisted: boolean
  effort: string
  notes: string
}

const FAILURE_POINTS: FailurePoint[] = [
  'start',
  'middle',
  'finish',
  'grip/hang',
  'general endurance',
  'not sure',
]

const QUALITY_FLAGS: QualityFlag[] = [
  'cleaner',
  'stronger',
  'grindy',
  'partial',
]

function createEmptyEntry(exerciseId = ''): EntryDraft {
  return {
    localId: createId('draft'),
    exerciseId,
    sets: '',
    reps: '',
    durationSeconds: '',
    bandAssisted: false,
    effort: '',
    notes: '',
  }
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const nextNumber = Number(value)
  return Number.isFinite(nextNumber) ? nextNumber : undefined
}

function matchSuggestedExercises(
  suggestions: string[],
  activeExercises: Exercise[],
) {
  const lookup = new Map(
    activeExercises.map((exercise) => [exercise.name.toLowerCase(), exercise]),
  )

  return suggestions.flatMap((suggestion) => {
    const match = lookup.get(suggestion.toLowerCase())
    return match ? [createEmptyEntry(match.id)] : []
  })
}

function createInitialEntries(
  prefill: boolean,
  suggestions: string[],
  activeExercises: Exercise[],
) {
  return prefill ? matchSuggestedExercises(suggestions, activeExercises) : []
}

export function LogWorkoutScreen({
  prefill,
  requestedType,
  onSaved,
}: LogWorkoutScreenProps) {
  const { activeExercises, data, saveSession } = useAppState()
  const recommendedType = data.recommendationState.nextSessionType
  const [sessionType, setSessionType] = useState<SessionType>(
    requestedType ?? recommendedType,
  )
  const [date, setDate] = useState(() => todayDateString())
  const [maxReps, setMaxReps] = useState('')
  const [bodyweight, setBodyweight] = useState('')
  const [fatigueBefore, setFatigueBefore] = useState('')
  const [fatigueAfter, setFatigueAfter] = useState('')
  const [elbowPain, setElbowPain] = useState('')
  const [shoulderPain, setShoulderPain] = useState('')
  const [failurePoint, setFailurePoint] = useState<FailurePoint | ''>('')
  const [qualityFlag, setQualityFlag] = useState<QualityFlag | ''>('')
  const [notes, setNotes] = useState('')
  const [entries, setEntries] = useState<EntryDraft[]>(() =>
    createInitialEntries(
      prefill,
      data.recommendationState.suggestedExercises,
      activeExercises,
    ),
  )
  const [formError, setFormError] = useState<string | null>(null)

  function updateEntry(localId: string, updates: Partial<EntryDraft>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.localId === localId ? { ...entry, ...updates } : entry,
      ),
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (sessionType === 'max' && !maxReps.trim()) {
      setFormError('Max sessions need the max reps field filled in.')
      return
    }

    const cleanedEntries = entries
      .filter((entry) => entry.exerciseId)
      .map((entry) => ({
        exerciseId: entry.exerciseId,
        sets: parseOptionalNumber(entry.sets),
        reps: parseOptionalNumber(entry.reps),
        durationSeconds: parseOptionalNumber(entry.durationSeconds),
        bandAssisted: entry.bandAssisted || undefined,
        effort: parseOptionalNumber(entry.effort),
        notes: entry.notes.trim() || undefined,
        isMaxTest: false,
      }))

    const success = await saveSession({
      session: {
        date,
        sessionType,
        bodyweightKg: data.athleteProfile.bodyweightTrackingEnabled
          ? parseOptionalNumber(bodyweight)
          : undefined,
        fatigueBefore: parseOptionalNumber(fatigueBefore),
        fatigueAfter: parseOptionalNumber(fatigueAfter),
        elbowPain: parseOptionalNumber(elbowPain),
        shoulderPain: parseOptionalNumber(shoulderPain),
        notes: notes.trim(),
      },
      entries: cleanedEntries,
      maxTest:
        sessionType === 'max' && maxReps.trim()
          ? {
              reps: Number(maxReps),
              failurePoint: failurePoint || undefined,
              qualityFlag: qualityFlag || undefined,
            }
          : undefined,
    })

    if (success) {
      onSaved()
    }
  }

  return (
    <div className="screen-stack">
      <Section eyebrow="Fast entry" title="Log workout">
        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="segment-row" role="tablist" aria-label="Session type">
            {(['max', 'support', 'recovery', 'deload'] as SessionType[]).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  className={`segment-row__item${sessionType === type ? ' is-active' : ''}`}
                  onClick={() => setSessionType(type)}
                >
                  {type}
                </button>
              ),
            )}
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>

            {data.athleteProfile.bodyweightTrackingEnabled ? (
              <label className="field">
                <span>Bodyweight</span>
                <input
                  inputMode="decimal"
                  placeholder="kg"
                  value={bodyweight}
                  onChange={(event) => setBodyweight(event.target.value)}
                />
              </label>
            ) : null}

            <label className="field">
              <span>Fatigue before</span>
              <input
                inputMode="numeric"
                placeholder="1-5"
                value={fatigueBefore}
                onChange={(event) => setFatigueBefore(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Fatigue after</span>
              <input
                inputMode="numeric"
                placeholder="1-5"
                value={fatigueAfter}
                onChange={(event) => setFatigueAfter(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Elbow pain</span>
              <input
                inputMode="numeric"
                placeholder="0-5"
                value={elbowPain}
                onChange={(event) => setElbowPain(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Shoulder pain</span>
              <input
                inputMode="numeric"
                placeholder="0-5"
                value={shoulderPain}
                onChange={(event) => setShoulderPain(event.target.value)}
              />
            </label>
          </div>

          {sessionType === 'max' ? (
            <div className="max-panel">
              <label className="field field--max">
                <span>Main max reps</span>
                <input
                  inputMode="numeric"
                  placeholder="0"
                  value={maxReps}
                  onChange={(event) => setMaxReps(event.target.value)}
                />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Failure point</span>
                  <select
                    value={failurePoint}
                    onChange={(event) =>
                      setFailurePoint(event.target.value as FailurePoint | '')
                    }
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
                    onChange={(event) =>
                      setQualityFlag(event.target.value as QualityFlag | '')
                    }
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
            </div>
          ) : null}

          <div className="subsection">
            <div className="subsection__header">
              <div>
                <h3>Quick add</h3>
                <p>
                  Tap a suggestion if you want the default exercise rows added
                  for this session.
                </p>
              </div>
              <button
                type="button"
                className="button button--ghost"
                onClick={() =>
                  setEntries((current) => [...current, createEmptyEntry()])
                }
              >
                Add row
              </button>
            </div>

            <div className="chip-row">
              {data.recommendationState.suggestedExercises.map(
                (exerciseName) => {
                  const exercise = activeExercises.find(
                    (item) => item.name === exerciseName,
                  )

                  return (
                    <button
                      key={exerciseName}
                      type="button"
                      className="chip chip--button"
                      onClick={() =>
                        setEntries((current) => [
                          ...current,
                          createEmptyEntry(exercise?.id ?? ''),
                        ])
                      }
                    >
                      {exerciseName}
                    </button>
                  )
                },
              )}
            </div>
          </div>

          <div className="entry-list">
            {entries.length === 0 ? (
              <p className="muted-text">
                Entries are optional. Max days can be logged with just date,
                session type, and max reps.
              </p>
            ) : null}

            {entries.map((entry) => (
              <div key={entry.localId} className="entry-row">
                <label className="field field--span-2">
                  <span>Exercise</span>
                  <select
                    value={entry.exerciseId}
                    onChange={(event) =>
                      updateEntry(entry.localId, {
                        exerciseId: event.target.value,
                      })
                    }
                  >
                    <option value="">Choose exercise</option>
                    {activeExercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Sets</span>
                  <input
                    inputMode="numeric"
                    value={entry.sets}
                    onChange={(event) =>
                      updateEntry(entry.localId, { sets: event.target.value })
                    }
                  />
                </label>

                <label className="field">
                  <span>Reps</span>
                  <input
                    inputMode="numeric"
                    value={entry.reps}
                    onChange={(event) =>
                      updateEntry(entry.localId, { reps: event.target.value })
                    }
                  />
                </label>

                <label className="field">
                  <span>Seconds</span>
                  <input
                    inputMode="numeric"
                    value={entry.durationSeconds}
                    onChange={(event) =>
                      updateEntry(entry.localId, {
                        durationSeconds: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="field">
                  <span>Effort</span>
                  <input
                    inputMode="numeric"
                    placeholder="1-10"
                    value={entry.effort}
                    onChange={(event) =>
                      updateEntry(entry.localId, { effort: event.target.value })
                    }
                  />
                </label>

                <label className="field field--checkbox">
                  <span>Band-assisted</span>
                  <input
                    type="checkbox"
                    checked={entry.bandAssisted}
                    onChange={(event) =>
                      updateEntry(entry.localId, {
                        bandAssisted: event.target.checked,
                      })
                    }
                  />
                </label>

                <label className="field field--span-2">
                  <span>Notes</span>
                  <input
                    value={entry.notes}
                    onChange={(event) =>
                      updateEntry(entry.localId, { notes: event.target.value })
                    }
                  />
                </label>

                <button
                  type="button"
                  className="button button--ghost entry-row__remove"
                  onClick={() =>
                    setEntries((current) =>
                      current.filter((item) => item.localId !== entry.localId),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <label className="field">
            <span>Session notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {formError ? <p className="form-error">{formError}</p> : null}

          <button type="submit" className="button button--primary">
            Save workout
          </button>
        </form>
      </Section>
    </div>
  )
}
