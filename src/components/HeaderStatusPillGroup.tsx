import { useEffect, useRef, useState, type FocusEvent } from 'react'
import type { HeaderStatusPillItem } from '../app/headerStatusPills'

interface HeaderStatusPillGroupProps {
  className?: string
  items: HeaderStatusPillItem[]
}

interface HeaderStatusPillProps {
  activeId: string | null
  item: HeaderStatusPillItem
  onActivate: (id: string) => void
  onDeactivate: (id: string) => void
  onToggle: (id: string) => void
  pinnedId: string | null
}

function HeaderStatusPill({
  activeId,
  item,
  onActivate,
  onDeactivate,
  onToggle,
  pinnedId,
}: HeaderStatusPillProps) {
  const isOpen = activeId === item.id
  const popoverId = `header-status-pill-${item.id}`

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return
    }

    onDeactivate(item.id)
  }

  return (
    <div
      className={`header-status-pill header-status-pill--${item.align ?? 'start'}`}
      onBlurCapture={handleBlur}
      onFocusCapture={() => onActivate(item.id)}
      onMouseEnter={() => onActivate(item.id)}
      onMouseLeave={() => onDeactivate(item.id)}
    >
      <button
        type="button"
        className={`status-pill status-pill--${item.tone ?? 'neutral'} header-status-pill__button${isOpen ? ' is-open' : ''}${pinnedId === item.id ? ' is-pinned' : ''}`}
        aria-controls={popoverId}
        aria-describedby={isOpen ? popoverId : undefined}
        aria-expanded={isOpen}
        onClick={() => onToggle(item.id)}
      >
        {item.label}
      </button>

      {isOpen ? (
        <div
          id={popoverId}
          role="tooltip"
          className="header-status-pill__popover"
        >
          <p className="header-status-pill__title">{item.title}</p>
          <p className="header-status-pill__body">{item.body}</p>
        </div>
      ) : null}
    </div>
  )
}

export function HeaderStatusPillGroup({
  className,
  items,
}: HeaderStatusPillGroupProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (groupRef.current?.contains(event.target as Node)) {
        return
      }

      setActiveId(null)
      setPinnedId(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      setActiveId(null)
      setPinnedId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function handleActivate(id: string) {
    setActiveId(id)

    if (pinnedId && pinnedId !== id) {
      setPinnedId(null)
    }
  }

  function handleDeactivate(id: string) {
    if (pinnedId === id) {
      return
    }

    setActiveId((current) => (current === id ? null : current))
  }

  function handleToggle(id: string) {
    if (pinnedId === id) {
      setPinnedId(null)
      setActiveId(null)
      return
    }

    setPinnedId(id)
    setActiveId(id)
  }

  return (
    <div
      ref={groupRef}
      className={['header-status-pill-group', className].filter(Boolean).join(' ')}
    >
      {items.map((item) => (
        <HeaderStatusPill
          key={item.id}
          activeId={activeId}
          item={item}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
          onToggle={handleToggle}
          pinnedId={pinnedId}
        />
      ))}
    </div>
  )
}
