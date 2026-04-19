import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/AppProvider'
import { formatLongDate } from '../../lib/date'

export function CycleSummaryScreen() {
  const { cycleSummary, data, weeklyVolumeSummary } = useAppState()
  const { recommendationState } = data

  return (
    <div className="screen-stack">
      <Section
        eyebrow={`${data.settings.cycleLengthDays}-day cycle`}
        title="Cycle summary"
        variant="summary"
        compact
      >
        <div className="mini-stat-grid mini-stat-grid--wide">
          <div className="mini-stat">
            <span className="metric-label">Cycle window</span>
            <strong>
              {formatLongDate(cycleSummary.cycleWindow.start)} to{' '}
              {formatLongDate(cycleSummary.cycleWindow.end)}
            </strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Current baseline</span>
            <strong>{cycleSummary.baselineMax ?? 'No baseline yet'}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Cycle best</span>
            <strong>{cycleSummary.cycleBestMax ?? 'No max yet'}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Progress</span>
            <strong>{cycleSummary.progressPercent}%</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Current phase</span>
            <strong>{cycleSummary.currentPhase}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Days elapsed</span>
            <strong>{cycleSummary.daysElapsed}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Days remaining</span>
            <strong>{cycleSummary.daysRemaining}</strong>
          </div>
        </div>
      </Section>

      <Section eyebrow="Session counts" title="Cycle totals" compact>
        <div className="chip-row">
          <StatusPill
            label={`${cycleSummary.maxSessions} max`}
            tone="success"
          />
          <StatusPill
            label={`${cycleSummary.supportSessions} support`}
            tone="accent"
          />
          <StatusPill
            label={`${cycleSummary.totalSessions} total`}
            tone="neutral"
          />
          <StatusPill
            label={`trend ${recommendationState.trend}`}
            tone="neutral"
          />
        </div>
      </Section>

      <Section eyebrow="Summary" title="Current read on the cycle" compact>
        <p className="muted-text">{cycleSummary.summary}</p>

        <div className="mini-stat-grid" style={{ marginTop: 8 }}>
          <div className="mini-stat">
            <span className="metric-label">Next workout</span>
            <strong>{recommendationState.nextSessionType}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Max readiness</span>
            <strong>
              {recommendationState.maxReadinessSatisfied
                ? 'Ready'
                : 'Not ready'}
            </strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Support focus</span>
            <strong>{recommendationState.defaultSupportFocus}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Weekly volume</span>
            <strong>
              {weeklyVolumeSummary.completedPoints}/
              {weeklyVolumeSummary.targetPoints} pts
            </strong>
          </div>
        </div>
      </Section>
    </div>
  )
}
