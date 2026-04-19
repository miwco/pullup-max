import { useId, useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  eyebrow?: string
  summary: string
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({
  title,
  eyebrow,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <section className={`accordion${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="accordion__trigger"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="accordion__heading">
          {eyebrow ? <p className="accordion__eyebrow">{eyebrow}</p> : null}
          <h3 className="accordion__title">{title}</h3>
          <p className="accordion__summary">{summary}</p>
        </div>
        <span className="accordion__icon" aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen ? (
        <div id={contentId} className="accordion__content">
          {children}
        </div>
      ) : null}
    </section>
  )
}
