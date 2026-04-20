import type { ReactNode } from 'react'

interface AccordionSectionProps {
  children: ReactNode
  eyebrow?: string
  isOpen: boolean
  onToggle: () => void
  summary?: ReactNode
  title: string
}

export function AccordionSection({
  children,
  eyebrow,
  isOpen,
  onToggle,
  summary,
  title,
}: AccordionSectionProps) {
  const sectionId = `accordion-${title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <section className={`accordion-section${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="accordion-section__toggle"
        aria-controls={sectionId}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <div className="accordion-section__copy">
          {eyebrow ? (
            <p className="accordion-section__eyebrow">{eyebrow}</p>
          ) : null}
          <h3 className="accordion-section__title">{title}</h3>
          {summary ? (
            <p className="accordion-section__summary">{summary}</p>
          ) : null}
        </div>
        <span className="accordion-section__icon" aria-hidden="true">
          {isOpen ? '-' : '+'}
        </span>
      </button>

      {isOpen ? (
        <div id={sectionId} className="accordion-section__body">
          {children}
        </div>
      ) : null}
    </section>
  )
}
