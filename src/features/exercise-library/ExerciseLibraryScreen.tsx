import { useDeferredValue, useState } from 'react'
import { AccordionSection } from '../../components/AccordionSection'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/AppProvider'
import type { DefaultUnit, ExerciseType } from '../../domain/types'
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'

interface ExerciseDraft {
  active: boolean
  builtIn: boolean
  defaultUnit: DefaultUnit
  id?: string
  name: string
  tags: string
  type: ExerciseType
}

function createBlankExercise(): ExerciseDraft {
  return {
    name: '',
    type: 'custom',
    active: true,
    builtIn: false,
    defaultUnit: 'reps',
    tags: '',
  }
}

export function ExerciseLibraryScreen() {
  const { data, deleteExercise, updateExercise } = useAppState()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [draft, setDraft] = useState<ExerciseDraft>(createBlankExercise())
  const [draftBaseline, setDraftBaseline] = useState<ExerciseDraft>(
    createBlankExercise(),
  )
  const [showEditor, setShowEditor] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const isDraftDirty =
    showEditor && JSON.stringify(draft) !== JSON.stringify(draftBaseline)

  useUnsavedChangesPrompt(isDraftDirty)

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

  function canDiscardDraft() {
    return (
      !isDraftDirty || window.confirm('Discard the current exercise edits?')
    )
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.name.trim() || isSaving) {
      return
    }

    setIsSaving(true)

    await updateExercise({
      id: draft.id,
      name: draft.name.trim(),
      type: draft.type,
      active: draft.active,
      builtIn: draft.builtIn,
      defaultUnit: draft.defaultUnit,
      tags: draft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })

    const blankDraft = createBlankExercise()
    setDraft(blankDraft)
    setDraftBaseline(blankDraft)
    setShowEditor(false)
    setIsSaving(false)
  }

  return (
    <div className="screen-stack">
      <Section eyebrow="Defaults and custom" title="Exercise library">
        <div className="summary-bar">
          <div className="field">
            <span>Search</span>
            <input
              type="search"
              name="exercise-search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search exercises or tags..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              if (showEditor && !canDiscardDraft()) {
                return
              }

              const blankDraft = createBlankExercise()
              setDraft(blankDraft)
              setDraftBaseline(blankDraft)
              setShowEditor((current) => !current)
            }}
          >
            {showEditor ? 'Hide editor' : 'Add exercise'}
          </button>
        </div>
      </Section>

      <Section
        eyebrow="Add or edit"
        title={draft.id ? 'Edit exercise' : 'Add exercise'}
      >
        <AccordionSection
          eyebrow="Compact editor"
          title={draft.id ? 'Edit exercise' : 'Create exercise'}
          isOpen={showEditor || Boolean(draft.id)}
          onToggle={() => {
            if (showEditor && !canDiscardDraft()) {
              return
            }

            setShowEditor((current) => !current)
          }}
          summary="Name, category, unit, tags, and status"
        >
          <form className="form-stack" onSubmit={handleSave}>
            <div className="field-grid field-grid--compact">
              <label className="field field--span-2">
                <span>Name</span>
                <input
                  name="exercise-name"
                  autoComplete="off"
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
                <span>Category</span>
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
                  name="exercise-tags"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="hang, endurance, band-assisted..."
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

            <div className="action-row">
              <button type="submit" className="button button--primary">
                {isSaving
                  ? 'Saving...'
                  : draft.id
                    ? 'Save exercise'
                    : 'Add exercise'}
              </button>
              {draft.id ? (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => {
                    if (!canDiscardDraft()) {
                      return
                    }

                    const blankDraft = createBlankExercise()
                    setDraft(blankDraft)
                    setDraftBaseline(blankDraft)
                    setShowEditor(false)
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </AccordionSection>
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
                    {exercise.builtIn ? (
                      <span className="chip">built-in</span>
                    ) : null}
                    {!exercise.active ? (
                      <span className="chip">archived</span>
                    ) : null}
                  </div>
                </div>

                <div className="button-row button-row--wrap">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      if (showEditor && !canDiscardDraft()) {
                        return
                      }

                      const nextDraft = {
                        id: exercise.id,
                        name: exercise.name,
                        type: exercise.type,
                        active: exercise.active,
                        builtIn: exercise.builtIn,
                        defaultUnit: exercise.defaultUnit,
                        tags: exercise.tags.join(', '),
                      }
                      setDraft(nextDraft)
                      setDraftBaseline(nextDraft)
                      setShowEditor(true)
                    }}
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
                    onClick={() => {
                      if (window.confirm(`Remove ${exercise.name}?`)) {
                        void deleteExercise(exercise.id)
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {exercise.tags.length > 0 ? (
                <p className="muted-text">{exercise.tags.join(' / ')}</p>
              ) : null}
            </article>
          ))}
        </div>
      </Section>
    </div>
  )
}
