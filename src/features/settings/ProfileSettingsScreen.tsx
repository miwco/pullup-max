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
import { MAIN_MOVEMENTS } from '../../domain/mainMovement'
import type { MainMovement } from '../../domain/types'
import { todayDateString } from '../../lib/date'
import { useUnsavedChangesPrompt } from '../../lib/useUnsavedChangesPrompt'

const CYCLE_LENGTH_PRESETS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

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
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hasChanges =
    mainMovement !== data.athleteProfile.mainMovement ||
    cycleStartDate !== data.athleteProfile.cycleStartDate ||
    cycleEndDate !== data.athleteProfile.cycleEndDate ||
    cycleLengthDays !== String(data.settings.cycleLengthDays) ||
    bodyweightTrackingEnabled !== data.settings.bodyweightTrackingEnabled ||
    bandsAvailable !== data.settings.bandsAvailable ||
    notes !== data.athleteProfile.notes

  const cyclePlannerError = getCyclePlannerError(
    cycleStartDate,
    cycleEndDate,
    cycleLengthDays,
  )

  useUnsavedChangesPrompt(hasChanges)

  useEffect(() => {
    if (hasChanges) return
    queueMicrotask(() => {
      setMainMovement(data.athleteProfile.mainMovement)
      setCycleStartDate(data.athleteProfile.cycleStartDate)
      setCycleEndDate(data.athleteProfile.cycleEndDate)
      setCycleLengthDays(String(data.settings.cycleLengthDays))
      setBodyweightTrackingEnabled(data.settings.bodyweightTrackingEnabled)
      setBandsAvailable(data.settings.bandsAvailable)
      setNotes(data.athleteProfile.notes)
    })
  }, [data, hasChanges])

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
    if (!Number.isFinite(parsedLength) || parsedLength <= 0 || !cycleStartDate)
      return
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
    if (isSaving || cyclePlannerError) return
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

          <div className="action-row action-row--end">
            <button
              type="submit"
              className="button button--primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </Section>
      </form>

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
