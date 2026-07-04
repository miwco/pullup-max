import { useMemo, useState, type FormEvent } from 'react'
import { useAppState } from '../../app/appContext'
import { Section } from '../../components/Section'
import { getGreaseGrooveTrainingLoadPoints } from '../../domain/volume'
import { todayDateString } from '../../lib/date'

function formatTime(dateTime: string) {
  return new Date(dateTime).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function GreaseGrooveScreen() {
  const { data, deleteGreaseGrooveEntry, saveGreaseGrooveEntry } = useAppState()
  const [reps, setReps] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const today = todayDateString()
  const todaysEntries = useMemo(
    () =>
      data.greaseGrooveEntries
        .filter((entry) => entry.date === today)
        .toSorted((left, right) => right.loggedAt.localeCompare(left.loggedAt)),
    [data.greaseGrooveEntries, today],
  )
  const totalReps = todaysEntries.reduce((sum, entry) => sum + entry.reps, 0)
  const baselineMax = data.recommendationState.baselineMax
  const suggestedRange = baselineMax
    ? {
        min: Math.max(1, Math.floor(baselineMax * 0.4)),
        max: Math.max(1, Math.floor(baselineMax * 0.6)),
      }
    : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedReps = Number(reps)

    if (!Number.isInteger(parsedReps) || parsedReps <= 0) {
      setError('Enter a whole number of reps.')
      return
    }

    setError(null)
    setIsSaving(true)
    const saved = await saveGreaseGrooveEntry(parsedReps)
    setIsSaving(false)

    if (saved) {
      setReps('')
    }
  }

  return (
    <div className="screen-stack grease-groove-screen">
      <Section eyebrow="Light practice" title="Grease the groove">
        <p className="gg-guidance">
          Keep every set very easy - about 40-60% of your max. Stop well before
          fatigue; this is movement practice, not a workout set.
        </p>

        {suggestedRange ? (
          <p className="gg-suggestion">
            Suggested now:{' '}
            <strong>
              {suggestedRange.min}-{suggestedRange.max} reps
            </strong>
          </p>
        ) : (
          <p className="muted-text">
            Log a max set to get a suggested rep range.
          </p>
        )}

        <form
          className="gg-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label className="field gg-reps-field">
            <span>Reps</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              aria-describedby={error ? 'gg-reps-error' : undefined}
            />
          </label>
          <button
            type="submit"
            className="button button--primary gg-add-button"
            disabled={isSaving}
          >
            {isSaving ? 'Adding...' : 'Add set'}
          </button>
        </form>

        {error ? (
          <p id="gg-reps-error" className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </Section>

      <Section eyebrow="Today" title={`${totalReps} reps`}>
        <div className="gg-totals" aria-label="Today's GG totals">
          <span>
            {todaysEntries.length} set{todaysEntries.length === 1 ? '' : 's'}
          </span>
          <span>
            {getGreaseGrooveTrainingLoadPoints(totalReps)} load points
          </span>
        </div>

        {todaysEntries.length > 0 ? (
          <ul className="gg-entry-list">
            {todaysEntries.map((entry) => (
              <li key={entry.id} className="gg-entry-row">
                <div>
                  <strong>{entry.reps} reps</strong>
                  <span>{formatTime(entry.loggedAt)}</span>
                </div>
                <button
                  type="button"
                  className="button button--ghost button--compact"
                  onClick={() => void deleteGreaseGrooveEntry(entry.id)}
                  aria-label={`Remove ${entry.reps} rep GG set`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No GG sets logged today.</p>
        )}

        <p className="gg-freshness-note">
          GG adds light training load and counts as pull-up work for max-day
          freshness.
        </p>
      </Section>
    </div>
  )
}
