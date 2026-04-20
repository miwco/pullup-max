import type { ReactNode } from 'react'

interface SectionProps {
  action?: ReactNode
  eyebrow?: string
  className?: string
  contentClassName?: string
  title: string
  children: ReactNode
  variant?: 'flat' | 'summary'
}

export function Section({
  action,
  eyebrow,
  className,
  contentClassName,
  title,
  children,
  variant = 'flat',
}: SectionProps) {
  const sectionClassName = ['section', `section--${variant}`, className]
    .filter(Boolean)
    .join(' ')
  const contentClassNames = ['section__content', contentClassName]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={sectionClassName}>
      <header className="section__header">
        <div>
          {eyebrow ? <p className="section__eyebrow">{eyebrow}</p> : null}
          <h2 className="section__title">{title}</h2>
        </div>
        {action ? <div>{action}</div> : null}
      </header>
      <div className={contentClassNames}>{children}</div>
    </section>
  )
}
