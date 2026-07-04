import { useMemo, useSyncExternalStore } from 'react'

export type AppRoute =
  | 'today'
  | 'log'
  | 'gg'
  | 'finish'
  | 'progress'
  | 'library'
  | 'cycle'
  | 'settings'
  | 'program'

export interface RouteState {
  path: AppRoute
  params: URLSearchParams
}

const DEFAULT_ROUTE: AppRoute = 'today'

const VALID_ROUTES = new Set<AppRoute>([
  'today',
  'log',
  'gg',
  'finish',
  'progress',
  'library',
  'cycle',
  'settings',
  'program',
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
  const params = new URLSearchParams(queryString)

  if (pathPart === 'cycle' || pathPart === 'history') {
    return {
      path: 'progress',
      params,
    }
  }

  if (pathPart === 'library') {
    params.set('library', '1')

    return {
      path: 'program',
      params,
    }
  }

  if (pathPart === 'profile') {
    return {
      path: 'settings',
      params,
    }
  }

  const route = VALID_ROUTES.has(pathPart as AppRoute)
    ? (pathPart as AppRoute)
    : DEFAULT_ROUTE

  return {
    path: route,
    params,
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('hashchange', onStoreChange)
  return () => window.removeEventListener('hashchange', onStoreChange)
}

function getSnapshot() {
  return window.location.hash
}

export function useRouteState() {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '')

  return useMemo(() => normalizeHash(hash), [hash])
}

export function navigateTo(
  path: AppRoute,
  params?: Record<string, string | undefined>,
) {
  window.location.hash = getRouteHref(path, params)
}

export function getRouteHref(
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
  return query ? `#/${path}?${query}` : `#/${path}`
}
