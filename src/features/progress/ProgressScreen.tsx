import { useState } from 'react'
import { CycleLineChart } from '../../components/Charts'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/AppProvider'
import { formatLongDate, todayDateString } from '../../lib/date'

export function ProgressScreen() {
  const {
    bodyweightTrendPoints,
    cycleMaxTrendPoints,
    cycleSummary,
    data,
    latestBodyweightEntry,
  } = useAppState()
  const [showMax, setShowMax] = useState(true)
  const [showWeight, setShowWeight] = useState(
    data.settings.bodyweightTrackingEnabled,
  )

  return (
    <div className="screen-stack">
      <Section eyebrow="Current cycle" title="Progress" variant="summary" compact>
        <div className="cycle-window-note">
          <p>
            This chart shows the current {data.settings.cycleLengthDays}-day
            cycle from{' '}
            <strong>{formatLongDate(cycleSummary.cycleWindow.start)}</strong> to{' '}
            <strong>{formatLongDate(cycleSummary.cycleWindow.end)}</strong>.
          </p>
        </div>

        <div className="chip-row" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={`chip chip--button${showMax ? ' is-active' : ''}`}
            onClick={() => setShowMax((current) => !current)}
          >
            Max reps
          </button>
          {data.settings.bodyweightTrackingEnabled ? (
            <button
              type="button"
              className={`chip chip--button${showWeight ? ' is-active' : ''}`}
              onClick={() => setShowWeight((current) => !current)}
            >
              Weight
            </button>
          ) : null}
        </div>

        <CycleLineChart
          cycleWindow={cycleSummary.cycleWindow}
          maxPoints={cycleMaxTrendPoints}
          showMax={showMax}
          showWeight={showWeight}
          today={todayDateString()}
          weightPoints={bodyweightTrendPoints}
        />
      </Section>

      <Section eyebrow="Cycle status" title="Window details" compact>
        <div className="mini-stat-grid mini-stat-grid--wide">
          <div className="mini-stat">
            <span className="metric-label">Days elapsed</span>
            <strong>{cycleSummary.daysElapsed}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Days remaining</span>
            <strong>{cycleSummary.daysRemaining}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Cycle progress</span>
            <strong>{cycleSummary.progressPercent}%</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Current phase</span>
            <strong>{cycleSummary.currentPhase}</strong>
          </div>
          {data.settings.bodyweightTrackingEnabled ? (
            <div className="mini-stat">
              <span className="metric-label">Current weight</span>
              <strong>
                {latestBodyweightEntry
                  ? `${latestBodyweightEntry.weightKg} kg`
                  : 'No weight yet'}
              </strong>
              <p className="muted-text">
                {latestBodyweightEntry
                  ? formatLongDate(latestBodyweightEntry.date)
                  : 'Add weight from Today.'}
              </p>
            </div>
          ) : null}
        </div>
      </Section>
    </div>
  )
}
