import { useState } from 'react'
import { CycleLineChart } from '../../components/Charts'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/appContext'
import { getFailurePointPattern } from '../../domain/selectors'
import { formatLongDate, todayDateString } from '../../lib/date'

function formatRepDelta(repDelta: number | null) {
  if (repDelta === null) {
    return null
  }

  return `${repDelta > 0 ? '+' : ''}${repDelta} rep${Math.abs(repDelta) === 1 ? '' : 's'}`
}

function formatWeightDelta(weightDeltaKg: number | null) {
  if (weightDeltaKg === null) {
    return null
  }

  return `${weightDeltaKg > 0 ? '+' : ''}${weightDeltaKg} kg`
}

export function ProgressScreen() {
  const {
    allTimeMaxTrendPoints,
    bodyweightTrendPoints,
    cycleMaxTrendPoints,
    cycleSummary,
    data,
    maxHistory,
  } = useAppState()
  const [chartMode, setChartMode] = useState<'cycle' | 'all-time'>('cycle')
  const [showMax, setShowMax] = useState(true)
  const [showWeight, setShowWeight] = useState(false)
  const [visibleMaxHistory, setVisibleMaxHistory] = useState(8)
  const failurePattern = getFailurePointPattern(maxHistory)

  const isAllTime = chartMode === 'all-time'
  const activeMaxPoints = isAllTime ? allTimeMaxTrendPoints : cycleMaxTrendPoints
  const activeWindow = isAllTime && allTimeMaxTrendPoints.length > 0
    ? {
        start: allTimeMaxTrendPoints[0]!.date,
        end: todayDateString(),
      }
    : cycleSummary.cycleWindow

  return (
    <div className="screen-stack">
      <Section
        eyebrow={isAllTime ? 'All time' : 'Current cycle'}
        title="Progress"
        className="section--compact"
      >
        <div className="action-row action-row--compact">
          <button
            type="button"
            className={`chip chip--button${!isAllTime ? ' is-active' : ''}`}
            onClick={() => setChartMode('cycle')}
          >
            Current cycle
          </button>
          <button
            type="button"
            className={`chip chip--button${isAllTime ? ' is-active' : ''}`}
            onClick={() => setChartMode('all-time')}
          >
            All time
          </button>
        </div>

        {!isAllTime ? (
          <div className="cycle-window-note">
            <p>
              This graph shows max reps across the current cycle from{' '}
              <strong>{formatLongDate(cycleSummary.cycleWindow.start)}</strong> to{' '}
              <strong>{formatLongDate(cycleSummary.cycleWindow.end)}</strong>.
            </p>
          </div>
        ) : null}

        <div className="action-row action-row--compact">
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
          ariaLabel={isAllTime ? 'Progress across all time' : 'Progress across the current cycle'}
          cycleWindow={activeWindow}
          maxPoints={activeMaxPoints}
          showMax={showMax}
          showPhaseBands={!isAllTime}
          showWeight={showWeight}
          today={todayDateString()}
          weightPoints={isAllTime ? [] : bodyweightTrendPoints}
        />

        {data.settings.bodyweightTrackingEnabled ? (
          <p className="muted-text">
            Toggle weight to compare bodyweight and max-rep changes on the same
            dates.
          </p>
        ) : null}
      </Section>

      <Section eyebrow="Cycle" title="Cycle snapshot">
        <div className="mini-stat-grid mini-stat-grid--triple">
          <div className="mini-stat">
            <span className="metric-label">Start</span>
            <strong>{formatLongDate(cycleSummary.cycleWindow.start)}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">End</span>
            <strong>{formatLongDate(cycleSummary.cycleWindow.end)}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Length</span>
            <strong>{data.settings.cycleLengthDays} days</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Phase</span>
            <strong>{cycleSummary.currentPhase}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Days remaining</span>
            <strong>{cycleSummary.daysRemaining}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Baseline</span>
            <strong>{cycleSummary.baselineMax ?? 'No baseline yet'}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Cycle best</span>
            <strong>{cycleSummary.cycleBestMax ?? 'No max yet'}</strong>
          </div>
        </div>
      </Section>

      {failurePattern ? (
        <div className="inline-note">
          <p className="muted-text">
            <strong>{failurePattern.point}</strong> has been your failure point
            in {failurePattern.count} of your last{' '}
            {Math.min(3, maxHistory.filter((item) => item.failurePoint && item.failurePoint !== 'not sure').length)} max tests — support is automatically targeting this.
          </p>
        </div>
      ) : null}

      <Section eyebrow="Max attempts" title="Recent max history">
        {maxHistory.length === 0 ? (
          <p className="muted-text">
            Your max history will appear here after the first Max day is logged.
          </p>
        ) : (
          <>
            <div className="workout-list">
              {maxHistory.slice(0, visibleMaxHistory).map((item) => {
              const repDeltaLabel = formatRepDelta(item.repDelta)
              const weightDeltaLabel = formatWeightDelta(item.bodyweightDeltaKg)

              return (
                <article key={item.id} className="workout-list__item">
                  <div className="workout-list__header">
                    <div>
                      <p className="workout-list__date">
                        {formatLongDate(item.date)}
                      </p>
                      <div className="chip-row">
                        <StatusPill
                          label={`${item.reps} reps`}
                          tone="success"
                        />
                        {repDeltaLabel ? (
                          <StatusPill
                            label={repDeltaLabel}
                            tone={
                              item.repDelta === 0
                                ? 'neutral'
                                : typeof item.repDelta === 'number' &&
                                    item.repDelta > 0
                                  ? 'success'
                                  : 'warning'
                            }
                          />
                        ) : null}
                        {typeof item.bodyweightKgSnapshot === 'number' ? (
                          <StatusPill
                            label={`${item.bodyweightKgSnapshot} kg`}
                            tone="neutral"
                          />
                        ) : null}
                        {weightDeltaLabel ? (
                          <StatusPill label={weightDeltaLabel} tone="neutral" />
                        ) : null}
                        {item.failurePoint ? (
                          <StatusPill label={item.failurePoint} tone="accent" />
                        ) : null}
                      </div>
                    </div>

                    {item.videoUrl ? (
                      <a
                        href={item.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="button button--ghost button--compact"
                      >
                        Video
                      </a>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
          {maxHistory.length > visibleMaxHistory ? (
            <button
              className="button button--ghost button--compact"
              style={{ marginTop: '0.75rem' }}
              onClick={() => setVisibleMaxHistory((n) => n + 8)}
            >
              Show more ({maxHistory.length - visibleMaxHistory} remaining)
            </button>
          ) : null}
          </>
        )}
      </Section>
    </div>
  )
}
