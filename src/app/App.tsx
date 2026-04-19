import { useEffect, useState } from 'react'
import { AppProvider, useAppState } from './AppProvider'
import { BottomNav } from '../components/BottomNav'
import { NoticeBanner } from '../components/NoticeBanner'
import { StatusPill } from '../components/StatusPill'
import { navigateTo, useRouteState } from './routes'
import { CycleSummaryScreen } from '../features/cycle-summary/CycleSummaryScreen'
import { ExerciseLibraryScreen } from '../features/exercise-library/ExerciseLibraryScreen'
import { HistoryScreen } from '../features/history/HistoryScreen'
import { LogWorkoutScreen } from '../features/log-workout/LogWorkoutScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import type { SessionType } from '../domain/types'

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
    <div className="loading-state">Loading local training data...</div>
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

    if (route.path === 'progress') {
      content = <ProgressScreen />
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

  const topPills = [
    {
      label: `Next ${data.recommendationState.nextSessionType}`,
      tone: 'accent' as const,
    },
    {
      label: `Trend ${data.recommendationState.trend}`,
      tone:
        data.recommendationState.trend === 'falling'
          ? ('warning' as const)
          : ('success' as const),
    },
    {
      label: data.recommendationState.currentPhase,
      tone: 'neutral' as const,
    },
  ]

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div>
            <p className="app-header__eyebrow">Focused pull-up max training</p>
            <h1 className="app-header__title">Pull-up Max</h1>
          </div>

          <div className="app-header__actions">
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => navigateTo('library')}
            >
              Library
            </button>
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => navigateTo('settings')}
            >
              Program
            </button>
          </div>
        </div>

        <div className="app-header__meta">
          {topPills.map((pill) => (
            <StatusPill key={pill.label} label={pill.label} tone={pill.tone} />
          ))}
          <span className="app-header__movement">{data.athleteProfile.mainMovement}</span>
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
