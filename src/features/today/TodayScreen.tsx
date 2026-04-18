import { getSessionCounts } from '../../domain/selectors'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/AppProvider'

interface TodayScreenProps {
  canInstall: boolean
  onInstall: () => void
  onOpenSettings: () => void
  onQuickLog: (sessionType?: 'max' | 'support' | 'recovery' | 'deload') => void
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function TodayScreen({
  canInstall,
  onInstall,
  onOpenSettings,
  onQuickLog,
}: TodayScreenProps) {
  const { data, daysSinceLastMax } = useAppState()
  const recommendation = data.recommendationState
  const sessionsLast7 = getSessionCounts(data.sessions, undefined, 7)
  const sessionsLast14 = getSessionCounts(data.sessions, undefined, 14)

  return (
    <div className="screen-stack">
      <section className="hero-panel">
        <div className="hero-panel__meta">
          <span className="hero-panel__eyebrow">
            Single-purpose specialization
          </span>
          <StatusPill
            label={`Phase: ${titleCase(recommendation.phase)}`}
            tone={recommendation.deloadLevel === 'none' ? 'accent' : 'warning'}
          />
        </div>
        <div className="hero-panel__content">
          <div>
            <p className="hero-panel__kicker">Next recommendation</p>
            <h1 className="hero-panel__title">
              {titleCase(recommendation.nextSessionType)} session
            </h1>
            <p className="hero-panel__body">{recommendation.explanation}</p>
          </div>
          <div className="hero-panel__metrics">
            <div>
              <span className="metric-label">Days since max</span>
              <strong>{daysSinceLastMax ?? 'None yet'}</strong>
            </div>
            <div>
              <span className="metric-label">Sessions / 7 days</span>
              <strong>{sessionsLast7}</strong>
            </div>
            <div>
              <span className="metric-label">Sessions / 14 days</span>
              <strong>{sessionsLast14}</strong>
            </div>
          </div>
        </div>
        <div className="hero-panel__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => onQuickLog(recommendation.nextSessionType)}
          >
            Log today&apos;s workout
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onQuickLog('max')}
          >
            Log max test
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onOpenSettings}
          >
            Rules and settings
          </button>
          {canInstall ? (
            <button
              type="button"
              className="button button--ghost"
              onClick={onInstall}
            >
              Install app
            </button>
          ) : null}
        </div>
      </section>

      <Section eyebrow="Why this workout" title="Current read">
        <div className="info-grid">
          <div className="info-tile">
            <span className="metric-label">Trend</span>
            <strong>{titleCase(recommendation.trend)}</strong>
          </div>
          <div className="info-tile">
            <span className="metric-label">Deload level</span>
            <strong>{recommendation.deloadLevel.replace('_', ' ')}</strong>
          </div>
          <div className="info-tile">
            <span className="metric-label">Support emphasis</span>
            <strong>{recommendation.supportEmphasis}</strong>
          </div>
        </div>
      </Section>

      <Section eyebrow="Suggested work" title="Next workout outline">
        {recommendation.suggestedExercises.length > 0 ? (
          <div className="chip-row">
            {recommendation.suggestedExercises.map((exerciseName) => (
              <span key={exerciseName} className="chip">
                {exerciseName}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted-text">
            Keep the next session simple: log the main movement and a small
            amount of recovery work.
          </p>
        )}
      </Section>

      <Section eyebrow="Consistency" title="Test movement">
        <p className="muted-text">
          Your current anchor movement is{' '}
          <strong>{data.athleteProfile.mainMovement}</strong>. Stay consistent
          with the same test movement so the trend stays useful.
        </p>
      </Section>

      {data.sessions.length === 0 ? (
        <Section eyebrow="First use" title="Start simple">
          <p className="muted-text">
            Log one true max-rep set this week. After that, the app will steer
            the next support or recovery session around that result.
          </p>
        </Section>
      ) : null}
    </div>
  )
}
