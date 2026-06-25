export type StatusPillTone =
  | 'neutral'
  | 'accent'
  | 'warning'
  | 'success'
  | 'danger'

interface StatusPillProps {
  label: string
  tone?: StatusPillTone
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return <span className={`status-pill status-pill--${tone}`}>{label}</span>
}
