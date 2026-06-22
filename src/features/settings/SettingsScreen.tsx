import { useEffect, useMemo, useState } from 'react'
import { AccordionSection } from '../../components/AccordionSection'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/appContext'
import type {
  BodyweightOption,
  ProgramBlock,
  ProgramStep,
  ProgramTemplate,
} from '../../domain/types'
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'
import { ExerciseLibraryManager } from '../exercise-library/ExerciseLibraryManager'
import { summarizeProgramBlock } from './programBlockSummary'

type WeakBlockKey = 'top' | 'middle' | 'start/bottom' | 'grip'

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const nextNumber = Number(value)
  return Number.isFinite(nextNumber) ? nextNumber : undefined
}

function updateStep(
  step: ProgramStep,
  field: keyof ProgramStep,
  rawValue: string | boolean,
) {
  if (
    field === 'sets' ||
    field === 'reps' ||
    field === 'minReps' ||
    field === 'maxReps' ||
    field === 'holdSeconds' ||
    field === 'durationSeconds' ||
    field === 'emomMinutes' ||
    field === 'emomReps'
  ) {
    return {
      ...step,
      [field]: parseOptionalNumber(String(rawValue)),
    }
  }

  return {
    ...step,
    [field]: rawValue,
  }
}

function updateProgramBlock(
  block: ProgramBlock,
  stepIndex: number,
  field: keyof ProgramStep,
  rawValue: string | boolean,
) {
  return {
    ...block,
    steps: block.steps.map((step, index) =>
      index === stepIndex ? updateStep(step, field, rawValue) : step,
    ),
  }
}

interface StepFieldVisibility {
  durationSeconds: boolean
  emomMinutes: boolean
  emomReps: boolean
  holdSeconds: boolean
  maxReps: boolean
  minReps: boolean
  reps: boolean
  sets: boolean
}

function createStepFieldVisibility(step: ProgramStep): StepFieldVisibility {
  return {
    sets: typeof step.sets === 'number',
    reps: typeof step.reps === 'number',
    minReps: typeof step.minReps === 'number',
    maxReps: typeof step.maxReps === 'number',
    holdSeconds: typeof step.holdSeconds === 'number',
    durationSeconds: typeof step.durationSeconds === 'number',
    emomMinutes: typeof step.emomMinutes === 'number',
    emomReps: typeof step.emomReps === 'number',
  }
}

function ProgramBlockEditor({
  activeExerciseOptions,
  block,
  onChange,
}: {
  activeExerciseOptions: Array<{ id: string; name: string }>
  block: ProgramBlock
  onChange: (nextBlock: ProgramBlock) => void
}) {
  const [fieldVisibilityByStepId] = useState<
    Record<string, StepFieldVisibility>
  >(() =>
    Object.fromEntries(
      block.steps.map((step) => [step.id, createStepFieldVisibility(step)]),
    ),
  )

  return (
    <div className="entry-list">
      {block.steps.map((step, index) => {
        const visibleFields =
          fieldVisibilityByStepId[step.id] ?? createStepFieldVisibility(step)

        return (
          <div key={step.id} className="entry-row entry-row--compact">
            <div className="field field--span-2">
              <span>Step</span>
              <strong>{step.title || `Step ${index + 1}`}</strong>
            </div>

            <label className="field field--span-2">
              <span>Step label</span>
              <input
                value={step.title}
                onChange={(event) =>
                  onChange(
                    updateProgramBlock(
                      block,
                      index,
                      'title',
                      event.target.value,
                    ),
                  )
                }
              />
            </label>

            <label className="field field--span-2">
              <span>Exercise</span>
              <select
                value={step.exerciseId}
                onChange={(event) =>
                  onChange(
                    updateProgramBlock(
                      block,
                      index,
                      'exerciseId',
                      event.target.value,
                    ),
                  )
                }
              >
                {activeExerciseOptions.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </label>

            {visibleFields.sets ? (
              <label className="field">
                <span>Sets</span>
                <input
                  inputMode="numeric"
                  value={step.sets ?? ''}
                  onChange={(event) =>
                    onChange(
                      updateProgramBlock(
                        block,
                        index,
                        'sets',
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            {visibleFields.reps ? (
              <label className="field">
                <span>Reps</span>
                <input
                  inputMode="numeric"
                  value={step.reps ?? ''}
                  onChange={(event) =>
                    onChange(
                      updateProgramBlock(
                        block,
                        index,
                        'reps',
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            {visibleFields.minReps ? (
              <label className="field">
                <span>Min reps</span>
                <input
                  inputMode="numeric"
                  value={step.minReps ?? ''}
                  onChange={(event) =>
                    onChange(
                      updateProgramBlock(
                        block,
                        index,
                        'minReps',
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            {visibleFields.maxReps ? (
              <label className="field">
                <span>Max reps</span>
                <input
                  inputMode="numeric"
                  value={step.maxReps ?? ''}
                  onChange={(event) =>
                    onChange(
                      updateProgramBlock(
                        block,
                        index,
                        'maxReps',
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            {visibleFields.holdSeconds ? (
              <label className="field">
                <span>Hold sec</span>
                <input
                  inputMode="numeric"
                  value={step.holdSeconds ?? ''}
                  onChange={(event) =>
                    onChange(
                      updateProgramBlock(
                        block,
                        index,
                        'holdSeconds',
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            {visibleFields.durationSeconds ? (
              <label className="field">
                <span>Duration sec</span>
                <input
                  inputMode="numeric"
                  value={step.durationSeconds ?? ''}
                  onChange={(event) =>
                    onChange(
                      updateProgramBlock(
                        block,
                        index,
                        'durationSeconds',
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            {visibleFields.emomMinutes ? (
              <label className="field">
                <span>EMOM min</span>
                <input
                  inputMode="numeric"
                  value={step.emomMinutes ?? ''}
                  onChange={(event) =>
                    onChange(
                      updateProgramBlock(
                        block,
                        index,
                        'emomMinutes',
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            {visibleFields.emomReps ? (
              <label className="field">
                <span>EMOM reps</span>
                <input
                  inputMode="numeric"
                  value={step.emomReps ?? ''}
                  onChange={(event) =>
                    onChange(
                      updateProgramBlock(
                        block,
                        index,
                        'emomReps',
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>
            ) : null}

            <label className="field">
              <span>Bodyweight / band</span>
              <select
                value={step.bodyweightOption ?? ''}
                onChange={(event) =>
                  onChange(
                    updateProgramBlock(
                      block,
                      index,
                      'bodyweightOption',
                      event.target.value as BodyweightOption,
                    ),
                  )
                }
              >
                <option value="">n/a</option>
                <option value="bodyweight">bodyweight</option>
                <option value="band">band</option>
                <option value="either">either</option>
              </select>
            </label>

            <label className="field field--checkbox">
              <span>Band allowed</span>
              <input
                type="checkbox"
                checked={step.bandAllowed ?? false}
                onChange={(event) =>
                  onChange(
                    updateProgramBlock(
                      block,
                      index,
                      'bandAllowed',
                      event.target.checked,
                    ),
                  )
                }
              />
            </label>

            <label className="field field--span-2">
              <span>Notes</span>
              <input
                value={step.notes}
                onChange={(event) =>
                  onChange(
                    updateProgramBlock(
                      block,
                      index,
                      'notes',
                      event.target.value,
                    ),
                  )
                }
              />
            </label>
          </div>
        )
      })}
    </div>
  )
}

interface ProgramBlockConfig {
  block: ProgramBlock
  eyebrow: string
  id: string
  title: string
  onChange: (nextBlock: ProgramBlock) => void
}

export function SettingsScreen({
  initialLibraryOpen = false,
}: {
  initialLibraryOpen?: boolean
}) {
  const { activeExercises, data, saveSettingsAndProgram } = useAppState()
  const [programTemplate, setProgramTemplate] = useState<ProgramTemplate>(
    structuredClone(data.programTemplate),
  )
  const [openProgramBlockId, setOpenProgramBlockId] = useState<string | null>(
    null,
  )
  const [isLibraryOpen, setIsLibraryOpen] = useState(() => initialLibraryOpen)
  const [libraryDraftDirty, setLibraryDraftDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const hasProgramChanges =
    JSON.stringify(programTemplate) !== JSON.stringify(data.programTemplate)
  const isDirty = hasProgramChanges || libraryDraftDirty

  useUnsavedChangesPrompt(isDirty)

  useEffect(() => {
    if (hasProgramChanges || libraryDraftDirty) {
      return
    }

    queueMicrotask(() => {
      setProgramTemplate(structuredClone(data.programTemplate))
    })
  }, [data, hasProgramChanges, libraryDraftDirty])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving) {
      return
    }

    setIsSaving(true)
    await saveSettingsAndProgram(data.athleteProfile, data.settings, programTemplate)
    setIsSaving(false)
  }

  const exerciseOptions = activeExercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
  }))
  const exerciseNameById = useMemo(
    () =>
      new Map(data.exercises.map((exercise) => [exercise.id, exercise.name])),
    [data.exercises],
  )

  function setWeakBlock(blockKey: WeakBlockKey, nextBlock: ProgramBlock) {
    setProgramTemplate((current) => ({
      ...current,
      weakPointBlocks: {
        ...current.weakPointBlocks,
        [blockKey]: nextBlock,
      },
    }))
  }

  const programBlocks: ProgramBlockConfig[] = [
    {
      id: 'max-warmup',
      eyebrow: 'Max day',
      title: programTemplate.maxDay.warmup.title,
      block: programTemplate.maxDay.warmup,
      onChange: (nextBlock: ProgramBlock) =>
        setProgramTemplate((current) => ({
          ...current,
          maxDay: {
            ...current.maxDay,
            warmup: nextBlock,
          },
        })),
    },
    {
      id: 'max-main-set',
      eyebrow: 'Max day',
      title: programTemplate.maxDay.mainSet.title,
      block: programTemplate.maxDay.mainSet,
      onChange: (nextBlock: ProgramBlock) =>
        setProgramTemplate((current) => ({
          ...current,
          maxDay: {
            ...current.maxDay,
            mainSet: nextBlock,
          },
        })),
    },
    {
      id: 'max-volume-block',
      eyebrow: 'Max day',
      title: programTemplate.maxDay.volumeBlock.title,
      block: programTemplate.maxDay.volumeBlock,
      onChange: (nextBlock: ProgramBlock) =>
        setProgramTemplate((current) => ({
          ...current,
          maxDay: {
            ...current.maxDay,
            volumeBlock: nextBlock,
          },
        })),
    },
    {
      id: 'max-finisher',
      eyebrow: 'Max day',
      title: programTemplate.maxDay.finisher.title,
      block: programTemplate.maxDay.finisher,
      onChange: (nextBlock: ProgramBlock) =>
        setProgramTemplate((current) => ({
          ...current,
          maxDay: {
            ...current.maxDay,
            finisher: nextBlock,
          },
        })),
    },
    {
      id: 'support-base',
      eyebrow: 'Support day',
      title: programTemplate.supportDayBase.title,
      block: programTemplate.supportDayBase,
      onChange: (nextBlock: ProgramBlock) =>
        setProgramTemplate((current) => ({
          ...current,
          supportDayBase: nextBlock,
        })),
    },
    {
      id: 'support-fallback',
      eyebrow: 'Support day',
      title: programTemplate.supportFallback.title,
      block: programTemplate.supportFallback,
      onChange: (nextBlock: ProgramBlock) =>
        setProgramTemplate((current) => ({
          ...current,
          supportFallback: nextBlock,
        })),
    },
    ...(['top', 'middle', 'start/bottom', 'grip'] as WeakBlockKey[]).map(
      (blockKey) => ({
        id: `weak-${blockKey}`,
        eyebrow: 'Weak point',
        title: programTemplate.weakPointBlocks[blockKey].title,
        block: programTemplate.weakPointBlocks[blockKey],
        onChange: (nextBlock: ProgramBlock) =>
          setWeakBlock(blockKey, nextBlock),
      }),
    ),
  ].filter((programBlock) => programBlock.block.steps.length > 0)

  return (
    <div className="screen-stack">
      <form className="screen-stack" onSubmit={handleSave}>
        <Section eyebrow="Program editor" title="Editable defaults">
          <p className="muted-text">
            Keep the stack closed until you need it. Each block shows a quick
            summary from the current prescription.
          </p>

          <div className="accordion-stack">
            {programBlocks.map((programBlock) => (
              <AccordionSection
                key={programBlock.id}
                eyebrow={programBlock.eyebrow}
                title={programBlock.title}
                isOpen={openProgramBlockId === programBlock.id}
                onToggle={() =>
                  setOpenProgramBlockId((current) =>
                    current === programBlock.id ? null : programBlock.id,
                  )
                }
                summary={summarizeProgramBlock(
                  programBlock.block,
                  exerciseNameById,
                )}
              >
                <ProgramBlockEditor
                  activeExerciseOptions={exerciseOptions}
                  block={programBlock.block}
                  onChange={programBlock.onChange}
                />
              </AccordionSection>
            ))}
          </div>

          <div className="action-row action-row--end">
            <button
              type="submit"
              className="button button--primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save settings & program'}
            </button>
          </div>
        </Section>

        <Section eyebrow="Program" title="Exercise library">
          <AccordionSection
            eyebrow="Defaults and custom"
            title="Manage exercises"
            isOpen={isLibraryOpen}
            onToggle={() => setIsLibraryOpen((current) => !current)}
            summary="Search, add, edit, archive, or remove exercises"
          >
            <ExerciseLibraryManager onDirtyChange={setLibraryDraftDirty} />
          </AccordionSection>
        </Section>
      </form>
    </div>
  )
}
