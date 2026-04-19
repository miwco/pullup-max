import type { AppRoute } from '../app/routes'

interface BottomNavProps {
  currentRoute: AppRoute
  onNavigate: (route: AppRoute) => void
}

const NAV_ITEMS: Array<{
  label: string
  route: AppRoute
}> = [
  { label: 'Today', route: 'today' },
  { label: 'Log', route: 'log' },
  { label: 'History', route: 'history' },
  { label: 'Progress', route: 'progress' },
  { label: 'Cycle', route: 'cycle' },
]

export function BottomNav({ currentRoute, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = item.route === currentRoute

        return (
          <button
            key={item.route}
            type="button"
            className={`bottom-nav__item${active ? ' is-active' : ''}`}
            onClick={() => onNavigate(item.route)}
          >
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
