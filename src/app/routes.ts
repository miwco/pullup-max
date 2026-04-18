import { useSyncExternalStore } from 'react'

export type AppRoute =
  | 'today'
  | 'log'
  | 'history'
  | 'library'
  | 'cycle'
  | 'settings'

export interface RouteState {
  path: AppRoute
  params: URLSearchParams
}

const DEFAULT_ROUTE: AppRoute = 'today'

const VALID_ROUTES = new Set<AppRoute>([
  'today',
  'log',
  'history',
  'library',
  'cycle',
  'settings',
])

function normalizeHash(hash: string): RouteState {
  const cleaned = hash.replace(/^#\/?/, '')

  if (!cleaned) {
    return {
      path: DEFAULT_ROUTE,
      params: new URLSearchParams(),
    }
  }

  const [pathPart, queryString = ''] = cleaned.split('?')
  const route = VALID_ROUTES.has(pathPart as AppRoute)
    ? (pathPart as AppRoute)
    : DEFAULT_ROUTE

  return {
    path: route,
    params: new URLSearchParams(queryString),
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('hashchange', onStoreChange)
  return () => window.removeEventListener('hashchange', onStoreChange)
}

function getSnapshot() {
  return normalizeHash(window.location.hash)
}

export function useRouteState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => ({
    path: DEFAULT_ROUTE,
    params: new URLSearchParams(),
  }))
}

export function navigateTo(
  path: AppRoute,
  params?: Record<string, string | undefined>,
) {
  const searchParams = new URLSearchParams()

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value)
    }
  })

  const query = searchParams.toString()
  window.location.hash = query ? `#/${path}?${query}` : `#/${path}`
}
