import { useEffect, useState } from 'react'
import { getHeaderStatusPillItems } from './headerStatusPills'
import { BottomNav } from '../components/BottomNav'
import { HeaderStatusPillGroup } from '../components/HeaderStatusPillGroup'
import { NoticeBanner } from '../components/NoticeBanner'
import { HistoryScreen } from '../features/history/HistoryScreen'
import { LogWorkoutScreen } from '../features/log-workout/LogWorkoutScreen'
import { FinishWorkoutScreen } from '../features/finish/FinishWorkoutScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { ProfileSettingsScreen } from '../features/settings/ProfileSettingsScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import type { SessionType } from '../domain/types'
import { AppProvider } from './AppProvider'
import { useAppState } from './appContext'
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
  installPrompt: BeforeInstallPromptEvent | null,
  onInstall: () => Promise<void>,
) {
  switch (route.path) {
    case 'today':
      return (
        <TodayScreen
          canInstall={!!installPrompt}
          onInstall={() => void onInstall()}
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
    case 'finish':
      return <FinishWorkoutScreen />
    case 'history':
      return <HistoryScreen />
    case 'progress':
      return <ProgressScreen />
    case 'settings':
      return (
        <SettingsScreen
          initialLibraryOpen={route.params.get('library') === '1'}
        />
      )
    case 'profile':
      return <ProfileSettingsScreen />
    default:
      return null
  }
}

export function AppShell() {
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
    renderRouteContent(route, installPrompt, handleInstall)
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
            <p className="app-header__eyebrow">
              Focused {data.athleteProfile.mainMovement.toLowerCase()} max
              training
            </p>
            <h1 className="app-header__title">
              <a
                href={getRouteHref('today')}
                className="app-header__home-link"
                aria-label="Go to Today"
              >
                Pull-up Max
              </a>
            </h1>
          </div>

          <div className="app-header__actions">
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
