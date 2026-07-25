import { useState } from 'react'
import { Section } from '../../components/Section'
import { getEntryTrainingLoadPoints } from '../../domain/volume'
import type {
  BodyweightEntry,
  Exercise,
  ExerciseEntry,
  FailurePoint,
  PresetOutcome,
  QualityFlag,
  RecentWorkoutItem,
  WorkoutCorrectionInput,
} from '../../domain/types'
import { formatLongDate } from '../../lib/date'
import { formatQualityFlag } from '../../lib/qualityFlag'

const PAGE_SIZE = 10

function formatLoadPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatEntryTarget(entry: ExerciseEntry) {
  if (entry.presetTargetSummary) {
    return entry.presetTargetSummary
  }

  if (typeof entry.reps === 'number') {
    return `${entry.sets ?? 1} x ${entry.reps} reps`
  }

  if (typeof entry.durationSeconds === 'number') {
    return `${entry.sets ?? 1} x ${entry.durationSeconds}s`
  }

  return 'Target not recorded'
}

function getWorkoutCardTone(session: RecentWorkoutItem) {
  if (session.maxRepDelta !== null && session.maxRepDelta > 0) {
    return 'is-improved'
  }

  if (session.maxRepDelta !== null && session.maxRepDelta < 0) {
    return 'is-declined'
  }

  if (session.entries.some((entry) => entry.outcome === 'fail')) {
    return 'is-hard'
  }

  return session.sessionType === 'max' ? 'is-max' : 'is-clean'
}

function formatRepDelta(value: number | null) {
  if (value === null) {
    return 'First recorded max'
  }

  if (value === 0) {
    return 'Matched previous max'
  }

  return `${value > 0 ? '+' : ''}${value} rep${Math.abs(value) === 1 ? '' : 's'}`
}

function optionalNumber(value: string) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function WorkoutEditForm({
  exerciseById,
  onCancel,
  onSave,
  session,
}: {
  exerciseById: Map<string, Exercise>
  onCancel: () => void
  onSave: (input: WorkoutCorrectionInput) => Promise<boolean>
  session: RecentWorkoutItem
}) {
  const [date, setDate] = useState(session.date)
  const [maxReps, setMaxReps] = useState(
    session.maxReps === null ? '' : String(session.maxReps),
  )
  const [fatigueBefore, setFatigueBefore] = useState(
    session.fatigueBefore === undefined ? '' : String(session.fatigueBefore),
  )
  const [fatigueAfter, setFatigueAfter] = useState(
    session.fatigueAfter === undefined ? '' : String(session.fatigueAfter),
  )
  const [elbowPain, setElbowPain] = useState(
    session.elbowPain === undefined ? '' : String(session.elbowPain),
  )
  const [shoulderPain, setShoulderPain] = useState(
    session.shoulderPain === undefined ? '' : String(session.shoulderPain),
  )
  const [failurePoint, setFailurePoint] = useState<FailurePoint | ''>(
    session.maxFailurePoint ?? '',
  )
  const [qualityFlag, setQualityFlag] = useState<QualityFlag | ''>(
    session.qualityFlag ?? '',
  )
  const [videoUrl, setVideoUrl] = useState(session.maxVideoUrl ?? '')
  const [notes, setNotes] = useState(session.notes)
  const [entryOutcomes, setEntryOutcomes] = useState<
    Record<string, PresetOutcome>
  >(() =>
    Object.fromEntries(
      session.entries.flatMap((entry) =>
        entry.outcome ? [[entry.id, entry.outcome]] : [],
      ),
    ),
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedMaxReps = Number(maxReps)

    if (!date) {
      setError('Choose a workout date.')
      return
    }

    if (
      session.maxReps !== null &&
      (!Number.isInteger(parsedMaxReps) || parsedMaxReps < 1)
    ) {
      setError('Max reps must be a positive whole number.')
      return
    }

    const signals = [fatigueBefore, fatigueAfter, elbowPain, shoulderPain]
      .filter(Boolean)
      .map(Number)
    if (
      signals.some(
        (value) => !Number.isInteger(value) || value < 0 || value > 5,
      )
    ) {
      setError('Fatigue and pain values must be whole numbers from 0 to 5.')
      return
    }

    setSaving(true)
    const saved = await onSave({
      sessionId: session.id,
      date,
      fatigueBefore: optionalNumber(fatigueBefore),
      fatigueAfter: optionalNumber(fatigueAfter),
      elbowPain: optionalNumber(elbowPain),
      shoulderPain: optionalNumber(shoulderPain),
      notes: notes.trim(),
      entryOutcomes,
      maxTest:
        session.maxReps === null
          ? undefined
          : {
              reps: parsedMaxReps,
              videoUrl: videoUrl.trim() || undefined,
              failurePoint: failurePoint || undefined,
              qualityFlag: qualityFlag || undefined,
            },
    })
    setSaving(false)

    if (saved) onCancel()
  }

  return (
    <form className="workout-edit" noValidate onSubmit={handleSubmit}>
      <div className="field-grid field-grid--compact">
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        {session.maxReps !== null ? (
          <>
            <label className="field">
              <span>Max reps</span>
              <input
                type="number"
                min="1"
                step="1"
                value={maxReps}
                onChange={(event) => setMaxReps(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Failure point</span>
              <select
                value={failurePoint}
                onChange={(event) =>
                  setFailurePoint(event.target.value as FailurePoint | '')
                }
              >
                <option value="">Not recorded</option>
                <option value="start/bottom">Start / bottom</option>
                <option value="middle">Middle</option>
                <option value="top">Top / finish</option>
                <option value="grip">Grip / hang</option>
                <option value="not sure">Not sure</option>
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
                <option value="">Not recorded</option>
                <option value="clean">Clean</option>
                <option value="grindy">Hard</option>
                <option value="partial">Very hard</option>
              </select>
            </label>
            <label className="field field--span-2">
              <span>Video link</span>
              <input
                type="url"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
              />
            </label>
          </>
        ) : null}

        {[
          ['Fatigue before', fatigueBefore, setFatigueBefore],
          ['Fatigue after', fatigueAfter, setFatigueAfter],
          ['Elbow pain', elbowPain, setElbowPain],
          ['Shoulder pain', shoulderPain, setShoulderPain],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="field">
            <span>{label as string} (0-5)</span>
            <input
              type="number"
              min="0"
              max="5"
              step="1"
              value={value as string}
              onChange={(event) =>
                (setter as React.Dispatch<React.SetStateAction<string>>)(
                  event.target.value,
                )
              }
            />
          </label>
        ))}

        <label className="field field--span-2">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>

      {session.entries.some((entry) => entry.outcome) ? (
        <fieldset className="workout-edit__outcomes">
          <legend>Exercise results</legend>
          {session.entries.flatMap((entry) =>
            entry.outcome
              ? [
                  <div key={entry.id} className="workout-edit__outcome">
                    <span>
                      {entry.notes ||
                        exerciseById.get(entry.exerciseId)?.name ||
                        'Exercise'}
                    </span>
                    <div
                      className="segment-row"
                      aria-label={`Correct result for ${
                        entry.notes ||
                        exerciseById.get(entry.exerciseId)?.name ||
                        'exercise'
                      }`}
                    >
                      {(['pass', 'fail'] as const).map((outcome) => (
                        <button
                          key={outcome}
                          type="button"
                          className={`segment-row__item${
                            entryOutcomes[entry.id] === outcome
                              ? ' is-active'
                              : ''
                          }`}
                          aria-pressed={entryOutcomes[entry.id] === outcome}
                          onClick={() =>
                            setEntryOutcomes((current) => ({
                              ...current,
                              [entry.id]: outcome,
                            }))
                          }
                        >
                          {outcome}
                        </button>
                      ))}
                    </div>
                  </div>,
                ]
              : [],
          )}
        </fieldset>
      ) : null}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="button-row">
        <button
          type="submit"
          className="button button--primary button--compact"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save correction'}
        </button>
        <button
          type="button"
          className="button button--ghost button--compact"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function WorkoutCard({
  exerciseById,
  isEditing,
  onDelete,
  onEdit,
  onSave,
  session,
}: {
  exerciseById: Map<string, Exercise>
  isEditing: boolean
  onDelete: () => void
  onEdit: () => void
  onSave: (input: WorkoutCorrectionInput) => Promise<boolean>
  session: RecentWorkoutItem
}) {
  const maxQuality = formatQualityFlag(session.qualityFlag)

  return (
    <article
      className={`workout-card ${getWorkoutCardTone(session)}`}
      aria-label={`${session.sessionType} workout on ${formatLongDate(session.date)}`}
    >
      <header className="workout-card__header">
        <div>
          <p className="workout-card__date">{formatLongDate(session.date)}</p>
          <p className="workout-card__type">
            {session.sessionType === 'max' ? 'Max day' : 'Support day'}
          </p>
        </div>
        <div className="workout-card__header-actions">
          <div className="workout-card__load">
            <span>Training load</span>
            <strong>
              {session.trainingLoadPoints === null
                ? 'Not scored'
                : `${formatLoadPoints(session.trainingLoadPoints)} pts`}
            </strong>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="button button--ghost button--compact"
              aria-expanded={isEditing}
              onClick={onEdit}
            >
              {isEditing ? 'Close edit' : 'Edit'}
            </button>
            <button
              type="button"
              className="button button--ghost button--compact text-danger"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      {isEditing ? (
        <WorkoutEditForm
          exerciseById={exerciseById}
          session={session}
          onCancel={onEdit}
          onSave={onSave}
        />
      ) : null}

      {session.maxReps !== null ? (
        <div className="workout-card__max">
          <div className="workout-card__max-result">
            <strong>{session.maxReps}</strong>
            <span>max reps</span>
          </div>
          <div className="workout-card__max-details">
            <span
              className={
                session.maxRepDelta === null
                  ? undefined
                  : session.maxRepDelta > 0
                    ? 'text-success'
                    : session.maxRepDelta < 0
                      ? 'text-danger'
                      : 'text-warning'
              }
            >
              {formatRepDelta(session.maxRepDelta)}
            </span>
            {maxQuality ? (
              <span
                className={`quality-text quality-text--${session.qualityFlag}`}
              >
                {maxQuality}
              </span>
            ) : null}
            {session.maxFailurePoint ? (
              <span>Failure point: {session.maxFailurePoint}</span>
            ) : null}
            {typeof session.maxBodyweightKgSnapshot === 'number' ? (
              <span>{session.maxBodyweightKgSnapshot} kg</span>
            ) : null}
          </div>
          {session.maxVideoUrl ? (
            <a
              className="button button--ghost button--compact"
              href={session.maxVideoUrl}
              target="_blank"
              rel="noreferrer"
            >
              Video
            </a>
          ) : null}
        </div>
      ) : null}

      {session.entries.length > 0 ? (
        <div className="workout-card__exercises">
          {session.entries.map((entry) => {
            const exercise = exerciseById.get(entry.exerciseId)
            const points = getEntryTrainingLoadPoints(entry, exerciseById)
            const outcome = entry.outcome

            return (
              <div
                key={entry.id}
                className={`workout-exercise${outcome ? ` is-${outcome}` : ''}`}
              >
                <div className="workout-exercise__copy">
                  <strong>{entry.notes || exercise?.name || 'Exercise'}</strong>
                  <span>{formatEntryTarget(entry)}</span>
                </div>
                <div className="workout-exercise__result">
                  <strong>
                    {outcome === 'pass'
                      ? 'Passed'
                      : outcome === 'fail'
                        ? 'Failed'
                        : 'Logged'}
                  </strong>
                  <span>
                    {points === null
                      ? 'Not scored'
                      : `${formatLoadPoints(points)} pts`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {session.notes ? (
        <p className="workout-card__notes">{session.notes}</p>
      ) : null}
    </article>
  )
}

export function WorkoutHistory({
  bodyweightEntries,
  bodyweightTrackingEnabled,
  exercises,
  eyebrow = 'Training record',
  emptyMessage = 'Your completed workouts will appear here after the first session is saved.',
  onDeleteWorkout,
  onUpdateWorkout,
  title = 'Past workouts',
  workouts,
}: {
  bodyweightEntries: BodyweightEntry[]
  bodyweightTrackingEnabled: boolean
  exercises: Exercise[]
  eyebrow?: string
  emptyMessage?: string
  onDeleteWorkout: (sessionId: string) => Promise<boolean>
  onUpdateWorkout: (input: WorkoutCorrectionInput) => Promise<boolean>
  title?: string
  workouts: RecentWorkoutItem[]
}) {
  const [visibleWorkouts, setVisibleWorkouts] = useState(PAGE_SIZE)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [weightOpen, setWeightOpen] = useState(false)
  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  )
  const sortedWeights = [...bodyweightEntries].sort((left, right) =>
    right.date.localeCompare(left.date),
  )

  return (
    <>
      <Section eyebrow={eyebrow} title={title}>
        {workouts.length === 0 ? (
          <p className="muted-text">{emptyMessage}</p>
        ) : (
          <>
            <div className="workout-card-list">
              {workouts.slice(0, visibleWorkouts).map((session) => (
                <WorkoutCard
                  key={session.id}
                  exerciseById={exerciseById}
                  isEditing={editingSessionId === session.id}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Delete the ${session.sessionType} workout from ${formatLongDate(session.date)}? Training state will be recalculated.`,
                      )
                    ) {
                      void onDeleteWorkout(session.id)
                    }
                  }}
                  onEdit={() =>
                    setEditingSessionId((current) =>
                      current === session.id ? null : session.id,
                    )
                  }
                  onSave={onUpdateWorkout}
                  session={session}
                />
              ))}
            </div>
            {workouts.length > visibleWorkouts ? (
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() =>
                  setVisibleWorkouts((current) => current + PAGE_SIZE)
                }
              >
                Show more ({workouts.length - visibleWorkouts} remaining)
              </button>
            ) : null}
          </>
        )}
      </Section>

      {bodyweightTrackingEnabled && sortedWeights.length > 0 ? (
        <Section
          eyebrow="Bodyweight"
          title="Weight history"
          action={
            <button
              type="button"
              className="button button--ghost button--compact"
              aria-expanded={weightOpen}
              onClick={() => setWeightOpen((current) => !current)}
            >
              {weightOpen ? 'Hide' : 'Show'}
            </button>
          }
        >
          {weightOpen ? (
            <div className="weight-history">
              {sortedWeights.map((entry) => (
                <div key={entry.id} className="weight-history__row">
                  <span>{formatLongDate(entry.date)}</span>
                  <strong>{entry.weightKg} kg</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-text">
              {sortedWeights.length} recorded weigh-in
              {sortedWeights.length === 1 ? '' : 's'}
            </p>
          )}
        </Section>
      ) : null}
    </>
  )
}
