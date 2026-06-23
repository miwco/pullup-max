import { useEffect, useMemo, useState } from 'react'
import { AccordionSection } from '../../components/AccordionSection'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/appContext'
import type {
  BodyweightOption,
  Exercise,
  ProgramBlock,
  ProgramStep,
  ProgramTemplate,
} from '../../domain/types'
import { createId } from '../../lib/id'
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'
import { ExerciseLibraryManager } from '../exercise-library/ExerciseLibraryManager'
import { summarizeProgramBlock } from './programBlockSummary'

type WeakBlockKey = 'top' | 'middle' | 'start/bottom'

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

function createStepFromExercise(exercise: Exercise): ProgramStep {
  const baseStep: ProgramStep = {
    id: createId('step'),
    title: exercise.name,
    exerciseId: exercise.id,
    notes: '',
  }

  if (exercise.tags.includes('emom')) {
    return {
      ...baseStep,
      sets: 10,
      reps: 3,
      emomMinutes: 10,
      emomReps: 3,
      bodyweightOption: 'bodyweight',
    }
  }

  if (exercise.defaultUnit === 'seconds') {
    return {
      ...baseStep,
      sets: 2,
      holdSeconds: 20,
    }
  }

  if (exercise.defaultUnit === 'minutes') {
    return {
      ...baseStep,
      durationSeconds: 60,
    }
  }

  return {
    ...baseStep,
    sets: 2,
    reps: 4,
  }
}

function updateStepExercise(
  step: ProgramStep,
  exercise: Exercise,
): ProgramStep {
  const nextStep = createStepFromExercise(exercise)

  return {
    ...nextStep,
    id: step.id,
    notes: step.notes,
  }
}

function updateProgramBlockStep(
  block: ProgramBlock,
  stepIndex: number,
  nextStep: ProgramStep,
) {
  return {
    ...block,
    steps: block.steps.map((step, index) =>
      index === stepIndex ? nextStep : step,
    ),
  }
}

function removeProgramBlockStep(block: ProgramBlock, stepIndex: number) {
  return {
    ...block,
    steps: block.steps.filter((_, index) => index !== stepIndex),
  }
}

function appendProgramBlockStep(block: ProgramBlock, step: ProgramStep) {
  return {
    ...block,
    steps: [...block.steps, step],
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

interface ProgramWorkoutBlockConfig {
  addTarget?: boolean
  block: ProgramBlock
  id: string
  isShared?: boolean
  title: string
  onChange: (nextBlock: ProgramBlock) => void
}

function ProgramWorkoutEditor({
  activeExercises,
  blocks,
}: {
  activeExercises: Exercise[]
  blocks: ProgramWorkoutBlockConfig[]
}) {
  const [openAdvancedStepId, setOpenAdvancedStepId] = useState<string | null>(
    null,
  )
  const [exerciseIdToAdd, setExerciseIdToAdd] = useState(
    () => activeExercises[0]?.id ?? '',
  )
  const exerciseById = useMemo(
    () => new Map(activeExercises.map((exercise) => [exercise.id, exercise])),
    [activeExercises],
  )
  const addTargetBlock =
    blocks.find((blockConfig) => blockConfig.addTarget) ??
    blocks[blocks.length - 1]
  const totalStepCount = blocks.reduce(
    (sum, blockConfig) => sum + blockConfig.block.steps.length,
    0,
  )

  function addExercise() {
    const exercise = exerciseById.get(exerciseIdToAdd)

    if (!exercise || !addTargetBlock) {
      return
    }

    addTargetBlock.onChange(
      appendProgramBlockStep(
        addTargetBlock.block,
        createStepFromExercise(exercise),
      ),
    )
  }

  return (
    <div className="program-workout-editor">
      <div className="entry-list">
        {totalStepCount === 0 ? (
          <p className="muted-text">No exercises in this workout yet.</p>
        ) : null}

        {blocks.flatMap((blockConfig) =>
          blockConfig.block.steps.map((step, index) => {
            const visibleFields = createStepFieldVisibility(step)

            return (
              <div key={step.id} className="entry-row entry-row--compact">
                <div className="field field--span-2">
                  <span>
                    {blockConfig.isShared
                      ? 'Shared support exercise'
                      : 'Exercise'}
                  </span>
                  <strong>{step.title || `Exercise ${index + 1}`}</strong>
                  {blockConfig.isShared ? (
                    <small>Used in every support workout</small>
                  ) : null}
                </div>

                <label className="field field--span-2">
                  <span>Choose from library</span>
                  <select
                    value={step.exerciseId}
                    onChange={(event) => {
                      const exercise = exerciseById.get(event.target.value)

                      if (!exercise) {
                        return
                      }

                      blockConfig.onChange(
                        updateProgramBlockStep(
                          blockConfig.block,
                          index,
                          updateStepExercise(step, exercise),
                        ),
                      )
                    }}
                  >
                    {activeExercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field field--span-2">
                  <span>Label</span>
                  <input
                    value={step.title}
                    onChange={(event) =>
                      blockConfig.onChange(
                        updateProgramBlock(
                          blockConfig.block,
                          index,
                          'title',
                          event.target.value,
                        ),
                      )
                    }
                  />
                </label>

                {visibleFields.sets ? (
                  <label className="field">
                    <span>Sets</span>
                    <input
                      inputMode="numeric"
                      value={step.sets ?? ''}
                      onChange={(event) =>
                        blockConfig.onChange(
                          updateProgramBlock(
                            blockConfig.block,
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
                        blockConfig.onChange(
                          updateProgramBlock(
                            blockConfig.block,
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
                        blockConfig.onChange(
                          updateProgramBlock(
                            blockConfig.block,
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
                        blockConfig.onChange(
                          updateProgramBlock(
                            blockConfig.block,
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
                        blockConfig.onChange(
                          updateProgramBlock(
                            blockConfig.block,
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
                        blockConfig.onChange(
                          updateProgramBlock(
                            blockConfig.block,
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
                        blockConfig.onChange(
                          updateProgramBlock(
                            blockConfig.block,
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
                        blockConfig.onChange(
                          updateProgramBlock(
                            blockConfig.block,
                            index,
                            'emomReps',
                            event.target.value,
                          ),
                        )
                      }
                    />
                  </label>
                ) : null}

                <label className="field field--span-2">
                  <span>Notes</span>
                  <input
                    value={step.notes}
                    onChange={(event) =>
                      blockConfig.onChange(
                        updateProgramBlock(
                          blockConfig.block,
                          index,
                          'notes',
                          event.target.value,
                        ),
                      )
                    }
                  />
                </label>

                <div className="field field--span-2">
                  <AccordionSection
                    eyebrow="Optional"
                    title={`Step settings ${index + 1}`}
                    isOpen={openAdvancedStepId === step.id}
                    onToggle={() =>
                      setOpenAdvancedStepId((current) =>
                        current === step.id ? null : step.id,
                      )
                    }
                    summary="Band and bodyweight behavior"
                  >
                    <div className="field-grid field-grid--compact">
                      <label className="field">
                        <span>Bodyweight / band</span>
                        <select
                          value={step.bodyweightOption ?? ''}
                          onChange={(event) =>
                            blockConfig.onChange(
                              updateProgramBlock(
                                blockConfig.block,
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
                            blockConfig.onChange(
                              updateProgramBlock(
                                blockConfig.block,
                                index,
                                'bandAllowed',
                                event.target.checked,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                  </AccordionSection>
                </div>

                <div className="action-row action-row--end field--span-2">
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    onClick={() =>
                      blockConfig.onChange(
                        removeProgramBlockStep(blockConfig.block, index),
                      )
                    }
                  >
                    Remove exercise
                  </button>
                </div>
              </div>
            )
          }),
        )}
      </div>

      <div className="field-grid field-grid--compact program-workout-add">
        <label className="field field--span-2">
          <span>Add from library</span>
          <select
            value={exerciseIdToAdd}
            onChange={(event) => setExerciseIdToAdd(event.target.value)}
          >
            {activeExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
        <div className="action-row action-row--end">
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={addExercise}
            disabled={!addTargetBlock}
          >
            Add exercise
          </button>
        </div>
      </div>
    </div>
  )
}

interface ProgramWorkoutConfig {
  blocks: ProgramWorkoutBlockConfig[]
  eyebrow: string
  id: string
  summary: string
  title: string
}

function combineBlocksForSummary(
  title: string,
  blocks: ProgramWorkoutBlockConfig[],
): ProgramBlock {
  return {
    title,
    steps: blocks.flatMap((blockConfig) => blockConfig.block.steps),
  }
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
  const [openProgramWorkoutId, setOpenProgramWorkoutId] = useState<
    string | null
  >(null)
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
    await saveSettingsAndProgram(
      data.athleteProfile,
      data.settings,
      programTemplate,
    )
    setIsSaving(false)
  }

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

  const programWorkouts: ProgramWorkoutConfig[] = [
    {
      id: 'max-day',
      eyebrow: 'Max day',
      title: 'Max day workout',
      summary: 'The workout used on max-test days',
      blocks: [
        {
          id: 'max-warmup',
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
          id: 'max-volume-block',
          title: programTemplate.maxDay.volumeBlock.title,
          block: programTemplate.maxDay.volumeBlock,
          addTarget: true,
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
      ],
    },
    {
      id: 'support-top',
      eyebrow: 'Support day',
      title: 'Top support workout',
      summary: 'Use when the top of the pull-up is the weak point',
      blocks: [
        {
          id: 'support-base-top',
          title: programTemplate.supportDayBase.title,
          block: programTemplate.supportDayBase,
          isShared: true,
          onChange: (nextBlock: ProgramBlock) =>
            setProgramTemplate((current) => ({
              ...current,
              supportDayBase: nextBlock,
            })),
        },
        {
          id: 'weak-top',
          title: programTemplate.weakPointBlocks.top.title,
          block: programTemplate.weakPointBlocks.top,
          addTarget: true,
          onChange: (nextBlock: ProgramBlock) => setWeakBlock('top', nextBlock),
        },
      ],
    },
    {
      id: 'support-middle',
      eyebrow: 'Support day',
      title: 'Middle support workout',
      summary: 'Use when the middle range is the weak point',
      blocks: [
        {
          id: 'support-base-middle',
          title: programTemplate.supportDayBase.title,
          block: programTemplate.supportDayBase,
          isShared: true,
          onChange: (nextBlock: ProgramBlock) =>
            setProgramTemplate((current) => ({
              ...current,
              supportDayBase: nextBlock,
            })),
        },
        {
          id: 'weak-middle',
          title: programTemplate.weakPointBlocks.middle.title,
          block: programTemplate.weakPointBlocks.middle,
          addTarget: true,
          onChange: (nextBlock: ProgramBlock) =>
            setWeakBlock('middle', nextBlock),
        },
      ],
    },
    {
      id: 'support-low',
      eyebrow: 'Support day',
      title: 'Low support workout',
      summary: 'Use when the start or bottom is the weak point',
      blocks: [
        {
          id: 'support-base-low',
          title: programTemplate.supportDayBase.title,
          block: programTemplate.supportDayBase,
          isShared: true,
          onChange: (nextBlock: ProgramBlock) =>
            setProgramTemplate((current) => ({
              ...current,
              supportDayBase: nextBlock,
            })),
        },
        {
          id: 'weak-low',
          title: programTemplate.weakPointBlocks['start/bottom'].title,
          block: programTemplate.weakPointBlocks['start/bottom'],
          addTarget: true,
          onChange: (nextBlock: ProgramBlock) =>
            setWeakBlock('start/bottom', nextBlock),
        },
      ],
    },
  ]

  return (
    <div className="screen-stack">
      <form className="screen-stack" onSubmit={handleSave}>
        <Section eyebrow="Program editor" title="Editable defaults">
          <p className="muted-text">
            Open one workout, then edit its exercises. You can choose from the
            current library, add rows, or remove rows without changing the
            exercise library itself.
          </p>

          <div className="accordion-stack">
            {programWorkouts.map((workout) => {
              const summaryBlock = combineBlocksForSummary(
                workout.title,
                workout.blocks,
              )

              return (
                <AccordionSection
                  key={workout.id}
                  eyebrow={workout.eyebrow}
                  title={workout.title}
                  isOpen={openProgramWorkoutId === workout.id}
                  onToggle={() =>
                    setOpenProgramWorkoutId((current) =>
                      current === workout.id ? null : workout.id,
                    )
                  }
                  summary={`${workout.summary}. ${summarizeProgramBlock(
                    summaryBlock,
                    exerciseNameById,
                  )}`}
                >
                  <ProgramWorkoutEditor
                    activeExercises={activeExercises}
                    blocks={workout.blocks}
                  />
                </AccordionSection>
              )
            })}
          </div>

          <div className="action-row action-row--end">
            <button
              type="submit"
              className="button button--primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save settings & program'}
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
