import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppState } from '../app/appContext'
import { AppShell } from '../app/App'
import { createSeedData } from '../domain/defaults'
import { HistoryScreen } from '../features/history/HistoryScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { ProfileSettingsScreen } from '../features/settings/ProfileSettingsScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TodayScreen } from '../features/today/TodayScreen'

vi.mock('../app/appContext', () => ({
  useAppState: vi.fn(),
}))

type MockAppState = ReturnType<typeof useAppState>

const mockedUseAppState = vi.mocked(useAppState)

function createMockAppState(): MockAppState {
  const data = createSeedData('2026-04-19')
  const pullUpExercise = data.exercises.find(
    (exercise) => exercise.name === 'Pull-up',
  )
  const topHoldExercise = data.exercises.find(
    (exercise) => exercise.name === 'Top hold',
  )

  data.bodyweightEntries = [
    {
      id: 'weight-1',
      date: '2026-04-08',
      weightKg: 83.1,
    },
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
    allTimeMaxTrendPoints: [
      {
        date: '2026-04-08',
        value: 11,
      },
      {
        date: '2026-04-19',
        value: 13,
      },
    ],
    bodyweightTrendPoints: [
      {
        date: '2026-04-08',
        value: 83.1,
      },
      {
        date: '2026-04-19',
        value: 82.4,
      },
    ],
    cycleMaxTrendPoints: [
      {
        date: '2026-04-08',
        value: 11,
      },
      {
        date: '2026-04-19',
        value: 13,
      },
    ],
    cycleSummary: {
      baselineMax: 12,
      cycleBestMax: 13,
      currentPhase: 'build',
      cycleWindow: {
        start: data.athleteProfile.cycleStartDate,
        end: data.athleteProfile.cycleEndDate,
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
    dismissOnboarding: vi.fn(async () => true),
    errorMessage: null,
    exportBackup: () => '{"ok":true}',
    getProgramPrefill: vi.fn(() => []),
    importBackup: vi.fn(async () => true),
    isReady: true,
    latestBodyweightEntry: data.bodyweightEntries[1] ?? null,
    maxHistory: [
      {
        id: 'max-2',
        date: '2026-04-19',
        reps: 13,
        repDelta: 2,
        bodyweightKgSnapshot: 82.4,
        bodyweightDeltaKg: -0.7,
        videoUrl: 'https://example.com/max-2',
        trend: 'rising',
        failurePoint: 'top',
      },
      {
        id: 'max-1',
        date: '2026-04-08',
        reps: 11,
        repDelta: null,
        bodyweightKgSnapshot: 83.1,
        bodyweightDeltaKg: null,
        trend: 'stable',
      },
    ],
    notice: null,
    painTrendPoints: [],
    recentWorkouts: [
      {
        id: 'session-2',
        date: '2026-04-19',
        sessionType: 'max',
        notes: 'Best set felt crisp.',
        entries: [
          {
            id: 'entry-2',
            workoutSessionId: 'session-2',
            exerciseId: topHoldExercise?.id ?? 'top-hold',
            sets: 2,
            durationSeconds: 20,
            presetKey: 'max-top-hold',
            outcome: 'pass',
            presetTargetMode: 'hold-seconds',
            presetTargetSummary: '2x20s hold',
            isMaxTest: false,
          },
        ],
        supportVolume: 0,
        maxReps: 13,
      },
      {
        id: 'session-1',
        date: '2026-04-15',
        sessionType: 'support',
        notes: 'Volume stayed controlled.',
        entries: [
          {
            id: 'entry-1',
            workoutSessionId: 'session-1',
            exerciseId: pullUpExercise?.id ?? 'pull-up',
            sets: 2,
            reps: 6,
            presetKey: 'support-base',
            outcome: 'pass',
            presetTargetMode: 'reps',
            presetTargetSummary: '2x6',
            isMaxTest: false,
          },
        ],
        supportVolume: 12,
        maxReps: null,
      },
    ],
    resetAllData: vi.fn(async () => {}),
    saveBodyweight: vi.fn(async () => true),
    saveSession: vi.fn(async () => true),
    saveSettingsAndProgram: vi.fn(async () => true),
    setNotice: vi.fn(),
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
    expect(screen.queryByRole('button', { name: /log max day/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit program/i })).toBeNull()
    expect(
      screen.getByRole('button', { name: /install pwa/i }),
    ).toBeInTheDocument()
  })

  it('uses the header brand as the top-level Today link', () => {
    window.location.hash = '#/settings'

    const { container } = render(<AppShell />)
    const header = container.querySelector('.app-header') as HTMLElement | null

    expect(header).not.toBeNull()

    expect(screen.getByRole('link', { name: /go to today/i })).toHaveAttribute(
      'href',
      '#/today',
    )
    expect(within(header!).queryByRole('link', { name: 'Today' })).toBeNull()
    expect(within(header!).queryByRole('link', { name: 'Library' })).toBeNull()
    expect(
      within(header!).getByRole('link', { name: 'Program' }),
    ).toHaveAttribute('href', '#/settings')
  })

  it('renders program blocks collapsed by default with derived summaries', () => {
    render(<SettingsScreen />)

    const volumeToggle = screen.getByRole('button', { name: /volume block/i })
    const finisherToggle = screen.getByRole('button', { name: /finisher/i })

    expect(screen.queryByRole('button', { name: /warm-up/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /main set/i })).toBeNull()
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

  it('keeps a real progress page with a dated max chart and recent max history', async () => {
    const user = userEvent.setup()

    render(<ProgressScreen />)

    expect(
      screen.getByRole('img', { name: /progress across the current cycle/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getAllByText('13').length).toBeGreaterThan(0)
    expect(screen.getByText(/cycle start/i)).toBeInTheDocument()
    expect(screen.getByText(/cycle end/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weight' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /recent max history/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('+2 reps')).toBeInTheDocument()
    expect(screen.getByText('-0.7 kg')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Weight' }))

    expect(screen.getAllByText('Weight').length).toBeGreaterThan(0)
  })

  it('keeps History as a list-only log without charts', () => {
    render(<HistoryScreen />)

    expect(
      screen.getByRole('heading', { name: /workout log/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/volume stayed controlled/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: /progress across the current cycle/i }),
    ).toBeNull()
    expect(screen.queryByText(/cycle snapshot/i)).toBeNull()
  })

  it('supports bidirectional cycle planning with end date and quick length presets', async () => {
    render(<ProfileSettingsScreen />)

    const cycleEndDateInput = screen.getByLabelText(/cycle end date/i)
    const cycleLengthInput = screen.getByLabelText(/cycle length \(days\)/i)

    expect(cycleEndDateInput).toHaveValue('2026-07-17')
    expect(cycleLengthInput).toHaveValue(90)

    fireEvent.change(cycleEndDateInput, {
      target: {
        value: '2026-06-07',
      },
    })

    expect(cycleLengthInput).toHaveValue(50)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /90 days/i }))

    expect(cycleLengthInput).toHaveValue(90)
    expect(cycleEndDateInput).toHaveValue('2026-07-17')
  })

  it('routes the legacy cycle hash to Progress and removes Cycle from primary nav', () => {
    window.location.hash = '#/cycle'

    render(<AppShell />)

    expect(
      screen.getByRole('heading', { name: 'Progress' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cycle' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('routes the legacy library hash into Program with the library section opened', async () => {
    window.location.hash = '#/library'

    render(<AppShell />)

    expect(
      screen.getByRole('heading', { name: /exercise library/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /manage exercises/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByRole('searchbox')).toBeInTheDocument()
  })

  it('limits main movement choices to the four allowed options', async () => {
    render(<ProfileSettingsScreen />)

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

    render(<ProfileSettingsScreen />)

    await user.selectOptions(screen.getByLabelText(/main movement/i), 'Chin-up')
    await user.click(
      screen.getByRole('button', { name: /save settings/i }),
    )

    expect(saveSettingsAndProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        mainMovement: 'Chin-up',
        cycleEndDate: '2026-07-17',
      }),
      expect.not.objectContaining({
        fatigueSensitivity: expect.anything(),
        jointPainSensitivity: expect.anything(),
      }),
      expect.any(Object),
    )
  })
})
