import type { ReactNode } from 'react'

interface SectionProps {
  action?: ReactNode
  eyebrow?: string
  title: string
  children: ReactNode
  className?: string
  compact?: boolean
  variant?: 'flat' | 'summary'
}

export function Section({
  action,
  eyebrow,
  title,
  children,
  className,
  compact = false,
  variant = 'flat',
}: SectionProps) {
  const classNames = [
    'section',
    `section--${variant}`,
    compact ? 'section--compact' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classNames}>
      <header className="section__header">
        <div>
          {eyebrow ? <p className="section__eyebrow">{eyebrow}</p> : null}
          <h2 className="section__title">{title}</h2>
        </div>
        {action ? <div>{action}</div> : null}
      </header>
      {children}
    </section>
  )
}
