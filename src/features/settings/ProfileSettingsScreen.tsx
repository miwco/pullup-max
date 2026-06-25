import { useEffect, useRef, useState } from 'react'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/appContext'
import {
  getCycleEndDateForLength,
  getCycleLengthDaysFromDates,
  MAX_CYCLE_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
} from '../../domain/cycle'
import { serializeMaxTestsCsv } from '../../domain/importExport'
import type { TimerSoundId } from '../../domain/types'
import { addDays, todayDateString } from '../../lib/date'
import { playTone, TIMER_SOUND_OPTIONS } from '../../lib/timerSound'
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'

const STANDARD_CYCLE_DAYS = 90
type CyclePlanMode = 'standard' | 'competition'

function getInitialCyclePlanMode(cycleLengthDays: number): CyclePlanMode {
  return cycleLengthDays === STANDARD_CYCLE_DAYS ? 'standard' : 'competition'
}

function getCyclePlannerError(
  cycleStartDate: string,
  cycleEndDate: string,
  cycleLengthDays: string,
  cyclePlanMode: CyclePlanMode,
) {
  if (!cycleStartDate || !cycleEndDate) {
    return 'Choose a cycle start date and end date.'
  }

  const parsedLength = Number(cycleLengthDays)

  if (!Number.isFinite(parsedLength) || parsedLength <= 0) {
    return 'Cycle length must be valid.'
  }

  if (cycleEndDate < cycleStartDate) {
    return cyclePlanMode === 'competition'
      ? 'Competition date must be on or after the cycle start date.'
      : 'Cycle end date must be on or after the cycle start date.'
  }

  if (
    parsedLength < MIN_CYCLE_LENGTH_DAYS ||
    parsedLength > MAX_CYCLE_LENGTH_DAYS
  ) {
    return `Cycle length must be between ${MIN_CYCLE_LENGTH_DAYS} and ${MAX_CYCLE_LENGTH_DAYS} days.`
  }

  return null
}

export function ProfileSettingsScreen() {
  const {
    data,
    exportBackup,
    importBackup,
    requestPersistentStorage,
    resetAllData,
    saveSettingsAndProgram,
    storageDurability,
  } = useAppState()

  const [cyclePlanMode, setCyclePlanMode] = useState<CyclePlanMode>(() =>
    getInitialCyclePlanMode(data.settings.cycleLengthDays),
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
  const [timerSoundId, setTimerSoundId] = useState<TimerSoundId>(
    data.settings.timerSoundId,
  )
  const [timerVolume, setTimerVolume] = useState(data.settings.timerVolume)
  const [notes, setNotes] = useState(data.athleteProfile.notes)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hasChanges =
    data.athleteProfile.mainMovement !== 'Pull-up' ||
    cyclePlanMode !== getInitialCyclePlanMode(data.settings.cycleLengthDays) ||
    cycleStartDate !== data.athleteProfile.cycleStartDate ||
    cycleEndDate !== data.athleteProfile.cycleEndDate ||
    cycleLengthDays !== String(data.settings.cycleLengthDays) ||
    bodyweightTrackingEnabled !== data.settings.bodyweightTrackingEnabled ||
    bandsAvailable !== data.settings.bandsAvailable ||
    timerSoundId !== data.settings.timerSoundId ||
    timerVolume !== data.settings.timerVolume ||
    notes !== data.athleteProfile.notes

  const cyclePlannerError = getCyclePlannerError(
    cycleStartDate,
    cycleEndDate,
    cycleLengthDays,
    cyclePlanMode,
  )

  useUnsavedChangesPrompt(hasChanges)

  useEffect(() => {
    if (hasChanges) return
    queueMicrotask(() => {
      setCyclePlanMode(getInitialCyclePlanMode(data.settings.cycleLengthDays))
      setCycleStartDate(data.athleteProfile.cycleStartDate)
      setCycleEndDate(data.athleteProfile.cycleEndDate)
      setCycleLengthDays(String(data.settings.cycleLengthDays))
      setBodyweightTrackingEnabled(data.settings.bodyweightTrackingEnabled)
      setBandsAvailable(data.settings.bandsAvailable)
      setTimerSoundId(data.settings.timerSoundId)
      setTimerVolume(data.settings.timerVolume)
      setNotes(data.athleteProfile.notes)
    })
  }, [data, hasChanges])

  function handleCycleStartDateChange(nextCycleStartDate: string) {
    setCycleStartDate(nextCycleStartDate)
    if (cyclePlanMode === 'standard') {
      setCycleLengthDays(String(STANDARD_CYCLE_DAYS))
      setCycleEndDate(
        getCycleEndDateForLength(nextCycleStartDate, STANDARD_CYCLE_DAYS),
      )
      return
    }

    const derivedLength = getCycleLengthDaysFromDates(
      nextCycleStartDate,
      cycleEndDate,
    )
    setCycleLengthDays(derivedLength === null ? '' : String(derivedLength))
  }

  function handleCompetitionDateChange(nextCycleEndDate: string) {
    setCyclePlanMode('competition')
    setCycleEndDate(nextCycleEndDate)
    const nextCycleStartDate = todayDateString()
    setCycleStartDate(nextCycleStartDate)
    const derivedLength = getCycleLengthDaysFromDates(
      nextCycleStartDate,
      nextCycleEndDate,
    )
    setCycleLengthDays(derivedLength === null ? '' : String(derivedLength))
  }

  function applyCompetitionCycle() {
    const nextCycleStartDate = todayDateString()
    const nextCycleEndDate =
      cyclePlanMode === 'competition' && cycleEndDate >= nextCycleStartDate
        ? cycleEndDate
        : addDays(nextCycleStartDate, MIN_CYCLE_LENGTH_DAYS - 1)
    setCyclePlanMode('competition')
    setCycleStartDate(nextCycleStartDate)
    setCycleEndDate(nextCycleEndDate)
    const derivedLength = getCycleLengthDaysFromDates(
      nextCycleStartDate,
      nextCycleEndDate,
    )
    setCycleLengthDays(derivedLength === null ? '' : String(derivedLength))
  }

  function applyStandardCycle() {
    setCyclePlanMode('standard')
    setCycleLengthDays(String(STANDARD_CYCLE_DAYS))
    setCycleEndDate(
      getCycleEndDateForLength(cycleStartDate, STANDARD_CYCLE_DAYS),
    )
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || cyclePlannerError) return
    setIsSaving(true)
    await saveSettingsAndProgram(
      {
        mainMovement: 'Pull-up',
        cycleStartDate: cycleStartDate || todayDateString(),
        cycleEndDate,
        notes: notes.trim(),
      },
      {
        bodyweightTrackingEnabled,
        bandsAvailable,
        cycleLengthDays: Number(cycleLengthDays),
        timerSoundId,
        timerVolume,
      },
      data.programTemplate,
    )
    setIsSaving(false)
  }

  function handleExport() {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `pullup-max-backup-${todayDateString()}.json`
    link.click()
    URL.revokeObjectURL(href)
  }

  function handleExportCsv() {
    const blob = new Blob([serializeMaxTestsCsv(data)], { type: 'text/csv' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `pullup-max-max-tests-${todayDateString()}.csv`
    link.click()
    URL.revokeObjectURL(href)
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const rawText = await file.text()
    await importBackup(rawText)
    event.target.value = ''
  }

  return (
    <div className="screen-stack">
      <form className="screen-stack" onSubmit={handleSave}>
        <Section eyebrow="Settings" title="Rules and defaults">
          <div className="field-grid field-grid--compact">
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

            <div className="field field--span-2">
              <span>Cycle plan</span>
              <div className="button-row button-row--wrap">
                <button
                  type="button"
                  className={`button button--compact${
                    cyclePlanMode === 'standard'
                      ? ' button--primary'
                      : ' button--ghost'
                  }`}
                  onClick={applyStandardCycle}
                >
                  3 months
                </button>
                <button
                  type="button"
                  className={`button button--compact${
                    cyclePlanMode === 'competition'
                      ? ' button--primary'
                      : ' button--ghost'
                  }`}
                  onClick={applyCompetitionCycle}
                >
                  Competition date
                </button>
              </div>
            </div>

            <label className="field">
              <span>
                {cyclePlanMode === 'competition'
                  ? 'Competition date'
                  : 'Cycle end date'}
              </span>
              <input
                type="date"
                name="cycle-end-date"
                value={cycleEndDate}
                readOnly={cyclePlanMode === 'standard'}
                onInput={(event) =>
                  handleCompetitionDateChange(event.currentTarget.value)
                }
                onChange={(event) =>
                  handleCompetitionDateChange(event.target.value)
                }
              />
            </label>

            <div className="mini-stat">
              <span className="metric-label">Cycle length</span>
              <strong>{cycleLengthDays || 'Invalid'} days</strong>
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

            <label className="field">
              <span>Timer sound</span>
              <select
                value={timerSoundId}
                onChange={(event) =>
                  setTimerSoundId(event.target.value as TimerSoundId)
                }
              >
                {TIMER_SOUND_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Timer volume</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={timerVolume}
                onChange={(event) => setTimerVolume(Number(event.target.value))}
              />
            </label>

            <div className="field field--span-2">
              <span>Timer preview</span>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() =>
                  playTone(
                    {
                      soundId: timerSoundId,
                      volume: timerVolume,
                    },
                    'alarm',
                  )
                }
              >
                Test sound
              </button>
            </div>

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

          <div className="action-row action-row--end">
            <button
              type="submit"
              className="button button--primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </Section>
      </form>

      <Section eyebrow="Rules" title="How it works">
        <div className="mini-stat-grid">
          <div className="mini-stat">
            <span className="metric-label">Goal</span>
            <strong>Max strict pull-ups</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Default cycle</span>
            <strong>3 months</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Competition</span>
            <strong>Peak at cycle end</strong>
          </div>
        </div>
        <p className="muted-text">
          Build uses more easy exposures, Develop uses fewer longer sets, and
          Peak cuts extra volume so the final max attempt is fresh. If no weak
          point is logged, support days rotate through top, middle, and low.
        </p>
      </Section>

      <Section eyebrow="Backup" title="Export and import">
        <div className="inline-note">
          <p className="muted-text">
            App updates from Vercel keep your local IndexedDB progress on this
            device. Backups still matter before clearing browser data, changing
            devices, switching browsers, or reinstalling the app.
          </p>
        </div>

        <div className="mini-stat-grid">
          <div className="mini-stat">
            <span className="metric-label">Storage protection</span>
            <strong>
              {!storageDurability.isSupported
                ? 'Browser managed'
                : storageDurability.isPersisted
                  ? 'Persistent'
                  : 'Not locked'}
            </strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Backup format</span>
            <strong>Version {data.settings.exportFormatVersion}</strong>
          </div>
        </div>

        <div className="action-row">
          {storageDurability.isSupported && !storageDurability.isPersisted ? (
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void requestPersistentStorage()}
            >
              Protect local storage
            </button>
          ) : null}
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
