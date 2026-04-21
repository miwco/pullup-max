import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppState } from '../app/AppProvider'
import { AppShell } from '../app/App'
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
    expect(
      screen.queryByRole('button', { name: /log max day/i }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /edit program/i }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: /install pwa/i }),
    ).toBeInTheDocument()
  })

  it('uses the header brand as the top-level Today link', () => {
    window.location.hash = '#/settings'

    const { container } = render(<AppShell />)
    const header = container.querySelector('.app-header') as HTMLElement | null

    expect(header).not.toBeNull()

    expect(
      screen.getByRole('link', { name: /go to today/i }),
      ).toHaveAttribute('href', '#/today')
    expect(within(header!).queryByRole('link', { name: 'Today' })).toBeNull()
    expect(
      within(header!).getByRole('link', { name: 'Library' }),
    ).toHaveAttribute('href', '#/library')
    expect(
      within(header!).getByRole('link', { name: 'Program' }),
    ).toHaveAttribute('href', '#/settings')
  })

  it('renders program blocks collapsed by default with derived summaries', () => {
    render(<SettingsScreen />)

    const volumeToggle = screen.getByRole('button', { name: /volume block/i })
    const finisherToggle = screen.getByRole('button', { name: /finisher/i })
    const mainMovementSelect = screen.getByLabelText(/main movement/i)

    expect(screen.queryByRole('button', { name: /warm-up/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /main set/i })).toBeNull()
    expect(mainMovementSelect).toHaveDisplayValue('Pull-up')
    expect(screen.queryByLabelText(/fatigue sensitivity/i)).toBeNull()
    expect(screen.queryByLabelText(/joint-pain sensitivity/i)).toBeNull()
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

  it('shows EMOM inputs only on EMOM-based program steps', async () => {
    const user = userEvent.setup()

    render(<SettingsScreen />)

    await user.click(screen.getByRole('button', { name: /volume block/i }))
    expect(screen.getByLabelText(/emom min/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/emom reps/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/hold sec/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /finisher/i }))
    expect(screen.queryByLabelText(/emom min/i)).toBeNull()
    expect(screen.queryByLabelText(/emom reps/i)).toBeNull()
    expect(screen.getByLabelText(/hold sec/i)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /generic support fallback/i }),
    )
    expect(screen.queryByLabelText(/emom min/i)).toBeNull()
    expect(screen.queryByLabelText(/emom reps/i)).toBeNull()
    expect(screen.getByLabelText(/reps/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/hold sec/i)).toBeInTheDocument()
  })

  it('limits main movement choices to the four allowed options', async () => {
    render(<SettingsScreen />)

    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent)
      .filter((label) =>
        ['Pull-up', 'Chin-up', 'Neutral-grip pull-up', 'Ring pull-up'].includes(
          label ?? '',
        ),
      )

    expect(options).toEqual([
      'Pull-up',
      'Chin-up',
      'Neutral-grip pull-up',
      'Ring pull-up',
    ])
  })

  it('saves the selected main movement without sensitivity controls', async () => {
    const user = userEvent.setup()
    const saveSettingsAndProgram = vi.fn(async () => true)
    mockedUseAppState.mockReturnValue({
      ...createMockAppState(),
      saveSettingsAndProgram,
    })

    render(<SettingsScreen />)

    await user.selectOptions(
      screen.getByLabelText(/main movement/i),
      'Chin-up',
    )
    await user.click(
      screen.getByRole('button', { name: /save settings & program/i }),
    )

    expect(saveSettingsAndProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        mainMovement: 'Chin-up',
      }),
      expect.not.objectContaining({
        fatigueSensitivity: expect.anything(),
        jointPainSensitivity: expect.anything(),
      }),
      expect.any(Object),
    )
  })
})
