import { useState } from 'react'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/AppProvider'
import type {
  FailurePoint,
  ProgramEntryDraft,
  QualityFlag,
  SessionType,
} from '../../domain/types'
import { todayDateString } from '../../lib/date'
import { createId } from '../../lib/id'

interface LogWorkoutScreenProps {
  prefill: boolean
  requestedType: SessionType | null
  onSaved: () => void
}

interface EntryDraft extends ProgramEntryDraft {
  localId: string
}

const FAILURE_POINTS: FailurePoint[] = [
  'top',
  'middle',
  'start/bottom',
  'grip',
  'not sure',
]

const QUALITY_FLAGS: QualityFlag[] = ['clean', 'grindy', 'partial']

function createEmptyEntry(): EntryDraft {
  return {
    localId: createId('draft'),
    templateStepId: '',
    label: '',
    exerciseId: '',
    exerciseName: '',
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

function toDrafts(prefillRows: ProgramEntryDraft[]) {
  return prefillRows.map((row) => ({
    ...row,
    localId: createId('draft'),
  }))
}

export function LogWorkoutScreen({
  prefill,
  requestedType,
  onSaved,
}: LogWorkoutScreenProps) {
  const { activeExercises, data, getProgramPrefill, saveSession } =
    useAppState()
  const recommendedType = data.recommendationState.nextSessionType
  const initialType = requestedType ?? recommendedType
  const [sessionType, setSessionType] = useState<SessionType>(initialType)
  const [date, setDate] = useState(() => todayDateString())
  const [maxReps, setMaxReps] = useState('')
  const [videoLink, setVideoLink] = useState('')
  const [fatigueBefore, setFatigueBefore] = useState('')
  const [fatigueAfter, setFatigueAfter] = useState('')
  const [elbowPain, setElbowPain] = useState('')
  const [shoulderPain, setShoulderPain] = useState('')
  const [failurePoint, setFailurePoint] = useState<FailurePoint | ''>('')
  const [qualityFlag, setQualityFlag] = useState<QualityFlag | ''>('')
  const [notes, setNotes] = useState('')
  const [entries, setEntries] = useState<EntryDraft[]>(() =>
    prefill ? toDrafts(getProgramPrefill(initialType)) : [],
  )
  const [formError, setFormError] = useState<string | null>(null)

  function updateEntry(localId: string, updates: Partial<EntryDraft>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.localId === localId ? { ...entry, ...updates } : entry,
      ),
    )
  }

  function loadPrefill(nextType: SessionType) {
    setEntries(toDrafts(getProgramPrefill(nextType)))
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

    const cleanedEntries = entries
      .filter((entry) => entry.exerciseId)
      .map((entry) => ({
        exerciseId: entry.exerciseId,
        sets: parseOptionalNumber(entry.sets),
        reps: parseOptionalNumber(entry.reps),
        durationSeconds: parseOptionalNumber(entry.durationSeconds),
        bandAssisted: entry.bandAssisted || undefined,
        effort: parseOptionalNumber(entry.effort),
        notes:
          [entry.label, entry.notes.trim()].filter(Boolean).join(' - ') ||
          undefined,
        isMaxTest: false,
      }))

    const success = await saveSession({
      session: {
        date,
        sessionType,
        fatigueBefore: parseOptionalNumber(fatigueBefore),
        fatigueAfter: parseOptionalNumber(fatigueAfter),
        elbowPain: parseOptionalNumber(elbowPain),
        shoulderPain: parseOptionalNumber(shoulderPain),
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

    if (success) {
      onSaved()
    }
  }

  return (
    <div className="screen-stack">
      <Section eyebrow="Fast logging" title="Log workout">
        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="subsection">
            <div className="subsection__header">
              <div>
                <h3>Session type</h3>
                <p>
                  Recommended today: <strong>{recommendedType}</strong>
                </p>
              </div>
            </div>

            <div
              className="segment-row"
              role="tablist"
              aria-label="Session type"
            >
              {(['max', 'support'] as SessionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`segment-row__item${sessionType === type ? ' is-active' : ''}`}
                  onClick={() => {
                    setSessionType(type)
                    loadPrefill(type)
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="field-grid field-grid--compact">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>

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
                <span>True max reps</span>
                <input
                  inputMode="numeric"
                  placeholder="0"
                  value={maxReps}
                  onChange={(event) => setMaxReps(event.target.value)}
                />
              </label>

              <div className="field-grid field-grid--compact">
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

              <label className="field">
                <span>Video link</span>
                <input
                  inputMode="url"
                  placeholder="https://..."
                  value={videoLink}
                  onChange={(event) => setVideoLink(event.target.value)}
                />
              </label>
            </div>
          ) : null}

          <div className="subsection">
            <div className="subsection__header">
              <div>
                <h3>Prefilled workout rows</h3>
                <p>
                  These rows come from the editable default program. You can
                  change or remove any of them before saving.
                </p>
              </div>

              <div className="button-row button-row--wrap">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => loadPrefill(sessionType)}
                >
                  Reload defaults
                </button>
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
            </div>
          </div>

          <div className="entry-list">
            {entries.length === 0 ? (
              <p className="muted-text">
                No exercise rows added. You can still save the workout.
              </p>
            ) : null}

            {entries.map((entry) => (
              <div key={entry.localId} className="entry-row entry-row--compact">
                <label className="field field--span-2">
                  <span>Block label</span>
                  <input
                    value={entry.label}
                    onChange={(event) =>
                      updateEntry(entry.localId, { label: event.target.value })
                    }
                  />
                </label>

                <label className="field field--span-2">
                  <span>Exercise</span>
                  <select
                    value={entry.exerciseId}
                    onChange={(event) => {
                      const exercise = activeExercises.find(
                        (item) => item.id === event.target.value,
                      )

                      updateEntry(entry.localId, {
                        exerciseId: event.target.value,
                        exerciseName: exercise?.name ?? '',
                      })
                    }}
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
            <span>Notes</span>
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
