import { useDeferredValue, useState } from 'react'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/AppProvider'
import type { DefaultUnit, ExerciseType } from '../../domain/types'

interface ExerciseDraft {
  active: boolean
  defaultUnit: DefaultUnit
  id?: string
  name: string
  tags: string
  type: ExerciseType
}

function createBlankExercise(): ExerciseDraft {
  return {
    name: '',
    type: 'support',
    active: true,
    defaultUnit: 'reps',
    tags: '',
  }
}

export function ExerciseLibraryScreen() {
  const { data, deleteExercise, updateExercise } = useAppState()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [draft, setDraft] = useState<ExerciseDraft>(createBlankExercise())

  const filteredExercises = data.exercises.filter((exercise) => {
    const query = deferredSearch.trim().toLowerCase()

    if (!query) {
      return true
    }

    return (
      exercise.name.toLowerCase().includes(query) ||
      exercise.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  })

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.name.trim()) {
      return
    }

    await updateExercise({
      id: draft.id,
      name: draft.name.trim(),
      type: draft.type,
      active: draft.active,
      defaultUnit: draft.defaultUnit,
      tags: draft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })

    setDraft(createBlankExercise())
  }

  return (
    <div className="screen-stack">
      <Section eyebrow="Editable defaults" title="Exercise library">
        <div className="field">
          <span>Search</span>
          <input
            placeholder="Search exercises or tags"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </Section>

      <Section
        eyebrow="Add or edit"
        title={draft.id ? 'Edit exercise' : 'New exercise'}
      >
        <form className="form-stack" onSubmit={handleSave}>
          <div className="field-grid">
            <label className="field field--span-2">
              <span>Name</span>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Type</span>
              <select
                value={draft.type}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    type: event.target.value as ExerciseType,
                  }))
                }
              >
                <option value="max">max</option>
                <option value="support">support</option>
                <option value="recovery">recovery</option>
                <option value="custom">custom</option>
              </select>
            </label>

            <label className="field">
              <span>Default unit</span>
              <select
                value={draft.defaultUnit}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultUnit: event.target.value as DefaultUnit,
                  }))
                }
              >
                <option value="reps">reps</option>
                <option value="seconds">seconds</option>
                <option value="minutes">minutes</option>
                <option value="sets">sets</option>
              </select>
            </label>

            <label className="field field--span-2">
              <span>Tags</span>
              <input
                placeholder="hang, endurance, band-assisted"
                value={draft.tags}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    tags: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field field--checkbox">
              <span>Active</span>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
              />
            </label>
          </div>

          <div className="button-row">
            <button type="submit" className="button button--primary">
              {draft.id ? 'Save exercise' : 'Add exercise'}
            </button>
            {draft.id ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setDraft(createBlankExercise())}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </Section>

      <Section eyebrow="Current list" title="Exercises">
        <div className="workout-list">
          {filteredExercises.map((exercise) => (
            <article key={exercise.id} className="workout-list__item">
              <div className="workout-list__header">
                <div>
                  <p className="workout-list__date">{exercise.name}</p>
                  <div className="chip-row">
                    <span className="chip">{exercise.type}</span>
                    <span className="chip">{exercise.defaultUnit}</span>
                    {!exercise.active ? (
                      <span className="chip">archived</span>
                    ) : null}
                  </div>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() =>
                      setDraft({
                        id: exercise.id,
                        name: exercise.name,
                        type: exercise.type,
                        active: exercise.active,
                        defaultUnit: exercise.defaultUnit,
                        tags: exercise.tags.join(', '),
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() =>
                      updateExercise({
                        ...exercise,
                        active: !exercise.active,
                      })
                    }
                  >
                    {exercise.active ? 'Archive' : 'Restore'}
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => void deleteExercise(exercise.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {exercise.tags.length > 0 ? (
                <p className="muted-text">{exercise.tags.join(' · ')}</p>
              ) : null}
            </article>
          ))}
        </div>
      </Section>
    </div>
  )
}
