interface ChartPoint {
  date: string
  value: number
}

interface LineChartProps {
  color?: string
  points: ChartPoint[]
}

interface BarChartProps {
  bars: ChartPoint[]
}

function getChartBounds(points: ChartPoint[]) {
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return {
    min,
    max: min === max ? max + 1 : max,
  }
}

export function LineChart({ color = 'var(--accent)', points }: LineChartProps) {
  if (points.length === 0) {
    return <div className="chart-empty">No max tests logged yet.</div>
  }

  const width = 320
  const height = 160
  const paddingX = 16
  const paddingY = 16
  const { min, max } = getChartBounds(points)
  const stepX =
    points.length === 1
      ? width / 2
      : (width - paddingX * 2) / Math.max(1, points.length - 1)
  const coordinates = points.map((point, index) => {
    const x = paddingX + index * stepX
    const ratio = (point.value - min) / Math.max(1, max - min)
    const y = height - paddingY - ratio * (height - paddingY * 2)
    return `${x},${y}`
  })

  return (
    <div className="chart-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        aria-hidden="true"
      >
        <path
          d={`M ${coordinates.join(' L ')}`}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => {
          const coordinate = coordinates[index]!
          const [cx, cy] = coordinate.split(',')
          return (
            <circle
              key={`${point.date}-${point.value}`}
              cx={cx}
              cy={cy}
              r="4"
              fill={color}
            />
          )
        })}
      </svg>
      <div className="chart-axis">
        {points.map((point) => (
          <span key={point.date}>{point.date.slice(5)}</span>
        ))}
      </div>
    </div>
  )
}

export function BarChart({ bars }: BarChartProps) {
  if (bars.length === 0) {
    return <div className="chart-empty">No support volume logged yet.</div>
  }

  const maxValue = Math.max(...bars.map((bar) => bar.value), 1)

  return (
    <div className="bar-chart">
      {bars.map((bar) => (
        <div key={`${bar.date}-${bar.value}`} className="bar-chart__item">
          <div
            className="bar-chart__bar"
            style={{
              height: `${Math.max(12, (bar.value / maxValue) * 100)}%`,
            }}
          />
          <span className="bar-chart__label">{bar.date.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}
