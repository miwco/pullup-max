import { useEffect, useState } from 'react'
import { AppProvider, useAppState } from './AppProvider'
import { BottomNav } from '../components/BottomNav'
import { NoticeBanner } from '../components/NoticeBanner'
import { navigateTo, useRouteState } from './routes'
import { TodayScreen } from '../features/today/TodayScreen'
import { LogWorkoutScreen } from '../features/log-workout/LogWorkoutScreen'
import { HistoryScreen } from '../features/history/HistoryScreen'
import { ExerciseLibraryScreen } from '../features/exercise-library/ExerciseLibraryScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { CycleSummaryScreen } from '../features/cycle-summary/CycleSummaryScreen'
import type { SessionType } from '../domain/types'
import { StatusPill } from '../components/StatusPill'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

function normalizeSessionType(value: string | null): SessionType | null {
  if (
    value === 'max' ||
    value === 'support' ||
    value === 'recovery' ||
    value === 'deload'
  ) {
    return value
  }

  return null
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

  let content = (
    <div className="loading-state">Loading local training data…</div>
  )

  if (errorMessage) {
    content = (
      <div className="loading-state loading-state--error">{errorMessage}</div>
    )
  } else if (isReady) {
    if (route.path === 'today') {
      content = (
        <TodayScreen
          canInstall={!!installPrompt}
          onInstall={handleInstall}
          onOpenSettings={() => navigateTo('settings')}
          onQuickLog={(sessionType) =>
            navigateTo('log', {
              prefill: '1',
              type: sessionType,
            })
          }
        />
      )
    }

    if (route.path === 'log') {
      content = (
        <LogWorkoutScreen
          key={`${route.path}-${route.params.toString()}`}
          prefill={route.params.get('prefill') === '1'}
          requestedType={normalizeSessionType(route.params.get('type'))}
          onSaved={() => navigateTo('today')}
        />
      )
    }

    if (route.path === 'history') {
      content = <HistoryScreen />
    }

    if (route.path === 'library') {
      content = <ExerciseLibraryScreen />
    }

    if (route.path === 'cycle') {
      content = <CycleSummaryScreen />
    }

    if (route.path === 'settings') {
      content = (
        <SettingsScreen
          key={`settings-${data.recommendationState.computedAt}`}
        />
      )
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div>
            <p className="app-header__eyebrow">
              Adaptive pull-up specialization
            </p>
            <h1 className="app-header__title">Pull-up Max</h1>
          </div>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => navigateTo('settings')}
          >
            Settings
          </button>
        </div>

        <div className="app-header__meta">
          <StatusPill label={data.recommendationState.phase} tone="accent" />
          <StatusPill label={data.athleteProfile.mainMovement} tone="neutral" />
          <StatusPill label={data.recommendationState.trend} tone="success" />
        </div>
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

      <main className="app-main">{content}</main>

      <BottomNav
        currentRoute={route.path}
        onNavigate={(nextRoute) => navigateTo(nextRoute)}
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
