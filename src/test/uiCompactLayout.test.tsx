import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppState } from '../app/AppProvider'
import { createSeedData } from '../domain/defaults'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TodayScreen } from '../features/today/TodayScreen'

vi.mock('../app/AppProvider', () => ({
  useAppState: vi.fn(),
}))

type MockAppState = ReturnType<typeof useAppState>

const mockedUseAppState = vi.mocked(useAppState)

function createMockAppState(): MockAppState {
  const data = createSeedData('2026-04-19')

  data.bodyweightEntries = [
    {
      id: 'weight-today',
      date: '2026-04-19',
      weightKg: 82.4,
    },
  ]
  data.recommendationState = {
    ...data.recommendationState,
    nextSessionType: 'support',
    maxReadinessSatisfied: false,
    baselineMax: 12,
    currentPhase: 'build',
    trend: 'stable',
    defaultSupportFocus: 'middle',
    suggestedExercises: ['Pull-up', 'Mid-pause pull-up', 'Negative pull-up'],
    explanation:
      'Support day is recommended so you can build volume without breaking freshness for the next max test.',
  }

  return {
    activeExercises: data.exercises.filter((exercise) => exercise.active),
    allTimeBestMax: 13,
    bodyweightTrendPoints: [],
    cycleMaxTrendPoints: [],
    cycleSummary: {
      baselineMax: 12,
      cycleBestMax: 13,
      currentPhase: 'build',
      cycleWindow: {
        start: '2026-04-01',
        end: '2026-06-29',
      },
      daysElapsed: 18,
      daysRemaining: 52,
      maxSessions: 2,
      progressPercent: 26,
      supportSessions: 4,
      summary: 'Progress is steady and freshness is being preserved well.',
      totalSessions: 6,
    },
    data,
    daysSinceLastMax: 8,
    daysSinceLastWorkout: 3,
    deleteExercise: vi.fn(async () => {}),
    errorMessage: null,
    exportBackup: () => '{"ok":true}',
    getProgramPrefill: vi.fn(() => []),
    importBackup: vi.fn(async () => true),
    isReady: true,
    latestBodyweightEntry: data.bodyweightEntries[0] ?? null,
    maxHistory: [],
    notice: null,
    recentWorkouts: [],
    resetAllData: vi.fn(async () => {}),
    saveBodyweight: vi.fn(async () => true),
    saveSession: vi.fn(async () => true),
    saveSettingsAndProgram: vi.fn(async () => true),
    setNotice: vi.fn(),
    supportVolumeTrend: [],
    weeklyVolumeSummary: {
      brakeApplied: false,
      completedPoints: 28,
      message: 'You are on track for this week.',
      remainingPoints: 20,
      targetPoints: 48,
      volumeStatus: 'on-track',
      weekEnd: '2026-04-20',
      weekNumber: 3,
      weekStart: '2026-04-14',
    },
    updateExercise: vi.fn(async () => {}),
  }
}

describe('compact hybrid UI refresh', () => {
  beforeEach(() => {
    mockedUseAppState.mockReturnValue(createMockAppState())
  })

  it('renders Today with one compact summary block and key compact actions', () => {
    const { container } = render(
      <TodayScreen
        canInstall={true}
        onInstall={vi.fn()}
        onOpenSettings={vi.fn()}
        onQuickLog={vi.fn()}
      />,
    )

    expect(container.querySelectorAll('.section--summary')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: /log recommended workout/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /save today's weight/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /explain how weekly volume is counted/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders program blocks collapsed by default with derived summaries', () => {
    render(<SettingsScreen />)

    const volumeToggle = screen.getByRole('button', { name: /volume block/i })
    const finisherToggle = screen.getByRole('button', { name: /finisher/i })

    expect(screen.queryByRole('button', { name: /warm-up/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /main set/i })).toBeNull()
    expect(volumeToggle).toHaveAttribute('aria-expanded', 'false')
    expect(finisherToggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByText(
        (content) =>
          content.includes('1 step') && content.includes('EMOM pull-up block'),
      ),
    ).toBeInTheDocument()
  })

  it('keeps a single program block open at a time', async () => {
    const user = userEvent.setup()

    render(<SettingsScreen />)

    const volumeToggle = screen.getByRole('button', { name: /volume block/i })
    const finisherToggle = screen.getByRole('button', { name: /finisher/i })

    await user.click(volumeToggle)
    expect(volumeToggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByDisplayValue(
        /adjust reps if needed so you can complete all 10 minutes with clean form/i,
      ),
    ).toBeInTheDocument()

    await user.click(finisherToggle)
    expect(volumeToggle).toHaveAttribute('aria-expanded', 'false')
    expect(finisherToggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByDisplayValue(
        /chin above bar\. gradually try to increase the hold time over the weeks\./i,
      ),
    ).toBeInTheDocument()
  })
})
