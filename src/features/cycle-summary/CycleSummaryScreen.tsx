import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/AppProvider'
import { formatLongDate } from '../../lib/date'

export function CycleSummaryScreen() {
  const { cycleSummary } = useAppState()

  return (
    <div className="screen-stack">
      <Section eyebrow="Three-month view" title="Cycle summary">
        <div className="info-grid">
          <div className="info-tile">
            <span className="metric-label">Cycle window</span>
            <strong>
              {formatLongDate(cycleSummary.cycleWindow.start)} to{' '}
              {formatLongDate(cycleSummary.cycleWindow.end)}
            </strong>
          </div>
          <div className="info-tile">
            <span className="metric-label">Current phase</span>
            <strong>{cycleSummary.currentPhase}</strong>
          </div>
          <div className="info-tile">
            <span className="metric-label">Cycle best max</span>
            <strong>{cycleSummary.cycleBestMax ?? 'No max yet'}</strong>
          </div>
        </div>
      </Section>

      <Section eyebrow="Session counts" title="Cycle totals">
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
            label={`${cycleSummary.recoverySessions} recovery`}
            tone="neutral"
          />
          <StatusPill
            label={`${cycleSummary.deloadPeriods.length} deload periods`}
            tone="warning"
          />
        </div>
      </Section>

      <Section eyebrow="Summary" title="What the cycle says">
        <p className="muted-text">{cycleSummary.summary}</p>
      </Section>

      <Section eyebrow="Deload periods" title="Recorded deloads">
        {cycleSummary.deloadPeriods.length === 0 ? (
          <p className="muted-text">
            No deload periods have been recorded in this cycle.
          </p>
        ) : (
          <div className="workout-list">
            {cycleSummary.deloadPeriods.map((period) => (
              <article
                key={`${period.start}-${period.end}`}
                className="workout-list__item"
              >
                <p className="workout-list__date">
                  {formatLongDate(period.start)} to {formatLongDate(period.end)}
                </p>
              </article>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
