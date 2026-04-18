import { useRef, useState } from 'react'
import { DEFAULT_SUPPORT_METHODS } from '../../domain/defaults'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/AppProvider'

export function SettingsScreen() {
  const {
    activeExercises,
    data,
    exportBackup,
    importBackup,
    resetAllData,
    updatePreferences,
  } = useAppState()
  const [mainMovement, setMainMovement] = useState(
    data.athleteProfile.mainMovement,
  )
  const [cycleStartDate, setCycleStartDate] = useState(
    data.athleteProfile.cycleStartDate,
  )
  const [fatigueSensitivity, setFatigueSensitivity] = useState(
    String(data.athleteProfile.fatigueSensitivity),
  )
  const [jointPainSensitivity, setJointPainSensitivity] = useState(
    String(data.athleteProfile.jointPainSensitivity),
  )
  const [bodyweightTrackingEnabled, setBodyweightTrackingEnabled] = useState(
    data.athleteProfile.bodyweightTrackingEnabled,
  )
  const [bandsAvailable, setBandsAvailable] = useState(
    data.athleteProfile.bandsAvailable,
  )
  const [preferredSupportMethods, setPreferredSupportMethods] = useState(
    data.athleteProfile.preferredSupportMethods,
  )
  const [notes, setNotes] = useState(data.athleteProfile.notes)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await updatePreferences(
      {
        mainMovement: mainMovement.trim() || data.athleteProfile.mainMovement,
        cycleStartDate,
        bodyweightTrackingEnabled,
        bandsAvailable,
        fatigueSensitivity: Number(fatigueSensitivity),
        jointPainSensitivity: Number(jointPainSensitivity),
        preferredSupportMethods,
        notes: notes.trim(),
      },
      {
        defaultMovement: mainMovement.trim() || data.settings.defaultMovement,
        bodyweightTrackingEnabled,
        bandsAvailable,
        fatigueSensitivity: Number(fatigueSensitivity),
        jointPainSensitivity: Number(jointPainSensitivity),
      },
    )
  }

  function toggleSupportMethod(method: string) {
    setPreferredSupportMethods((current) =>
      current.includes(method)
        ? current.filter((item) => item !== method)
        : [...current, method],
    )
  }

  function handleExport() {
    const blob = new Blob([exportBackup()], {
      type: 'application/json',
    })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = 'pullup-max-backup.json'
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

  return (
    <div className="screen-stack">
      <Section eyebrow="Program rules" title="Settings">
        <form className="form-stack" onSubmit={handleSave}>
          <div className="field-grid">
            <label className="field field--span-2">
              <span>Main test movement</span>
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
              <span>Joint pain sensitivity</span>
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

          <div className="subsection">
            <div className="subsection__header">
              <div>
                <h3>Preferred support methods</h3>
                <p>
                  These choices influence support-day suggestions without taking
                  over the whole recommendation engine.
                </p>
              </div>
            </div>
            <div className="chip-row">
              {DEFAULT_SUPPORT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`chip chip--button${
                    preferredSupportMethods.includes(method) ? ' is-active' : ''
                  }`}
                  onClick={() => toggleSupportMethod(method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <p className="muted-text">
            Keep the same test movement whenever possible. Changing it too often
            makes the max trend harder to interpret.
          </p>

          <button type="submit" className="button button--primary">
            Save settings
          </button>
        </form>
      </Section>

      <Section eyebrow="Backup" title="Import and export">
        <div className="button-row">
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

      <Section eyebrow="Danger zone" title="Reset app data">
        <p className="muted-text">
          This clears all workouts, exercises, and settings on this device.
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
