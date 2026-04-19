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
      <Section
        eyebrow="Today"
        title={
          recommendation.nextSessionType === 'max' ? 'Max day' : 'Support day'
        }
        variant="summary"
        compact
        action={
          <StatusPill
            label={
              recommendation.maxReadinessSatisfied ? 'Ready to test' : 'Build day'
            }
            tone={
              recommendation.maxReadinessSatisfied ? 'success' : 'warning'
            }
          />
        }
      >
        <div className="summary-block">
          <div className="summary-block__body">
            <p className="summary-note">Next recommended workout</p>
            <p className="compact-note">{recommendation.explanation}</p>
          </div>

          <div className="summary-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => onQuickLog(recommendation.nextSessionType)}
            >
              Log recommended workout
            </button>

            <div className="summary-actions__secondary">
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => onQuickLog('max')}
              >
                Log max
              </button>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={onOpenSettings}
              >
                Edit program
              </button>
              {canInstall ? (
                <button
                  type="button"
                  className="button button--ghost button--compact"
                  onClick={onInstall}
                >
                  Install PWA
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Today details" title="Readiness and workload" compact>
        <div className="mini-stat-grid" data-testid="today-mini-grid">
          <div className="mini-stat">
            <span className="metric-label">Readiness</span>
            <strong>
              {recommendation.maxReadinessSatisfied ? 'Satisfied' : 'Not yet'}
            </strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Baseline</span>
            <strong>
              {recommendation.baselineMax === null
                ? 'No baseline'
                : `${recommendation.baselineMax} reps`}
            </strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Trend</span>
            <strong>{recommendation.trend}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Support focus</span>
            <strong>{recommendation.defaultSupportFocus}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Days since max</span>
            <strong>{formatDayCount(daysSinceLastMax, 'None yet')}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Days since workout</span>
            <strong>{formatDayCount(daysSinceLastWorkout, 'None yet')}</strong>
          </div>
        </div>

        <div className="detail-list">
          <div className="detail-row">
            <span className="detail-row__label">Suggested exercises</span>
            <div className="chip-row">
              {recommendation.suggestedExercises.map((exerciseName) => (
                <span key={exerciseName} className="chip">
                  {exerciseName}
                </span>
              ))}
            </div>
          </div>

          {recommendation.nextSessionType === 'support' ? (
            <div className="detail-row">
              <span className="detail-row__label">Support default</span>
              <span className="detail-row__value">
                {recommendation.defaultSupportFocus}
              </span>
            </div>
          ) : null}
        </div>
      </Section>

      <Section eyebrow="Weekly target" title="Volume this week" compact>
        <div className="mini-stat-grid">
          <div className="mini-stat">
            <span className="metric-label">Completed</span>
            <strong>{weeklyVolumeSummary.completedPoints} pts</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Target</span>
            <strong>{weeklyVolumeSummary.targetPoints} pts</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Still to do</span>
            <strong>{weeklyVolumeSummary.remainingPoints} pts</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Week</span>
            <strong>{weeklyVolumeSummary.weekNumber}</strong>
          </div>
        </div>

        <div className="row-stack" style={{ marginTop: 8 }}>
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

        <p className="compact-note" data-testid="today-weekly-target">
          {weeklyVolumeSummary.message}
        </p>
      </Section>

      {data.settings.bodyweightTrackingEnabled ? (
        <Section eyebrow="Bodyweight" title="Today's weight" compact>
          <div className="inline-form" data-testid="today-weight-row">
            <label className="field">
              <span>Weight today</span>
              <input
                inputMode="decimal"
                placeholder="kg"
                value={resolvedWeightInput}
                onChange={(event) => setWeightInput(event.target.value)}
              />
            </label>

            <div className="mini-stat">
              <span className="metric-label">Latest saved</span>
              <strong>{latestWeightLabel}</strong>
              <p className="compact-note">
                {latestBodyweightEntry
                  ? formatLongDate(latestBodyweightEntry.date)
                  : 'Save today to start tracking.'}
              </p>
            </div>

            <button
              type="button"
              className="button button--primary"
              onClick={() => void handleSaveWeight()}
            >
              Save weight
            </button>
          </div>

          {weightError ? <p className="form-error">{weightError}</p> : null}

          <p className="compact-note">
            New Max results will automatically snapshot the latest saved weight.
          </p>
        </Section>
      ) : null}
    </div>
  )
}
