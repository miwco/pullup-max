import { useState, type FormEvent } from 'react'
import { Section } from '../../components/Section'
import type { GreaseGrooveEntry } from '../../domain/types'
import { getGreaseGrooveTrainingLoadPoints } from '../../domain/volume'
import { formatLongDate, todayDateString } from '../../lib/date'

interface GreaseGrooveHistoryProps {
  entries: GreaseGrooveEntry[]
  onDelete: (entryId: string) => Promise<boolean>
  onUpdate: (entryId: string, reps: number, date: string) => Promise<boolean>
}

interface EditState {
  date: string
  entryId: string
  reps: string
}

function formatTime(dateTime: string) {
  return new Date(dateTime).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function GreaseGrooveHistory({
  entries,
  onDelete,
  onUpdate,
}: GreaseGrooveHistoryProps) {
  const [editState, setEditState] = useState<EditState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const sortedEntries = entries.toSorted(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      right.loggedAt.localeCompare(left.loggedAt),
  )

  if (entries.length === 0) {
    return null
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editState || isSaving) {
      return
    }

    const reps = Number(editState.reps)
    if (!Number.isInteger(reps) || reps <= 0) {
      setError('Enter a whole number of reps.')
      return
    }

    if (!editState.date || editState.date > todayDateString()) {
      setError('Choose today or an earlier date.')
      return
    }

    setError(null)
    setIsSaving(true)
    const saved = await onUpdate(editState.entryId, reps, editState.date)
    setIsSaving(false)

    if (saved) {
      setEditState(null)
    }
  }

  return (
    <Section
      eyebrow="Light practice"
      title="GG history"
      className="section--compact"
    >
      <p className="muted-text">
        GG remains separate from workout cards, but corrections here immediately
        update training load and max-day freshness.
      </p>
      <ul className="gg-history-list">
        {sortedEntries.map((entry) => {
          const isEditing = editState?.entryId === entry.id

          return (
            <li key={entry.id} className="gg-history-row">
              {isEditing ? (
                <form
                  className="gg-history-edit"
                  onSubmit={(event) => void handleUpdate(event)}
                >
                  <label className="field">
                    <span>Date</span>
                    <input
                      type="date"
                      max={todayDateString()}
                      value={editState.date}
                      onChange={(event) =>
                        setEditState({
                          ...editState,
                          date: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Reps</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={editState.reps}
                      onChange={(event) =>
                        setEditState({
                          ...editState,
                          reps: event.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="gg-history-edit__actions">
                    <button
                      type="submit"
                      className="button button--primary button--compact"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--compact"
                      disabled={isSaving}
                      onClick={() => {
                        setEditState(null)
                        setError(null)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {error ? (
                    <p className="field-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </form>
              ) : (
                <>
                  <div className="gg-history-row__summary">
                    <strong>{entry.reps} reps</strong>
                    <span>
                      {formatLongDate(entry.date)} at{' '}
                      {formatTime(entry.loggedAt)}
                    </span>
                    <span>
                      {getGreaseGrooveTrainingLoadPoints(entry.reps)} load
                      points
                    </span>
                  </div>
                  <div className="gg-history-row__actions">
                    <button
                      type="button"
                      className="button button--ghost button--compact"
                      aria-label={`Edit ${entry.reps} rep GG set from ${entry.date}`}
                      onClick={() => {
                        setError(null)
                        setEditState({
                          date: entry.date,
                          entryId: entry.id,
                          reps: String(entry.reps),
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--compact"
                      aria-label={`Delete ${entry.reps} rep GG set from ${entry.date}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete the ${entry.reps}-rep GG set from ${formatLongDate(entry.date)}?`,
                          )
                        ) {
                          void onDelete(entry.id)
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
