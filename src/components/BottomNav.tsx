import { getRouteHref, type AppRoute } from '../app/routes'
import type { SessionType } from '../domain/types'

interface BottomNavProps {
  currentRoute: AppRoute
  recommendedSessionType: SessionType
}

const NAV_ITEMS: Array<{
  label: string
  route: AppRoute
}> = [
  { label: 'Today', route: 'today' },
  { label: 'Workout', route: 'log' },
  { label: 'History', route: 'history' },
  { label: 'Progress', route: 'progress' },
  { label: 'Settings', route: 'profile' },
]

export function BottomNav({
  currentRoute,
  recommendedSessionType,
}: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = item.route === currentRoute
        const href =
          item.route === 'log'
            ? getRouteHref('log', {
                prefill: '1',
                type: recommendedSessionType,
              })
            : getRouteHref(item.route)

        return (
          <a
            key={item.route}
            href={href}
            className={`bottom-nav__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav__label">{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
