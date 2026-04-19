import { useState } from 'react'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/AppProvider'
import { formatLongDate, todayDateString } from '../../lib/date'

interface TodayScreenProps {
  canInstall: boolean
  onInstall: () => void
  onOpenSettings: () => void
  onQuickLog: (sessionType?: 'max' | 'support') => void
}

function formatDayCount(value: number | null, emptyLabel: string) {
  if (value === null) {
    return emptyLabel
  }

  return `${value} day${value === 1 ? '' : 's'}`
}

export function TodayScreen({
  canInstall,
  onInstall,
  onOpenSettings,
  onQuickLog,
}: TodayScreenProps) {
  const {
    data,
    daysSinceLastMax,
    daysSinceLastWorkout,
    latestBodyweightEntry,
    saveBodyweight,
    weeklyVolumeSummary,
  } = useAppState()
  const recommendation = data.recommendationState
  const today = todayDateString()
  const todaysWeight =
    data.bodyweightEntries.find((entry) => entry.date === today)?.weightKg ??
    null
  const [weightInput, setWeightInput] = useState<string | null>(null)
  const [weightError, setWeightError] = useState<string | null>(null)
  const resolvedWeightInput =
    weightInput ?? (todaysWeight === null ? '' : String(todaysWeight))
  const latestWeightLabel = latestBodyweightEntry
    ? `${latestBodyweightEntry.weightKg} kg`
    : 'No weight yet'

  async function handleSaveWeight() {
    setWeightError(null)

    const parsedWeight = Number(resolvedWeightInput)

    if (
      !resolvedWeightInput.trim() ||
      !Number.isFinite(parsedWeight) ||
      parsedWeight <= 0
    ) {
      setWeightError('Enter a valid bodyweight in kilograms.')
      return
    }

    const saved = await saveBodyweight(today, parsedWeight)

    if (saved) {
      setWeightInput(null)
    }
  }

  return (
    <div className="screen-stack">
      <section className="hero-panel hero-panel--compact">
        <div className="hero-panel__meta">
          <div className="chip-row">
            <span className="hero-panel__eyebrow">Today</span>
            <StatusPill
              label={
                recommendation.maxReadinessSatisfied
                  ? 'Max ready'
                  : 'Support day'
              }
              tone={
                recommendation.maxReadinessSatisfied ? 'success' : 'warning'
              }
            />
            <StatusPill label={recommendation.currentPhase} tone="neutral" />
          </div>
        </div>

        <div className="hero-panel__content hero-panel__content--single">
          <div>
            <p className="hero-panel__kicker">Next recommended workout</p>
            <h2 className="hero-panel__title hero-panel__title--compact">
              {recommendation.nextSessionType === 'max'
                ? 'Max day'
                : 'Support day'}
            </h2>
            <p className="hero-panel__body">{recommendation.explanation}</p>
          </div>
        </div>

        <div className="hero-panel__metrics hero-panel__metrics--dense">
          <div>
            <span className="metric-label">Max readiness</span>
            <strong>
              {recommendation.maxReadinessSatisfied ? 'Satisfied' : 'Not yet'}
            </strong>
          </div>
          <div>
            <span className="metric-label">Days since last max</span>
            <strong>{formatDayCount(daysSinceLastMax, 'None yet')}</strong>
          </div>
          <div>
            <span className="metric-label">Days since last workout</span>
            <strong>{formatDayCount(daysSinceLastWorkout, 'None yet')}</strong>
          </div>
          <div>
            <span className="metric-label">Current baseline</span>
            <strong>
              {recommendation.baselineMax === null
                ? 'No baseline yet'
                : `${recommendation.baselineMax} reps`}
            </strong>
          </div>
          <div>
            <span className="metric-label">Current phase</span>
            <strong>{recommendation.currentPhase}</strong>
          </div>
          <div>
            <span className="metric-label">Trend</span>
            <strong>{recommendation.trend}</strong>
          </div>
          <div>
            <span className="metric-label">Support focus</span>
            <strong>{recommendation.defaultSupportFocus}</strong>
          </div>
          {data.settings.bodyweightTrackingEnabled ? (
            <div>
              <span className="metric-label">Current weight</span>
              <strong>{latestWeightLabel}</strong>
            </div>
          ) : null}
        </div>

        <div className="hero-panel__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => onQuickLog(recommendation.nextSessionType)}
          >
            Log recommended workout
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onQuickLog('max')}
          >
            Log Max day
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onOpenSettings}
          >
            Edit program
          </button>
          {canInstall ? (
            <button
              type="button"
              className="button button--ghost"
              onClick={onInstall}
            >
              Install PWA
            </button>
          ) : null}
        </div>
      </section>

      <Section eyebrow="Next work" title="Suggested exercises">
        <div className="chip-row">
          {recommendation.suggestedExercises.map((exerciseName) => (
            <span key={exerciseName} className="chip">
              {exerciseName}
            </span>
          ))}
        </div>
      </Section>

      {recommendation.nextSessionType === 'support' ? (
        <Section eyebrow="Support default" title="Default support focus">
          <p className="muted-text">
            The Support day defaults to{' '}
            <strong>{recommendation.defaultSupportFocus}</strong> based on the
            most recent Max-day log. You can still edit or override the
            prefilled exercises before saving the workout.
          </p>
        </Section>
      ) : null}

      <Section eyebrow="Weekly target" title="Volume this week">
        <div className="info-grid info-grid--triple">
          <div className="info-tile">
            <span className="metric-label">Completed</span>
            <strong>{weeklyVolumeSummary.completedPoints} pts</strong>
          </div>
          <div className="info-tile">
            <span className="metric-label">Target</span>
            <strong>{weeklyVolumeSummary.targetPoints} pts</strong>
          </div>
          <div className="info-tile">
            <span className="metric-label">Still to do</span>
            <strong>{weeklyVolumeSummary.remainingPoints} pts</strong>
          </div>
        </div>

        <div className="chip-row">
          <StatusPill
            label={`Week ${weeklyVolumeSummary.weekNumber}`}
            tone="neutral"
          />
          <StatusPill
            label={weeklyVolumeSummary.volumeStatus}
            tone={
              weeklyVolumeSummary.volumeStatus === 'behind'
                ? 'warning'
                : 'success'
            }
          />
          {weeklyVolumeSummary.brakeApplied ? (
            <StatusPill label="Brake active" tone="warning" />
          ) : null}
        </div>

        <p className="muted-text" style={{ marginTop: 10 }}>
          {weeklyVolumeSummary.message}
        </p>
      </Section>

      {data.settings.bodyweightTrackingEnabled ? (
        <Section eyebrow="Bodyweight" title="Today's weight">
          <div className="field-grid field-grid--compact">
            <label className="field">
              <span>Weight today</span>
              <input
                inputMode="decimal"
                placeholder="kg"
                value={resolvedWeightInput}
                onChange={(event) => setWeightInput(event.target.value)}
              />
            </label>

            <div className="info-tile">
              <span className="metric-label">Latest saved</span>
              <strong>
                {latestWeightLabel}
              </strong>
              <p className="muted-text">
                {latestBodyweightEntry
                  ? formatLongDate(latestBodyweightEntry.date)
                  : 'Save today to start tracking.'}
              </p>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void handleSaveWeight()}
            >
              Save today's weight
            </button>
          </div>

          {weightError ? <p className="form-error">{weightError}</p> : null}

          <p className="muted-text" style={{ marginTop: 10 }}>
            New Max results will automatically snapshot the latest saved weight.
          </p>
        </Section>
      ) : null}
    </div>
  )
}
