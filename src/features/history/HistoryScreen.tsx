import { useState } from 'react'
import { Section } from '../../components/Section'
import { StatusPill } from '../../components/StatusPill'
import { useAppState } from '../../app/appContext'
import { formatLongDate } from '../../lib/date'
import { formatQualityFlag, getQualityTone } from '../../lib/qualityFlag'

const PAGE_SIZE = 12

export function HistoryScreen() {
  const { data, recentWorkouts } = useAppState()
  const [visibleWorkouts, setVisibleWorkouts] = useState(PAGE_SIZE)
  const [visibleWeightEntries, setVisibleWeightEntries] = useState(PAGE_SIZE)

  const exerciseById = new Map(
    data.exercises.map((exercise) => [exercise.id, exercise]),
  )
  const sortedBodyweightEntries = [...data.bodyweightEntries].sort(
    (left, right) => right.date.localeCompare(left.date),
  )

  return (
    <div className="screen-stack">
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
          <>
            <div className="workout-list">
              {recentWorkouts.slice(0, visibleWorkouts).map((session) => {
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
                            <>
                              <StatusPill
                                label={`${session.maxReps} reps`}
                                tone={getQualityTone(session.qualityFlag)}
                              />
                              {formatQualityFlag(session.qualityFlag) ? (
                                <StatusPill
                                  label={
                                    formatQualityFlag(session.qualityFlag)!
                                  }
                                  tone={getQualityTone(session.qualityFlag)}
                                />
                              ) : null}
                            </>
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
            {recentWorkouts.length > visibleWorkouts ? (
              <button
                className="button button--ghost button--compact"
                style={{ marginTop: '0.75rem' }}
                onClick={() => setVisibleWorkouts((n) => n + PAGE_SIZE)}
              >
                Show more ({recentWorkouts.length - visibleWorkouts} remaining)
              </button>
            ) : null}
          </>
        )}
      </Section>

      {data.settings.bodyweightTrackingEnabled ? (
        <Section
          eyebrow="Bodyweight"
          title="Weight log"
          className="section--compact"
        >
          {sortedBodyweightEntries.length === 0 ? (
            <p className="muted-text">
              Your saved bodyweight entries will appear here after you log your
              first weight on the Today page.
            </p>
          ) : (
            <>
              <div className="workout-list">
                {sortedBodyweightEntries
                  .slice(0, visibleWeightEntries)
                  .map((entry, index) => {
                    const previousEntry = sortedBodyweightEntries[index + 1]
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
                                  tone="neutral"
                                />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
              </div>
              {sortedBodyweightEntries.length > visibleWeightEntries ? (
                <button
                  className="button button--ghost button--compact"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => setVisibleWeightEntries((n) => n + PAGE_SIZE)}
                >
                  Show more (
                  {sortedBodyweightEntries.length - visibleWeightEntries}{' '}
                  remaining)
                </button>
              ) : null}
            </>
          )}
        </Section>
      ) : null}
    </div>
  )
}
