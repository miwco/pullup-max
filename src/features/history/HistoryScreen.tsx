import { BarChart, LineChart } from '../../components/Charts'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/AppProvider'
import { formatLongDate } from '../../lib/date'

export function HistoryScreen() {
  const {
    allTimeBestMax,
    cycleSummary,
    data,
    maxTrendPoints,
    recentWorkouts,
    supportVolumeTrend,
  } = useAppState()
  const maxBySessionId = new Map(
    data.maxTests.map((maxTest) => [maxTest.workoutSessionId, maxTest]),
  )
  const exerciseById = new Map(
    data.exercises.map((exercise) => [exercise.id, exercise]),
  )

  return (
    <div className="screen-stack">
      <Section eyebrow="Progress" title="Max trend">
        <div className="info-grid">
          <div className="info-tile">
            <span className="metric-label">All-time best</span>
            <strong>{allTimeBestMax ?? 'No max yet'}</strong>
          </div>
          <div className="info-tile">
            <span className="metric-label">Cycle best</span>
            <strong>{cycleSummary.cycleBestMax ?? 'No max yet'}</strong>
          </div>
          <div className="info-tile">
            <span className="metric-label">Current cycle sessions</span>
            <strong>{cycleSummary.totalSessions}</strong>
          </div>
        </div>
        <LineChart
          points={maxTrendPoints.map((point) => ({
            date: point.date,
            value: point.value,
          }))}
        />
      </Section>

      <Section eyebrow="Workload" title="Support volume trend">
        <BarChart bars={supportVolumeTrend} />
      </Section>

      <Section eyebrow="Logbook" title="Recent workouts">
        {recentWorkouts.length === 0 ? (
          <p className="muted-text">
            Your workout history will appear here after the first session is
            logged.
          </p>
        ) : (
          <div className="workout-list">
            {recentWorkouts.slice(0, 12).map((session) => {
              const maxTest = maxBySessionId.get(session.id)
              const exercises = session.entries
                .map((entry) => exerciseById.get(entry.exerciseId)?.name)
                .filter(Boolean)
                .slice(0, 4)

              return (
                <article key={session.id} className="workout-list__item">
                  <div className="workout-list__header">
                    <div>
                      <p className="workout-list__date">
                        {formatLongDate(session.date)}
                      </p>
                      <div className="chip-row">
                        <StatusPill
                          label={session.sessionType}
                          tone="neutral"
                        />
                        <StatusPill label={session.phaseAtTime} tone="accent" />
                        {maxTest ? (
                          <StatusPill
                            label={`${maxTest.reps} reps`}
                            tone="success"
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="workout-list__meta">
                      <span>{session.supportVolume} support points</span>
                    </div>
                  </div>

                  {exercises.length > 0 ? (
                    <p className="muted-text">{exercises.join(' · ')}</p>
                  ) : null}

                  {session.notes ? (
                    <p className="muted-text">{session.notes}</p>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
