import { useRef, useState } from 'react'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/AppProvider'
import type {
  BodyweightOption,
  ProgramBlock,
  ProgramStep,
  ProgramTemplate,
} from '../../domain/types'
import { todayDateString } from '../../lib/date'

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

function formatStepSummary(
  step: ProgramStep,
  exerciseNames: Map<string, string>,
) {
  const exerciseName =
    exerciseNames.get(step.exerciseId) || step.title || 'Exercise'
  const prescription: string[] = []

  if (step.emomMinutes && step.emomReps) {
    prescription.push(`${step.emomMinutes} min x ${step.emomReps} reps`)
  } else if (step.sets && step.reps) {
    prescription.push(`${step.sets} x ${step.reps}`)
  } else if (step.sets && step.holdSeconds) {
    prescription.push(`${step.sets} x ${step.holdSeconds} sec`)
  } else if (step.durationSeconds) {
    prescription.push(`${step.durationSeconds} sec`)
  } else if (step.minReps && step.maxReps) {
    prescription.push(`${step.minReps}-${step.maxReps} reps`)
  } else if (step.reps) {
    prescription.push(`${step.reps} reps`)
  }

  if (step.bodyweightOption === 'band') {
    prescription.push('band')
  }

  return prescription.length > 0
    ? `${exerciseName} - ${prescription.join(' · ')}`
    : exerciseName
}

function summarizeProgramBlock(
  block: ProgramBlock,
  exerciseNames: Map<string, string>,
) {
  const firstStep = block.steps[0]

  if (!firstStep) {
    return 'No exercises'
  }

  const lead = formatStepSummary(firstStep, exerciseNames)
  return block.steps.length === 1
    ? lead
    : `${lead} · ${block.steps.length} exercises`
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
  return (
    <div className="entry-list">
      {block.steps.map((step, index) => (
        <div key={step.id} className="entry-row entry-row--compact">
          <label className="field field--span-2">
            <span>Step label</span>
            <input
              value={step.title}
              onChange={(event) =>
                onChange(
                  updateProgramBlock(block, index, 'title', event.target.value),
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

          <label className="field">
            <span>Sets</span>
            <input
              inputMode="numeric"
              value={step.sets ?? ''}
              onChange={(event) =>
                onChange(
                  updateProgramBlock(block, index, 'sets', event.target.value),
                )
              }
            />
          </label>

          <label className="field">
            <span>Reps</span>
            <input
              inputMode="numeric"
              value={step.reps ?? ''}
              onChange={(event) =>
                onChange(
                  updateProgramBlock(block, index, 'reps', event.target.value),
                )
              }
            />
          </label>

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
                  updateProgramBlock(block, index, 'notes', event.target.value),
                )
              }
            />
          </label>
        </div>
      ))}
    </div>
  )
}

export function SettingsScreen() {
  const {
    activeExercises,
    data,
    exportBackup,
    importBackup,
    resetAllData,
    updatePreferences,
    updateProgramTemplate,
  } = useAppState()
  const [mainMovement, setMainMovement] = useState(
    data.athleteProfile.mainMovement,
  )
  const [cycleStartDate, setCycleStartDate] = useState(
    data.athleteProfile.cycleStartDate,
  )
  const [fatigueSensitivity, setFatigueSensitivity] = useState(
    String(data.settings.fatigueSensitivity),
  )
  const [cycleLengthDays, setCycleLengthDays] = useState(
    String(data.settings.cycleLengthDays),
  )
  const [jointPainSensitivity, setJointPainSensitivity] = useState(
    String(data.settings.jointPainSensitivity),
  )
  const [bodyweightTrackingEnabled, setBodyweightTrackingEnabled] = useState(
    data.settings.bodyweightTrackingEnabled,
  )
  const [bandsAvailable, setBandsAvailable] = useState(
    data.settings.bandsAvailable,
  )
  const [notes, setNotes] = useState(data.athleteProfile.notes)
  const [programTemplate, setProgramTemplate] = useState<ProgramTemplate>(
    structuredClone(data.programTemplate),
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await updatePreferences(
      {
        mainMovement: mainMovement.trim() || data.athleteProfile.mainMovement,
        cycleStartDate: cycleStartDate || todayDateString(),
        notes: notes.trim(),
      },
      {
        bodyweightTrackingEnabled,
        bandsAvailable,
        cycleLengthDays: Math.min(365, Math.max(30, Number(cycleLengthDays))),
        fatigueSensitivity: Number(fatigueSensitivity),
        jointPainSensitivity: Number(jointPainSensitivity),
      },
    )

    await updateProgramTemplate(programTemplate)
  }

  function handleExport() {
    const blob = new Blob([exportBackup()], {
      type: 'application/json',
    })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `pullup-max-backup-${todayDateString()}.json`
    link.click()
    URL.revokeObjectURL(href)
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const rawText = await file.text()
    await importBackup(rawText)
    event.target.value = ''
  }

  const exerciseOptions = activeExercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
  }))
  const exerciseNames = new Map(
    activeExercises.map((exercise) => [exercise.id, exercise.name]),
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

  const maxDayBlocks = [
    {
      key: 'warmup',
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
      key: 'volumeBlock',
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
      key: 'finisher',
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
  ].filter((item) => item.block.steps.length > 0)

  return (
    <div className="screen-stack">
      <form className="screen-stack" onSubmit={handleSave}>
        <Section eyebrow="Settings" title="Rules and defaults" compact>
          <div className="field-grid field-grid--compact">
            <label className="field field--span-2">
              <span>Main movement</span>
              <input
                list="movement-options"
                value={mainMovement}
                onChange={(event) => setMainMovement(event.target.value)}
              />
              <datalist id="movement-options">
                {activeExercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.name} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span>Cycle start date</span>
              <input
                type="date"
                value={cycleStartDate}
                onChange={(event) => setCycleStartDate(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Fatigue sensitivity</span>
              <select
                value={fatigueSensitivity}
                onChange={(event) => setFatigueSensitivity(event.target.value)}
              >
                <option value="1">1 low</option>
                <option value="2">2</option>
                <option value="3">3 default</option>
                <option value="4">4</option>
                <option value="5">5 high</option>
              </select>
            </label>

            <label className="field">
              <span>Cycle length (days)</span>
              <input
                type="number"
                min="30"
                max="365"
                value={cycleLengthDays}
                onChange={(event) => setCycleLengthDays(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Joint-pain sensitivity</span>
              <select
                value={jointPainSensitivity}
                onChange={(event) =>
                  setJointPainSensitivity(event.target.value)
                }
              >
                <option value="1">1 low</option>
                <option value="2">2</option>
                <option value="3">3 default</option>
                <option value="4">4</option>
                <option value="5">5 high</option>
              </select>
            </label>

            <label className="field field--checkbox">
              <span>Track bodyweight</span>
              <input
                type="checkbox"
                checked={bodyweightTrackingEnabled}
                onChange={(event) =>
                  setBodyweightTrackingEnabled(event.target.checked)
                }
              />
            </label>

            <label className="field field--checkbox">
              <span>Bands available</span>
              <input
                type="checkbox"
                checked={bandsAvailable}
                onChange={(event) => setBandsAvailable(event.target.checked)}
              />
            </label>

            <label className="field field--span-2">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>
        </Section>

        <Section eyebrow="Program" title="Editable template" compact>
          <div className="form-stack" data-testid="program-accordion-list">
            {maxDayBlocks.map((item) => (
              <CollapsibleSection
                key={item.key}
                title={item.block.title}
                summary={summarizeProgramBlock(item.block, exerciseNames)}
              >
                <ProgramBlockEditor
                  activeExerciseOptions={exerciseOptions}
                  block={item.block}
                  onChange={item.onChange}
                />
              </CollapsibleSection>
            ))}

            <CollapsibleSection
              title={programTemplate.supportDayBase.title}
              summary={summarizeProgramBlock(
                programTemplate.supportDayBase,
                exerciseNames,
              )}
            >
              <ProgramBlockEditor
                activeExerciseOptions={exerciseOptions}
                block={programTemplate.supportDayBase}
                onChange={(nextBlock) =>
                  setProgramTemplate((current) => ({
                    ...current,
                    supportDayBase: nextBlock,
                  }))
                }
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={programTemplate.supportFallback.title}
              summary={summarizeProgramBlock(
                programTemplate.supportFallback,
                exerciseNames,
              )}
            >
              <ProgramBlockEditor
                activeExerciseOptions={exerciseOptions}
                block={programTemplate.supportFallback}
                onChange={(nextBlock) =>
                  setProgramTemplate((current) => ({
                    ...current,
                    supportFallback: nextBlock,
                  }))
                }
              />
            </CollapsibleSection>

            {(['top', 'middle', 'start/bottom', 'grip'] as WeakBlockKey[]).map(
              (blockKey) => (
                <CollapsibleSection
                  key={blockKey}
                  title={programTemplate.weakPointBlocks[blockKey].title}
                  eyebrow={`Weak-point ${blockKey}`}
                  summary={summarizeProgramBlock(
                    programTemplate.weakPointBlocks[blockKey],
                    exerciseNames,
                  )}
                >
                  <ProgramBlockEditor
                    activeExerciseOptions={exerciseOptions}
                    block={programTemplate.weakPointBlocks[blockKey]}
                    onChange={(nextBlock) => setWeakBlock(blockKey, nextBlock)}
                  />
                </CollapsibleSection>
              ),
            )}
          </div>
        </Section>

        <div className="button-row">
          <button type="submit" className="button button--primary">
            Save settings and program
          </button>
        </div>
      </form>

      <Section eyebrow="Backup" title="Export and import" compact>
        <div className="button-row button-row--wrap">
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={handleExport}
          >
            Export JSON backup
          </button>
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON backup
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleImport}
        />
      </Section>

      <Section eyebrow="Reset" title="Reset local data" compact>
        <p className="muted-text">
          This clears all workouts, exercises, settings, program defaults, and
          stored recommendations on this device.
        </p>

        <button
          type="button"
          className="button button--ghost button--compact button--danger"
          onClick={() => {
            if (window.confirm('Reset all local app data?')) {
              void resetAllData()
            }
          }}
        >
          Reset app data
        </button>
      </Section>
    </div>
  )
}
