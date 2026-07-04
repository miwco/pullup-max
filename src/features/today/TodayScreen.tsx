import { useState } from 'react'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/appContext'
import { getRecentSignalAverages } from '../../domain/selectors'
import { formatLongDate, todayDateString } from '../../lib/date'

interface TodayScreenProps {
  canInstall: boolean
  onInstall: () => void
  onQuickLog: (sessionType?: 'max' | 'support') => void
}

function formatDayCount(value: number | null, emptyLabel: string) {
  if (value === null) {
    return emptyLabel
  }

  return `${value} day${value === 1 ? '' : 's'}`
}

const VOLUME_HELP_ID = 'weekly-volume-help'
const VOLUME_HELP_TEXT =
  'Training load combines the amount of work with a small fatigue adjustment. Bodyweight pull-up reps form the base, assisted and partial work use lighter weights, and hangs use time. Failed exercises count 8% more than passed exercises. Hard and very hard max attempts count 5% and 10% more than clean attempts. Weekly targets follow your recent training and adjust for Build, Develop, and Peak.'

export function TodayScreen({
  canInstall,
  onInstall,
  onQuickLog,
}: TodayScreenProps) {
  const {
    cycleSummary,
    data,
    daysSinceLastMax,
    daysSinceLastWorkout,
    dismissOnboarding,
    latestBodyweightEntry,
    saveBodyweight,
    weeklyVolumeSummary,
  } = useAppState()
  const recommendation = data.recommendationState
  const today = todayDateString()
  const signalAverages = getRecentSignalAverages(data.sessions)
  const painSignalActive =
    signalAverages.jointPainAverage !== null &&
    signalAverages.jointPainAverage >= 3
  const fatigueSignalActive =
    signalAverages.fatigueAverage !== null && signalAverages.fatigueAverage >= 4
  const todaysWeight =
    data.bodyweightEntries.find((entry) => entry.date === today)?.weightKg ??
    null
  const [showVolumeHelp, setShowVolumeHelp] = useState(false)
  const [weightInput, setWeightInput] = useState<string | null>(null)
  const [weightError, setWeightError] = useState<string | null>(null)
  const [isSavingWeight, setIsSavingWeight] = useState(false)
  const resolvedWeightInput =
    weightInput ?? (todaysWeight === null ? '' : String(todaysWeight))
  const latestWeightLabel = latestBodyweightEntry
    ? `${latestBodyweightEntry.weightKg} kg`
    : 'No weight yet'

  async function handleSaveWeight() {
    if (isSavingWeight) {
      return
    }

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

    setIsSavingWeight(true)
    const saved = await saveBodyweight(today, parsedWeight)
    setIsSavingWeight(false)

    if (saved) {
      setWeightInput(null)
    }
  }

  return (
    <div className="screen-stack">
      {!data.settings.onboardingDismissed && data.sessions.length === 0 ? (
        <Section eyebrow="Getting started" title="Welcome to Pull-up Max">
          <ol
            className="muted-text"
            style={{ paddingLeft: '1.25rem', lineHeight: 1.6 }}
          >
            <li>
              Go to <a href="#/settings">Settings</a> to confirm your main
              movement and set your cycle start date.
            </li>
            <li>
              Come back here and tap <strong>Log recommended workout</strong>.
            </li>
            <li>
              Do one all-out max set and log the result — that sets your
              baseline.
            </li>
          </ol>
          <div className="button-row" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => void dismissOnboarding()}
            >
              Got it, dismiss
            </button>
          </div>
        </Section>
      ) : null}

      {cycleSummary.daysRemaining === 0 ? (
        <div className="notice">
          <span>
            Your training cycle has ended — start a new one in{' '}
            <a href="#/settings">Settings</a> to keep phase and load tracking
            accurate.
          </span>
        </div>
      ) : null}
      <Section
        variant="summary"
        className="today-summary"
        contentClassName="today-summary__content"
        eyebrow="Today"
        title={
          recommendation.nextSessionType === 'max' ? 'Max day' : 'Support day'
        }
        action={
          <button
            type="button"
            className="button button--primary"
            onClick={() => onQuickLog(recommendation.nextSessionType)}
          >
            Log recommended workout
          </button>
        }
      >
        <div className="summary-bar">
          <div className="chip-row">
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

        <p className="summary-copy">{recommendation.explanation}</p>

        {canInstall ? (
          <div className="button-row">
            <button
              type="button"
              className="button button--ghost"
              onClick={onInstall}
            >
              Install PWA
            </button>
          </div>
        ) : null}
      </Section>

      <Section eyebrow="Training state" title="Readiness snapshot">
        <div className="mini-stat-grid">
          <div className="mini-stat">
            <span className="metric-label">Max readiness</span>
            <strong>
              {recommendation.maxReadinessSatisfied ? 'Satisfied' : 'Not yet'}
            </strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Days since last max</span>
            <strong>{formatDayCount(daysSinceLastMax, 'None yet')}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Days since last workout</span>
            <strong>{formatDayCount(daysSinceLastWorkout, 'None yet')}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Current baseline</span>
            <strong>
              {recommendation.baselineMax === null
                ? 'No baseline yet'
                : `${recommendation.baselineMax} reps`}
            </strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Current phase</span>
            <strong>{recommendation.currentPhase}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Trend</span>
            <strong>{recommendation.trend}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Support focus</span>
            <strong>{recommendation.defaultSupportFocus}</strong>
          </div>
          {data.settings.bodyweightTrackingEnabled ? (
            <div className="mini-stat">
              <span className="metric-label">Current weight</span>
              <strong>{latestWeightLabel}</strong>
            </div>
          ) : null}
        </div>
      </Section>

      {painSignalActive || fatigueSignalActive ? (
        <div className="inline-note">
          <p className="muted-text">
            {painSignalActive && fatigueSignalActive
              ? `Average joint pain ${signalAverages.jointPainAverage}/5 and fatigue ${signalAverages.fatigueAverage}/5 over the last 6 sessions — support is being kept easier.`
              : painSignalActive
                ? `Average joint pain ${signalAverages.jointPainAverage}/5 over the last 6 sessions — support is being kept easier.`
                : `Average fatigue ${signalAverages.fatigueAverage}/5 over the last 6 sessions — support is being kept easier.`}
          </p>
        </div>
      ) : null}

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
            most recent Max-day log. The workout logger will preload the
            prescribed preset rows so you can mark each one Pass or Fail.
          </p>
        </Section>
      ) : null}

      <Section
        eyebrow="Weekly target"
        title="Training load this week"
        className="section--compact"
        action={
          <button
            type="button"
            className={`icon-button icon-button--help${showVolumeHelp ? ' is-active' : ''}`}
            aria-label="Explain how weekly training load is counted"
            aria-controls={VOLUME_HELP_ID}
            aria-expanded={showVolumeHelp}
            onClick={() => setShowVolumeHelp((current) => !current)}
          >
            ?
          </button>
        }
      >
        <div className="mini-stat-grid mini-stat-grid--triple">
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
        </div>

        <div className="summary-bar">
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
            <StatusPill label="Load brake active" tone="warning" />
          ) : null}
        </div>

        <p className="muted-text">{weeklyVolumeSummary.message}</p>

        {showVolumeHelp ? (
          <div id={VOLUME_HELP_ID} className="inline-note">
            <p className="muted-text">{VOLUME_HELP_TEXT}</p>
          </div>
        ) : null}
      </Section>

      {data.settings.bodyweightTrackingEnabled ? (
        <Section eyebrow="Bodyweight" title="Today's weight">
          <div className="inline-form">
            <label className="field">
              <span>Weight today</span>
              <input
                name="bodyweight-kg"
                autoComplete="off"
                inputMode="decimal"
                placeholder="82.4…"
                value={resolvedWeightInput}
                onChange={(event) => setWeightInput(event.target.value)}
              />
            </label>

            <div className="mini-stat">
              <span className="metric-label">Latest saved</span>
              <strong>{latestWeightLabel}</strong>
              <p className="muted-text">
                {latestBodyweightEntry
                  ? formatLongDate(latestBodyweightEntry.date)
                  : 'Save today to start tracking.'}
              </p>
            </div>

            <button
              type="button"
              className="button button--primary"
              disabled={isSavingWeight}
              onClick={() => void handleSaveWeight()}
            >
              {isSavingWeight ? 'Saving…' : "Save today's weight"}
            </button>
          </div>

          {weightError ? <p className="form-error">{weightError}</p> : null}

          <p className="muted-text bodyweight-note">
            New Max results will automatically snapshot the latest saved weight.
          </p>
        </Section>
      ) : null}
    </div>
  )
}
