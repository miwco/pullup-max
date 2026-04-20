import { BarChart, CycleLineChart } from '../../components/Charts'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/AppProvider'
import { formatLongDate, todayDateString } from '../../lib/date'

export function HistoryScreen() {
  const {
    allTimeBestMax,
    bodyweightTrendPoints,
    cycleSummary,
    data,
    latestBodyweightEntry,
    maxHistory,
    recentWorkouts,
    supportVolumeTrend,
  } = useAppState()
  const exerciseById = new Map(
    data.exercises.map((exercise) => [exercise.id, exercise]),
  )
  const recentBodyweightEntries = [...data.bodyweightEntries]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 8)

  return (
    <div className="screen-stack">
      <Section eyebrow="Best numbers" title="History snapshot">
        <div className="mini-stat-grid mini-stat-grid--triple">
          <div className="mini-stat">
            <span className="metric-label">Best max all-time</span>
            <strong>{allTimeBestMax ?? 'No max yet'}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Best max this cycle</span>
            <strong>{cycleSummary.cycleBestMax ?? 'No max yet'}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Current baseline</span>
            <strong>{cycleSummary.baselineMax ?? 'No baseline yet'}</strong>
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

      <Section
        eyebrow="Recent volume"
        title="Support volume trend"
        className="section--compact"
      >
        <BarChart bars={supportVolumeTrend} />
      </Section>

      {data.settings.bodyweightTrackingEnabled ? (
        <Section
          eyebrow="Weight history"
          title="Bodyweight progression"
          className="section--compact"
        >
          <CycleLineChart
            cycleWindow={cycleSummary.cycleWindow}
            maxPoints={[]}
            showMax={false}
            showWeight={true}
            today={todayDateString()}
            weightPoints={bodyweightTrendPoints}
          />

          {recentBodyweightEntries.length === 0 ? (
            <p className="muted-text">
              Your saved bodyweight entries will appear here after you log your
              first weight on the Today page.
            </p>
          ) : (
            <div className="workout-list">
              {recentBodyweightEntries.map((entry, index) => {
                const previousEntry = recentBodyweightEntries[index + 1]
                const change =
                  typeof previousEntry?.weightKg === 'number'
                    ? Math.round(
                        (entry.weightKg - previousEntry.weightKg) * 10,
                      ) / 10
                    : null

                return (
                  <article key={entry.id} className="workout-list__item">
                    <div className="workout-list__header">
                      <div>
                        <p className="workout-list__date">
                          {formatLongDate(entry.date)}
                        </p>
                        <div className="chip-row">
                          <StatusPill
                            label={`${entry.weightKg} kg`}
                            tone="neutral"
                          />
                          {change !== null ? (
                            <StatusPill
                              label={`${change > 0 ? '+' : ''}${change} kg`}
                              tone={
                                change === 0
                                  ? 'neutral'
                                  : change > 0
                                    ? 'warning'
                                    : 'success'
                              }
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </Section>
      ) : null}

      <Section
        eyebrow="Max history"
        title="Max-rep history"
        className="section--compact"
      >
        {maxHistory.length === 0 ? (
          <p className="muted-text">
            Your max history will appear here after the first Max day is logged.
          </p>
        ) : (
          <div className="workout-list">
            {maxHistory.map((item) => (
              <article key={item.id} className="workout-list__item">
                <div className="workout-list__header">
                  <div>
                    <p className="workout-list__date">
                      {formatLongDate(item.date)}
                    </p>
                    <div className="chip-row">
                      <StatusPill label={`${item.reps} reps`} tone="success" />
                      <StatusPill label={item.trend} tone="accent" />
                      {typeof item.bodyweightKgSnapshot === 'number' ? (
                        <StatusPill
                          label={`${item.bodyweightKgSnapshot} kg`}
                          tone="neutral"
                        />
                      ) : null}
                      {item.failurePoint ? (
                        <StatusPill label={item.failurePoint} tone="neutral" />
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
            ))}
          </div>
        )}
      </Section>

      <Section
        eyebrow="Recent workouts"
        title="Workout log"
        className="section--compact"
      >
        {recentWorkouts.length === 0 ? (
          <p className="muted-text">
            Your workout history will appear here after the first session is
            logged.
          </p>
        ) : (
          <div className="workout-list">
            {recentWorkouts.slice(0, 12).map((session) => {
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
                        {session.maxReps !== null ? (
                          <StatusPill
                            label={`${session.maxReps} reps`}
                            tone="success"
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="workout-list__meta">
                      <span>{session.supportVolume} volume points</span>
                    </div>
                  </div>

                  {exercises.length > 0 ? (
                    <p className="muted-text">{exercises.join(' / ')}</p>
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
