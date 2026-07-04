import { useState } from 'react'
import { Section } from '../../components/Section'
import { getEntryTrainingLoadPoints } from '../../domain/volume'
import type {
  BodyweightEntry,
  Exercise,
  ExerciseEntry,
  RecentWorkoutItem,
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

function WorkoutCard({
  exerciseById,
  session,
}: {
  exerciseById: Map<string, Exercise>
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
        <div className="workout-card__load">
          <span>Training load</span>
          <strong>
            {session.trainingLoadPoints === null
              ? 'Not scored'
              : `${formatLoadPoints(session.trainingLoadPoints)} pts`}
          </strong>
        </div>
      </header>

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
  workouts,
}: {
  bodyweightEntries: BodyweightEntry[]
  bodyweightTrackingEnabled: boolean
  exercises: Exercise[]
  workouts: RecentWorkoutItem[]
}) {
  const [visibleWorkouts, setVisibleWorkouts] = useState(PAGE_SIZE)
  const [weightOpen, setWeightOpen] = useState(false)
  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  )
  const sortedWeights = [...bodyweightEntries].sort((left, right) =>
    right.date.localeCompare(left.date),
  )

  return (
    <>
      <Section eyebrow="Training record" title="Past workouts">
        {workouts.length === 0 ? (
          <p className="muted-text">
            Your completed workouts will appear here after the first session is
            saved.
          </p>
        ) : (
          <>
            <div className="workout-card-list">
              {workouts.slice(0, visibleWorkouts).map((session) => (
                <WorkoutCard
                  key={session.id}
                  exerciseById={exerciseById}
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
