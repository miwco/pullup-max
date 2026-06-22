import { useEffect, useMemo, useRef, useState } from 'react'
import { AccordionSection } from '../../components/AccordionSection'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/appContext'
import {
  getCycleEndDateForLength,
  getCycleLengthDaysFromDates,
  MAX_CYCLE_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
} from '../../domain/cycle'
import { serializeMaxTestsCsv } from '../../domain/importExport'
import { MAIN_MOVEMENTS } from '../../domain/mainMovement'
import type {
  BodyweightOption,
  MainMovement,
  ProgramBlock,
  ProgramStep,
  ProgramTemplate,
} from '../../domain/types'
import { todayDateString } from '../../lib/date'
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'
import { ExerciseLibraryManager } from '../exercise-library/ExerciseLibraryManager'
import { summarizeProgramBlock } from './programBlockSummary'

type WeakBlockKey = 'top' | 'middle' | 'start/bottom' | 'grip'
const CYCLE_LENGTH_PRESETS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

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

function getCyclePlannerError(
  cycleStartDate: string,
  cycleEndDate: string,
  cycleLengthDays: string,
) {
  if (!cycleStartDate || !cycleEndDate || !cycleLengthDays.trim()) {
    return 'Choose a cycle start date, end date, and length.'
  }

  const parsedLength = Number(cycleLengthDays)

  if (!Number.isFinite(parsedLength) || parsedLength <= 0) {
    return 'Cycle length must be a whole number of days.'
  }

  if (cycleEndDate < cycleStartDate) {
    return 'Cycle end date must be on or after the cycle start date.'
  }

  if (
    parsedLength < MIN_CYCLE_LENGTH_DAYS ||
    parsedLength > MAX_CYCLE_LENGTH_DAYS
  ) {
    return `Cycle length must stay between ${MIN_CYCLE_LENGTH_DAYS} and ${MAX_CYCLE_LENGTH_DAYS} days.`
  }

  return null
}

export function SettingsScreen({
  initialLibraryOpen = false,
}: {
  initialLibraryOpen?: boolean
}) {
  const {
    activeExercises,
    data,
    exportBackup,
    importBackup,
    resetAllData,
    saveSettingsAndProgram,
  } = useAppState()
  const [mainMovement, setMainMovement] = useState(
    data.athleteProfile.mainMovement,
  )
  const [cycleStartDate, setCycleStartDate] = useState(
    data.athleteProfile.cycleStartDate,
  )
  const [cycleEndDate, setCycleEndDate] = useState(
    data.athleteProfile.cycleEndDate,
  )
  const [cycleLengthDays, setCycleLengthDays] = useState(
    String(data.settings.cycleLengthDays),
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
  const [openProgramBlockId, setOpenProgramBlockId] = useState<string | null>(
    null,
  )
  const [isLibraryOpen, setIsLibraryOpen] = useState(() => initialLibraryOpen)
  const [libraryDraftDirty, setLibraryDraftDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasSettingsChanges =
    mainMovement !== data.athleteProfile.mainMovement ||
    cycleStartDate !== data.athleteProfile.cycleStartDate ||
    cycleEndDate !== data.athleteProfile.cycleEndDate ||
    cycleLengthDays !== String(data.settings.cycleLengthDays) ||
    bodyweightTrackingEnabled !== data.settings.bodyweightTrackingEnabled ||
    bandsAvailable !== data.settings.bandsAvailable ||
    notes !== data.athleteProfile.notes ||
    JSON.stringify(programTemplate) !== JSON.stringify(data.programTemplate)
  const isDirty = hasSettingsChanges || libraryDraftDirty
  const cyclePlannerError = getCyclePlannerError(
    cycleStartDate,
    cycleEndDate,
    cycleLengthDays,
  )

  useUnsavedChangesPrompt(isDirty)

  useEffect(() => {
    if (hasSettingsChanges || libraryDraftDirty) {
      return
    }

    queueMicrotask(() => {
      setMainMovement(data.athleteProfile.mainMovement)
      setCycleStartDate(data.athleteProfile.cycleStartDate)
      setCycleEndDate(data.athleteProfile.cycleEndDate)
      setCycleLengthDays(String(data.settings.cycleLengthDays))
      setBodyweightTrackingEnabled(data.settings.bodyweightTrackingEnabled)
      setBandsAvailable(data.settings.bandsAvailable)
      setNotes(data.athleteProfile.notes)
      setProgramTemplate(structuredClone(data.programTemplate))
    })
  }, [data, hasSettingsChanges, libraryDraftDirty])

  function handleCycleStartDateChange(nextCycleStartDate: string) {
    setCycleStartDate(nextCycleStartDate)

    const derivedLength = getCycleLengthDaysFromDates(
      nextCycleStartDate,
      cycleEndDate,
    )
    setCycleLengthDays(derivedLength === null ? '' : String(derivedLength))
  }

  function handleCycleEndDateChange(nextCycleEndDate: string) {
    setCycleEndDate(nextCycleEndDate)

    const derivedLength = getCycleLengthDaysFromDates(
      cycleStartDate,
      nextCycleEndDate,
    )
    setCycleLengthDays(derivedLength === null ? '' : String(derivedLength))
  }

  function handleCycleLengthDaysChange(nextCycleLengthDays: string) {
    setCycleLengthDays(nextCycleLengthDays)

    const parsedLength = Number(nextCycleLengthDays)

    if (
      !Number.isFinite(parsedLength) ||
      parsedLength <= 0 ||
      !cycleStartDate
    ) {
      return
    }

    setCycleEndDate(getCycleEndDateForLength(cycleStartDate, parsedLength))
  }

  function applyCycleLengthPreset(nextCycleLengthDays: number) {
    setCycleLengthDays(String(nextCycleLengthDays))
    setCycleEndDate(
      getCycleEndDateForLength(cycleStartDate, nextCycleLengthDays),
    )
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving || cyclePlannerError) {
      return
    }

    setIsSaving(true)

    await saveSettingsAndProgram(
      {
        mainMovement,
        cycleStartDate: cycleStartDate || todayDateString(),
        cycleEndDate,
        notes: notes.trim(),
      },
      {
        bodyweightTrackingEnabled,
        bandsAvailable,
        cycleLengthDays: Number(cycleLengthDays),
      },
      programTemplate,
    )
    setIsSaving(false)
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

  function handleExportCsv() {
    const blob = new Blob([serializeMaxTestsCsv(data)], {
      type: 'text/csv',
    })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `pullup-max-max-tests-${todayDateString()}.csv`
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
        <Section eyebrow="Settings" title="Rules and defaults">
          <div className="field-grid field-grid--compact">
            <label className="field field--span-2">
              <span>Main movement</span>
              <select
                name="main-movement"
                value={mainMovement}
                onChange={(event) =>
                  setMainMovement(event.target.value as MainMovement)
                }
              >
                {MAIN_MOVEMENTS.map((movement) => (
                  <option key={movement} value={movement}>
                    {movement}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Cycle start date</span>
              <input
                type="date"
                name="cycle-start-date"
                value={cycleStartDate}
                onChange={(event) =>
                  handleCycleStartDateChange(event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Cycle end date</span>
              <input
                type="date"
                name="cycle-end-date"
                value={cycleEndDate}
                onChange={(event) =>
                  handleCycleEndDateChange(event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Cycle length (days)</span>
              <input
                type="number"
                min="30"
                max="365"
                name="cycle-length-days"
                value={cycleLengthDays}
                onChange={(event) =>
                  handleCycleLengthDaysChange(event.target.value)
                }
              />
            </label>

            <div className="field field--span-2">
              <span>Quick lengths</span>
              <div className="button-row button-row--wrap">
                {CYCLE_LENGTH_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className="button button--ghost button--compact"
                    onClick={() => applyCycleLengthPreset(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

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
                name="athlete-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>

          {cyclePlannerError ? (
            <p className="form-error">{cyclePlannerError}</p>
          ) : null}
        </Section>

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

      <Section eyebrow="Backup" title="Export and import">
        <div className="action-row">
          <button
            type="button"
            className="button button--ghost"
            onClick={handleExport}
          >
            Export JSON backup
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={handleExportCsv}
          >
            Export max tests CSV
          </button>
          <button
            type="button"
            className="button button--ghost"
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

      <Section eyebrow="Reset" title="Reset local data">
        <p className="muted-text">
          This clears all workouts, exercises, settings, program defaults, and
          stored recommendations on this device.
        </p>

        <button
          type="button"
          className="button button--ghost"
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
