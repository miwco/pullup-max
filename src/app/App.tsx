import { useEffect, useState } from 'react'
import { getHeaderStatusPillItems } from './headerStatusPills'
import { BottomNav } from '../components/BottomNav'
import { HeaderStatusPillGroup } from '../components/HeaderStatusPillGroup'
import { NoticeBanner } from '../components/NoticeBanner'
import { CycleSummaryScreen } from '../features/cycle-summary/CycleSummaryScreen'
import { ExerciseLibraryScreen } from '../features/exercise-library/ExerciseLibraryScreen'
import { HistoryScreen } from '../features/history/HistoryScreen'
import { LogWorkoutScreen } from '../features/log-workout/LogWorkoutScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import type { SessionType } from '../domain/types'
import { AppProvider, useAppState } from './AppProvider'
import { getRouteHref, navigateTo, useRouteState } from './routes'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

function normalizeSessionType(value: string | null): SessionType | null {
  if (value === 'max' || value === 'support') {
    return value
  }

  return null
}

function renderRouteContent(
  route: ReturnType<typeof useRouteState>,
  data: ReturnType<typeof useAppState>['data'],
  installPrompt: BeforeInstallPromptEvent | null,
  onInstall: () => Promise<void>,
) {
  switch (route.path) {
    case 'today':
      return (
        <TodayScreen
          canInstall={!!installPrompt}
          onInstall={() => void onInstall()}
          onOpenSettings={() => navigateTo('settings')}
          onQuickLog={(sessionType) =>
            navigateTo('log', {
              prefill: '1',
              type: sessionType,
            })
          }
        />
      )
    case 'log':
      return (
        <LogWorkoutScreen
          key={`${route.path}-${route.params.toString()}`}
          prefill={route.params.get('prefill') === '1'}
          requestedType={normalizeSessionType(route.params.get('type'))}
          onSaved={() => navigateTo('today')}
        />
      )
    case 'history':
      return <HistoryScreen />
    case 'progress':
      return <ProgressScreen />
    case 'library':
      return <ExerciseLibraryScreen />
    case 'cycle':
      return <CycleSummaryScreen />
    case 'settings':
      return (
        <SettingsScreen
          key={`settings-${data.recommendationState.computedAt}`}
        />
      )
    default:
      return null
  }
}

function AppShell() {
  const route = useRouteState()
  const { data, errorMessage, isReady, notice, setNotice } = useAppState()
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (!window.location.hash) {
      navigateTo('today')
    }
  }, [])

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () =>
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
  }, [])

  async function handleInstall() {
    if (!installPrompt) {
      return
    }

    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const content = errorMessage ? (
    <div className="loading-state loading-state--error">{errorMessage}</div>
  ) : isReady ? (
    renderRouteContent(route, data, installPrompt, handleInstall)
  ) : (
    <div className="loading-state">Loading local training data...</div>
  )
  const headerStatusPills = getHeaderStatusPillItems({
    currentPhase: data.recommendationState.currentPhase,
    mainMovement: data.athleteProfile.mainMovement,
    nextSessionType: data.recommendationState.nextSessionType,
    trend: data.recommendationState.trend,
  })

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div>
            <p className="app-header__eyebrow">Focused pull-up max training</p>
            <h1 className="app-header__title">Pull-up Max</h1>
          </div>

          <div className="app-header__actions">
            <a
              href={getRouteHref('library')}
              className="button button--ghost button--compact"
            >
              Library
            </a>
            <a
              href={getRouteHref('settings')}
              className="button button--ghost button--compact"
            >
              Program
            </a>
          </div>
        </div>

        <HeaderStatusPillGroup
          className="app-header__meta"
          items={headerStatusPills}
        />
      </header>

      {notice ? (
        <div className="app-notice">
          <NoticeBanner
            message={notice.message}
            tone={notice.tone}
            onDismiss={() => setNotice(null)}
          />
        </div>
      ) : null}

      <main id="main-content" className="app-main" tabIndex={-1}>
        {content}
      </main>

      <BottomNav
        currentRoute={route.path}
        recommendedSessionType={data.recommendationState.nextSessionType}
      />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
