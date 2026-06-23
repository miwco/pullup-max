import {
  useEffect,
  useMemo,
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
  WorkoutLogDraft,
  WorkoutLogEntryDraft,
} from '../../domain/types'
import { todayDateString } from '../../lib/date'
import { createId } from '../../lib/id'
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

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const nextNumber = Number(value)
  return Number.isFinite(nextNumber) ? nextNumber : undefined
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
  const [sessionType, setSessionType] =
    useState<SessionType>(initialSessionType)
  const [date, setDate] = useState(
    () => workoutDraft?.date ?? todayDateString(),
  )
  const [maxReps, setMaxReps] = useState(workoutDraft?.maxReps ?? '')
  const [videoLink, setVideoLink] = useState(workoutDraft?.videoLink ?? '')
  const [fatigueBefore, setFatigueBefore] = useState(
    workoutDraft?.fatigueBefore ?? '',
  )
  const [fatigueAfter, setFatigueAfter] = useState(
    workoutDraft?.fatigueAfter ?? '',
  )
  const [elbowPain, setElbowPain] = useState(workoutDraft?.elbowPain ?? '')
  const [shoulderPain, setShoulderPain] = useState(
    workoutDraft?.shoulderPain ?? '',
  )
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
      : toDrafts(getProgramPrefill(initialSessionType)),
  )
  const [showMaxDetail, setShowMaxDetail] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [entriesBaselineSignature, setEntriesBaselineSignature] = useState(() =>
    createEntriesSignature(toDrafts(getProgramPrefill(initialSessionType))),
  )
  const [hasInteracted, setHasInteracted] = useState(() => !!workoutDraft)
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>(
    workoutDraft ? 'saved' : 'idle',
  )
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(
    workoutDraft?.updatedAt ?? null,
  )
  const currentEntriesSignature = createEntriesSignature(entries)
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
      elbowPain,
      entries,
      failurePoint,
      fatigueAfter,
      fatigueBefore,
      maxReps,
      notes,
      qualityFlag,
      sessionType,
      shoulderPain,
      updatedAt: new Date().toISOString(),
      videoLink,
    }),
    [
      date,
      elbowPain,
      entries,
      failurePoint,
      fatigueAfter,
      fatigueBefore,
      maxReps,
      notes,
      qualityFlag,
      sessionType,
      shoulderPain,
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

  function loadPrefill(nextType: SessionType) {
    markInteracted()
    const nextEntries = toDrafts(getProgramPrefill(nextType))
    setEntries(nextEntries)
    setEntriesBaselineSignature(createEntriesSignature(nextEntries))
  }

  async function handleClearDraft() {
    if (
      !window.confirm(
        'Clear the saved in-progress workout and reload today’s prescription?',
      )
    ) {
      return
    }

    await clearWorkoutDraft()

    const nextEntries = toDrafts(getProgramPrefill(initialType))
    setSessionType(initialType)
    setDate(todayDateString())
    setMaxReps('')
    setVideoLink('')
    setFatigueBefore('')
    setFatigueAfter('')
    setElbowPain('')
    setShoulderPain('')
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
                onChange={(event) => updateText(setDate, event.target.value)}
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
                onChange={(event) =>
                  updateText(setFatigueBefore, event.target.value)
                }
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
                onChange={(event) =>
                  updateText(setFatigueAfter, event.target.value)
                }
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
                onChange={(event) =>
                  updateText(setElbowPain, event.target.value)
                }
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
                onChange={(event) =>
                  updateText(setShoulderPain, event.target.value)
                }
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
                      onClick={() =>
                        updateEntry(entry.localId, {
                          outcome,
                        })
                      }
                    >
                      {outcome}
                    </button>
                  ))}
                </div>
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
