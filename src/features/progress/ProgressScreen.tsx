import { useMemo, useState } from 'react'
import { CycleLineChart } from '../../components/Charts'
import { AccordionSection } from '../../components/AccordionSection'
import { Section } from '../../components/Section'
import { useAppState } from '../../app/appContext'
import {
  getProgressCycleOptions,
  getProgressScope,
} from '../../domain/progressCycles'
import { getFailurePointPattern } from '../../domain/selectors'
import {
  formatLongDate,
  formatShortDate,
  todayDateString,
} from '../../lib/date'
import { WorkoutHistory } from './WorkoutHistory'
import { GreaseGrooveHistory } from './GreaseGrooveHistory'

function formatChange(value: number | null) {
  if (value === null) return 'Not available'
  return `${value >= 0 ? '+' : ''}${value} reps`
}

export function ProgressScreen() {
  const {
    allTimeMaxTrendPoints,
    cycleSummary,
    cycleMaxTrendPoints,
    data,
    deleteGreaseGrooveEntry,
    deleteWorkout,
    maxHistory,
    painTrendPoints,
    recentWorkouts,
    startNextCycle,
    updateWorkout,
    updateGreaseGrooveEntry,
  } = useAppState()
  const today = todayDateString()
  const cycleOptions = useMemo(() => getProgressCycleOptions(data), [data])
  const [viewMode, setViewMode] = useState<'cycles' | 'lifetime'>('cycles')
  const [selectedCycleId, setSelectedCycleId] = useState('current')
  const [painOpen, setPainOpen] = useState(false)
  const [showMax, setShowMax] = useState(true)
  const [showWeight, setShowWeight] = useState(false)
  const selectedCycle =
    cycleOptions.find((cycle) => cycle.id === selectedCycleId) ??
    cycleOptions[0]!
  const isLifetime = viewMode === 'lifetime'
  const scope = useMemo(
    () =>
      getProgressScope(data, isLifetime ? null : selectedCycle, today, {
        maxPoints: isLifetime
          ? allTimeMaxTrendPoints
          : selectedCycle.isCurrent
            ? cycleMaxTrendPoints
            : undefined,
        workouts:
          isLifetime || selectedCycle.isCurrent ? recentWorkouts : undefined,
      }),
    [
      allTimeMaxTrendPoints,
      cycleMaxTrendPoints,
      data,
      isLifetime,
      recentWorkouts,
      selectedCycle,
      today,
    ],
  )
  const hasPainData = painTrendPoints.some(
    (point) => point.elbowAvg !== null || point.shoulderAvg !== null,
  )
  const failurePattern = getFailurePointPattern(maxHistory)
  const scopeLabel = isLifetime
    ? 'Lifetime'
    : selectedCycle.isCurrent
      ? 'Current cycle'
      : 'Completed cycle'
  const historyKey = isLifetime ? 'lifetime' : selectedCycle.id

  return (
    <div className="screen-stack">
      <Section
        eyebrow={scopeLabel}
        title="Progress"
        className="section--compact"
      >
        <div className="segment-row progress-view-toggle">
          <button
            type="button"
            className={`segment-row__item${!isLifetime ? ' is-active' : ''}`}
            aria-pressed={!isLifetime}
            onClick={() => setViewMode('cycles')}
          >
            Cycles
          </button>
          <button
            type="button"
            className={`segment-row__item${isLifetime ? ' is-active' : ''}`}
            aria-pressed={isLifetime}
            onClick={() => setViewMode('lifetime')}
          >
            Lifetime
          </button>
        </div>

        {!isLifetime ? (
          <label className="field progress-cycle-picker">
            <span>Cycle to view</span>
            <select
              aria-label="Cycle to view"
              value={selectedCycle.id}
              onChange={(event) => setSelectedCycleId(event.target.value)}
            >
              {cycleOptions.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.isCurrent ? 'Current - ' : ''}
                  {formatShortDate(cycle.window.start)} to{' '}
                  {formatShortDate(cycle.window.end)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="cycle-window-note">
          <p>
            {isLifetime
              ? `Every saved workout and max test from ${formatLongDate(scope.window.start)} to ${formatLongDate(scope.window.end)}.`
              : `${selectedCycle.isCurrent ? 'Current' : 'Completed'} ${selectedCycle.lengthDays}-day cycle from ${formatLongDate(scope.window.start)} to ${formatLongDate(scope.window.end)}.`}
          </p>
        </div>

        <div className="action-row action-row--compact">
          <button
            type="button"
            className={`chip chip--button${showMax ? ' is-active' : ''}`}
            aria-pressed={showMax}
            onClick={() => setShowMax((current) => !current)}
          >
            Max reps
          </button>
          {data.settings.bodyweightTrackingEnabled ? (
            <button
              type="button"
              className={`chip chip--button${showWeight ? ' is-active' : ''}`}
              aria-pressed={showWeight}
              onClick={() => setShowWeight((current) => !current)}
            >
              Weight
            </button>
          ) : null}
        </div>

        <CycleLineChart
          ariaLabel={
            isLifetime
              ? 'Progress across all time'
              : selectedCycle.isCurrent
                ? 'Progress across the current cycle'
                : 'Progress across the selected cycle'
          }
          cycleWindow={scope.window}
          maxPoints={scope.maxPoints}
          rangeKind={isLifetime ? 'lifetime' : 'cycle'}
          showMax={showMax}
          showPhaseBands={!isLifetime && selectedCycle.isCurrent}
          showWeight={showWeight}
          today={today}
          weightPoints={scope.bodyweightPoints}
          workoutPoints={scope.workoutPoints}
        />

        <p className="muted-text">
          Workout markers along the bottom show Max and Support days. Toggle
          weight to compare it with max-rep changes.
        </p>
      </Section>

      <Section
        eyebrow={isLifetime ? 'All records' : 'Selected cycle'}
        title={isLifetime ? 'Lifetime snapshot' : 'Cycle snapshot'}
      >
        <div className="mini-stat-grid mini-stat-grid--triple">
          <div className="mini-stat">
            <span className="metric-label">First max</span>
            <strong>{scope.firstMax ?? 'No max yet'}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Latest max</span>
            <strong>{scope.latestMax ?? 'No max yet'}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Best max</span>
            <strong>{scope.bestMax ?? 'No max yet'}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">
              {isLifetime ? 'Lifetime change' : 'Cycle change'}
            </span>
            <strong>{formatChange(scope.changeFromFirstMax)}</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Workouts</span>
            <strong>
              {scope.maxSessions} max / {scope.supportSessions} support
            </strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">Training load</span>
            <strong>{scope.trainingLoadPoints} pts</strong>
          </div>
          <div className="mini-stat">
            <span className="metric-label">GG sets</span>
            <strong>{scope.greaseGrooveEntries.length}</strong>
          </div>
          {!isLifetime && selectedCycle.isCurrent ? (
            <>
              <div className="mini-stat">
                <span className="metric-label">Phase</span>
                <strong>{cycleSummary.currentPhase}</strong>
              </div>
              <div className="mini-stat">
                <span className="metric-label">Days remaining</span>
                <strong>{cycleSummary.daysRemaining}</strong>
              </div>
            </>
          ) : (
            <div className="mini-stat">
              <span className="metric-label">Date range</span>
              <strong>
                {formatShortDate(scope.window.start)} -{' '}
                {formatShortDate(scope.window.end)}
              </strong>
            </div>
          )}
        </div>
        <p className="muted-text">
          {scope.maxPoints.length === 0
            ? 'No max tests are logged in this range yet.'
            : `${scope.maxPoints.length} max test${scope.maxPoints.length === 1 ? '' : 's'} and ${scope.workouts.length} workout${scope.workouts.length === 1 ? '' : 's'} are included.`}
        </p>
        {!isLifetime &&
        selectedCycle.isCurrent &&
        cycleSummary.daysRemaining === 0 ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              if (
                window.confirm(
                  'Start a new cycle today? All workout history will be preserved.',
                )
              ) {
                void startNextCycle()
              }
            }}
          >
            Start next cycle
          </button>
        ) : null}
      </Section>

      {hasPainData ? (
        <Section eyebrow="Wellness" title="Pain signals">
          <AccordionSection
            eyebrow="Weekly averages"
            title="Elbow and shoulder pain"
            isOpen={painOpen}
            onToggle={() => setPainOpen((current) => !current)}
            summary={`${painTrendPoints.length} week${painTrendPoints.length === 1 ? '' : 's'} with pain data`}
          >
            <div className="entry-list">
              {painTrendPoints.map((point) => (
                <div
                  key={point.weekStart}
                  className="entry-row entry-row--compact"
                >
                  <div className="field">
                    <span className="metric-label">Week of</span>
                    <strong>{formatShortDate(point.weekStart)}</strong>
                  </div>
                  {point.elbowAvg !== null ? (
                    <div className="field">
                      <span className="metric-label">Elbow</span>
                      <strong>{point.elbowAvg}/5</strong>
                    </div>
                  ) : null}
                  {point.shoulderAvg !== null ? (
                    <div className="field">
                      <span className="metric-label">Shoulder</span>
                      <strong>{point.shoulderAvg}/5</strong>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </AccordionSection>
        </Section>
      ) : null}

      {failurePattern ? (
        <div className="inline-note">
          <p className="muted-text">
            <strong>{failurePattern.point}</strong> has been your failure point
            in {failurePattern.count} of your last{' '}
            {Math.min(
              3,
              maxHistory.filter(
                (item) => item.failurePoint && item.failurePoint !== 'not sure',
              ).length,
            )}{' '}
            max tests; support is automatically targeting this.
          </p>
        </div>
      ) : null}

      <WorkoutHistory
        key={historyKey}
        bodyweightEntries={scope.bodyweightEntries}
        bodyweightTrackingEnabled={data.settings.bodyweightTrackingEnabled}
        exercises={data.exercises}
        eyebrow={scopeLabel}
        emptyMessage={`No workouts are logged in this ${isLifetime ? 'history' : 'cycle'} yet.`}
        onDeleteWorkout={deleteWorkout}
        onUpdateWorkout={updateWorkout}
        title={
          isLifetime
            ? 'All workouts'
            : selectedCycle.isCurrent
              ? 'Past workouts - current cycle'
              : 'Past workouts - selected cycle'
        }
        workouts={scope.workouts}
      />
      <GreaseGrooveHistory
        key={`gg-${historyKey}`}
        entries={scope.greaseGrooveEntries}
        onDelete={deleteGreaseGrooveEntry}
        onUpdate={updateGreaseGrooveEntry}
      />
    </div>
  )
}
