import type { CycleWindow, ProgressPoint, SessionType } from '../domain/types'
import { diffInDays, formatShortDate } from '../lib/date'

interface CycleLineChartProps {
  ariaLabel?: string
  cycleWindow: CycleWindow
  maxPoints: ProgressPoint[]
  showMax: boolean
  showPhaseBands?: boolean
  showWeight: boolean
  today: string
  weightPoints: ProgressPoint[]
  workoutPoints?: Array<{ date: string; sessionType: SessionType }>
  rangeKind?: 'cycle' | 'lifetime'
}

interface BarChartProps {
  bars: ProgressPoint[]
}

function getChartBounds(points: ProgressPoint[], padding = 1) {
  if (points.length === 0) {
    return {
      min: 0,
      max: 1,
    }
  }

  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return {
    min: Math.max(0, min - padding),
    max: min === max ? max + padding : max + padding,
  }
}

function getHorizontalPosition(
  date: string,
  cycleWindow: CycleWindow,
  width: number,
) {
  const totalDays = Math.max(1, diffInDays(cycleWindow.start, cycleWindow.end))
  const offset = Math.min(totalDays, diffInDays(cycleWindow.start, date))
  return (offset / totalDays) * width
}

export function CycleLineChart({
  ariaLabel = 'Progress across the current cycle',
  cycleWindow,
  maxPoints,
  showMax,
  showPhaseBands = true,
  showWeight,
  today,
  weightPoints,
  workoutPoints = [],
  rangeKind = 'cycle',
}: CycleLineChartProps) {
  const width = 320
  const height = 180
  const padding = {
    top: 20,
    right: 14,
    bottom: 28,
    left: 18,
  }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const showTodayReference =
    today >= cycleWindow.start && today <= cycleWindow.end
  const todayX = showTodayReference
    ? padding.left + getHorizontalPosition(today, cycleWindow, innerWidth)
    : null

  const maxBounds = getChartBounds(maxPoints, 1)
  const weightBounds = getChartBounds(weightPoints, 1)
  const maxCoordinates = maxPoints.map((point) => {
    const x =
      padding.left + getHorizontalPosition(point.date, cycleWindow, innerWidth)
    const ratio =
      (point.value - maxBounds.min) / Math.max(1, maxBounds.max - maxBounds.min)
    const y = padding.top + innerHeight - ratio * innerHeight
    return {
      ...point,
      x,
      y,
    }
  })
  const weightCoordinates = weightPoints.map((point) => {
    const x =
      padding.left + getHorizontalPosition(point.date, cycleWindow, innerWidth)
    const ratio =
      (point.value - weightBounds.min) /
      Math.max(1, weightBounds.max - weightBounds.min)
    const y = padding.top + innerHeight - ratio * innerHeight
    return {
      ...point,
      x,
      y,
    }
  })
  const hasSelectedSeries = showMax || showWeight
  const hasVisibleData =
    (showMax && maxCoordinates.length > 0) ||
    (showWeight && weightCoordinates.length > 0)
  const phaseLabels = ['Build', 'Develop', 'Peak']
  const workoutCoordinates = workoutPoints.map((point) => ({
    ...point,
    x:
      padding.left + getHorizontalPosition(point.date, cycleWindow, innerWidth),
  }))

  return (
    <div className="chart-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        aria-label={ariaLabel}
      >
        {showPhaseBands
          ? phaseLabels.map((label, index) => {
              const x = padding.left + (innerWidth / 3) * index

              return (
                <g key={label}>
                  <rect
                    x={x}
                    y={padding.top}
                    width={innerWidth / 3}
                    height={innerHeight}
                    className={`chart-phase-band chart-phase-band--${index}`}
                  />
                  <text
                    x={x + innerWidth / 6}
                    y={padding.top + 14}
                    textAnchor="middle"
                    className="chart-phase-label"
                  >
                    {label}
                  </text>
                </g>
              )
            })
          : null}

        <rect
          x={padding.left}
          y={padding.top}
          width={innerWidth}
          height={innerHeight}
          className="chart-window"
        />

        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + innerHeight * ratio
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={padding.left + innerWidth}
              y2={y}
              className="chart-grid-line"
            />
          )
        })}

        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + innerHeight}
          className="chart-reference-line"
        />
        {todayX !== null ? (
          <line
            x1={todayX}
            y1={padding.top}
            x2={todayX}
            y2={padding.top + innerHeight}
            className="chart-reference-line chart-reference-line--today"
          />
        ) : null}
        <line
          x1={padding.left + innerWidth}
          y1={padding.top}
          x2={padding.left + innerWidth}
          y2={padding.top + innerHeight}
          className="chart-reference-line"
        />

        {showMax && maxCoordinates.length > 0 ? (
          <>
            <path
              d={`M ${maxCoordinates.map((point) => `${point.x},${point.y}`).join(' L ')}`}
              className="chart-line chart-line--max"
            />

            {maxCoordinates.map((point) => (
              <g key={`max-${point.date}-${point.value}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4.5"
                  className="chart-point chart-point--max"
                />
                <text
                  x={point.x}
                  y={point.y - 10}
                  textAnchor="middle"
                  className="chart-point-label"
                >
                  {point.value}
                </text>
              </g>
            ))}
          </>
        ) : null}

        {showWeight && weightCoordinates.length > 0 ? (
          <>
            <path
              d={`M ${weightCoordinates.map((point) => `${point.x},${point.y}`).join(' L ')}`}
              className="chart-line chart-line--weight"
            />

            {weightCoordinates.map((point) => (
              <g key={`weight-${point.date}-${point.value}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  className="chart-point chart-point--weight"
                />
              </g>
            ))}
          </>
        ) : null}

        {workoutCoordinates.map((point, index) =>
          point.sessionType === 'max' ? (
            <circle
              key={`workout-${point.date}-${index}`}
              cx={point.x}
              cy={padding.top + innerHeight - 5}
              r="2.5"
              className="chart-workout-marker chart-workout-marker--max"
            />
          ) : (
            <rect
              key={`workout-${point.date}-${index}`}
              x={point.x - 2}
              y={padding.top + innerHeight - 7}
              width="4"
              height="4"
              rx="1"
              className="chart-workout-marker chart-workout-marker--support"
            />
          ),
        )}

        {showMax && maxCoordinates.length > 0 ? (
          <g>
            <text
              x={padding.left}
              y={padding.top - 4}
              textAnchor="start"
              className="chart-axis-label"
            >
              {maxBounds.max} reps
            </text>
          </g>
        ) : null}

        {showWeight && weightCoordinates.length > 0 ? (
          <g>
            <text
              x={padding.left + innerWidth}
              y={padding.top - 4}
              textAnchor="end"
              className="chart-axis-label"
            >
              {weightBounds.max} kg
            </text>
          </g>
        ) : null}
      </svg>

      <div className="chart-axis chart-axis--cycle">
        <span>
          <small>
            {rangeKind === 'lifetime' ? 'First record' : 'Cycle start'}
          </small>
          <strong>{formatShortDate(cycleWindow.start)}</strong>
        </span>
        <span>
          {showTodayReference && rangeKind === 'cycle' ? (
            <>
              <small>Today</small>
              <strong>{formatShortDate(today)}</strong>
            </>
          ) : null}
        </span>
        <span>
          <small>{rangeKind === 'lifetime' ? 'Latest' : 'Cycle end'}</small>
          <strong>{formatShortDate(cycleWindow.end)}</strong>
        </span>
      </div>

      <div className="chip-row">
        {showMax ? <span className="chip">Max reps</span> : null}
        {showWeight ? <span className="chip">Weight</span> : null}
        {workoutPoints.some((point) => point.sessionType === 'max') ? (
          <span className="chip">
            <i className="chart-legend-dot chart-legend-dot--max" />
            Max workout
          </span>
        ) : null}
        {workoutPoints.some((point) => point.sessionType === 'support') ? (
          <span className="chip">
            <i className="chart-legend-dot chart-legend-dot--support" />
            Support workout
          </span>
        ) : null}
      </div>

      {!hasSelectedSeries ? (
        <div className="chart-empty">Select a series to view progress.</div>
      ) : null}

      {hasSelectedSeries &&
      !hasVisibleData &&
      showMax &&
      maxCoordinates.length === 0 ? (
        <div className="chart-empty">
          No max tests are logged in this range yet.
        </div>
      ) : null}

      {hasSelectedSeries &&
      !hasVisibleData &&
      showWeight &&
      weightCoordinates.length === 0 ? (
        <div className="chart-empty">
          No bodyweight entries are logged in this range yet.
        </div>
      ) : null}
    </div>
  )
}

export function BarChart({ bars }: BarChartProps) {
  if (bars.length === 0) {
    return <div className="chart-empty">No support load logged yet.</div>
  }

  const maxValue = Math.max(...bars.map((bar) => bar.value), 1)

  return (
    <div className="bar-chart">
      {bars.map((bar) => (
        <div key={`${bar.date}-${bar.value}`} className="bar-chart__item">
          <div
            className="bar-chart__bar"
            style={{
              height: `${Math.max(14, (bar.value / maxValue) * 100)}%`,
            }}
          />
          <span className="bar-chart__value">{bar.value}</span>
          <span className="bar-chart__label">{formatShortDate(bar.date)}</span>
        </div>
      ))}
    </div>
  )
}
