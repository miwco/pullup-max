import type { ReactNode } from 'react'

interface SectionProps {
  action?: ReactNode
  eyebrow?: string
  title: string
  children: ReactNode
}

export function Section({ action, eyebrow, title, children }: SectionProps) {
  return (
    <section className="section">
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
