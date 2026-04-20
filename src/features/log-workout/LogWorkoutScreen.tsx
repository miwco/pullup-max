import { useState } from 'react'
import { AccordionSection } from '../../components/AccordionSection'
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
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'

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

function serializeEntry(entry: ProgramEntryDraft) {
  return {
    templateStepId: entry.templateStepId,
    label: entry.label,
    exerciseId: entry.exerciseId,
    exerciseName: entry.exerciseName,
    sets: entry.sets,
    reps: entry.reps,
    durationSeconds: entry.durationSeconds,
    bandAssisted: entry.bandAssisted,
    effort: entry.effort,
    notes: entry.notes,
  }
}

function createEntriesSignature(entries: ProgramEntryDraft[]) {
  return JSON.stringify(entries.map(serializeEntry))
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
  const [showMaxDetail, setShowMaxDetail] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [initialDate] = useState(date)
  const [initialEntriesSignature] = useState(() =>
    createEntriesSignature(entries),
  )
  const [entriesBaselineSignature, setEntriesBaselineSignature] = useState(
    initialEntriesSignature,
  )
  const currentEntriesSignature = createEntriesSignature(entries)
  const isDirty =
    sessionType !== initialType ||
    date !== initialDate ||
    maxReps.trim().length > 0 ||
    videoLink.trim().length > 0 ||
    fatigueBefore.trim().length > 0 ||
    fatigueAfter.trim().length > 0 ||
    elbowPain.trim().length > 0 ||
    shoulderPain.trim().length > 0 ||
    failurePoint !== '' ||
    qualityFlag !== '' ||
    notes.trim().length > 0 ||
    currentEntriesSignature !== initialEntriesSignature

  useUnsavedChangesPrompt(isDirty)

  function updateEntry(localId: string, updates: Partial<EntryDraft>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.localId === localId ? { ...entry, ...updates } : entry,
      ),
    )
  }

  function loadPrefill(nextType: SessionType) {
    const nextEntries = toDrafts(getProgramPrefill(nextType))
    setEntries(nextEntries)
    setEntriesBaselineSignature(createEntriesSignature(nextEntries))
  }

  function canReplaceWorkoutRows() {
    return (
      currentEntriesSignature === entriesBaselineSignature ||
      window.confirm(
        'Discard the current row edits and load the default program?',
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

    setIsSaving(true)

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

    setIsSaving(false)

    if (success) {
      onSaved()
    }
  }

  return (
    <div className="screen-stack">
      <form className="screen-stack" onSubmit={handleSubmit}>
        <Section eyebrow="Fast logging" title="Log workout">
          <div className="summary-bar">
            <p className="muted-text">
              Recommended today: <strong>{recommendedType}</strong>
            </p>
          </div>

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

                  setSessionType(type)
                  loadPrefill(type)
                }}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="field-grid field-grid--compact">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                name="session-date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Fatigue before</span>
              <input
                name="fatigue-before"
                autoComplete="off"
                inputMode="numeric"
                placeholder="1-5"
                value={fatigueBefore}
                onChange={(event) => setFatigueBefore(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Fatigue after</span>
              <input
                name="fatigue-after"
                autoComplete="off"
                inputMode="numeric"
                placeholder="1-5"
                value={fatigueAfter}
                onChange={(event) => setFatigueAfter(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Elbow pain</span>
              <input
                name="elbow-pain"
                autoComplete="off"
                inputMode="numeric"
                placeholder="0-5"
                value={elbowPain}
                onChange={(event) => setElbowPain(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Shoulder pain</span>
              <input
                name="shoulder-pain"
                autoComplete="off"
                inputMode="numeric"
                placeholder="0-5"
                value={shoulderPain}
                onChange={(event) => setShoulderPain(event.target.value)}
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
                onChange={(event) => setMaxReps(event.target.value)}
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
                  type="url"
                  name="max-video-url"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="url"
                  placeholder="https://example.com/attempt…"
                  value={videoLink}
                  onChange={(event) => setVideoLink(event.target.value)}
                />
              </label>
            </AccordionSection>
          </Section>
        ) : null}

        <Section eyebrow="Workout rows" title="Prefilled exercises">
          <div className="summary-bar">
            <p className="muted-text">
              These rows come from the default program. Edit or remove them
              before saving.
            </p>
            <div className="action-row">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  if (!canReplaceWorkoutRows()) {
                    return
                  }

                  loadPrefill(sessionType)
                }}
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
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </AccordionSection>

          {formError ? <p className="form-error">{formError}</p> : null}
          <button type="submit" className="button button--primary">
            {isSaving ? 'Saving…' : 'Save workout'}
          </button>
        </Section>
      </form>
    </div>
  )
}
