import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppState } from '../app/appContext'
import { createSeedData } from '../domain/defaults'
import type { ProgramEntryDraft, SessionType } from '../domain/types'
import { LogWorkoutScreen } from '../features/log-workout/LogWorkoutScreen'
import { playTone } from '../lib/timerSound'

vi.mock('../app/appContext', () => ({
  useAppState: vi.fn(),
}))

vi.mock('../lib/timerSound', () => ({
  playTone: vi.fn(),
}))

type MockAppState = ReturnType<typeof useAppState>

const mockedUseAppState = vi.mocked(useAppState)

function createPrefillRow(
  overrides: Partial<ProgramEntryDraft> = {},
): ProgramEntryDraft {
  return {
    templateStepId: 'template-step',
    presetKey: 'template-step',
    label: 'Default block',
    exerciseId: 'exercise-id',
    exerciseName: 'Pull-up',
    target: {
      mode: 'reps',
      summary: '4x4',
      entrySets: 4,
      entryReps: 4,
    },
    notes: '',
    outcome: '',
    ...overrides,
  }
}

function createMockAppState(): MockAppState {
  const data = createSeedData('2026-04-19')
  const emom = data.exercises.find(
    (exercise) => exercise.name === 'EMOM pull-up block',
  )
  const topHold = data.exercises.find(
    (exercise) => exercise.name === 'Top hold',
  )

  const prefills: Record<SessionType, ProgramEntryDraft[]> = {
    max: [
      createPrefillRow({
        templateStepId: 'max-row',
        presetKey: 'max-row',
        label: 'EMOM pull-up block',
        exerciseId: emom?.id ?? 'emom',
        exerciseName: 'EMOM pull-up block',
        target: {
          mode: 'emom',
          summary: '10m EMOM @ 3',
          entrySets: 1,
          entryReps: 30,
          emomMinutes: 10,
          emomSegments: [{ sets: 10, reps: 3 }],
        },
      }),
      createPrefillRow({
        templateStepId: 'max-top-hold',
        presetKey: 'max-top-hold',
        label: 'Top hold',
        exerciseId: topHold?.id ?? 'top-hold',
        exerciseName: 'Top hold',
        target: {
          mode: 'hold-seconds',
          summary: '2x20s hold',
          entrySets: 2,
          entryDurationSeconds: 20,
        },
      }),
    ],
    support: [
      createPrefillRow({
        templateStepId: 'support-row',
        presetKey: 'support-row',
        label: 'Top holds',
        exerciseId: topHold?.id ?? 'top-hold',
        exerciseName: 'Top hold',
        target: {
          mode: 'hold-seconds',
          summary: '2x22s hold',
          entrySets: 2,
          entryDurationSeconds: 22,
        },
      }),
    ],
  }

  return {
    activeExercises: data.exercises.filter((exercise) => exercise.active),
    allTimeBestMax: null,
    allTimeMaxTrendPoints: [],
    bodyweightTrendPoints: [],
    cycleMaxTrendPoints: [],
    cycleSummary: {
      baselineMax: null,
      cycleBestMax: null,
      currentPhase: 'build',
      cycleWindow: {
        start: '2026-04-01',
        end: '2026-06-29',
      },
      daysElapsed: 18,
      daysRemaining: 52,
      maxSessions: 0,
      progressPercent: 0,
      supportSessions: 0,
      summary: 'No cycle summary yet.',
      totalSessions: 0,
    },
    data,
    daysSinceLastMax: null,
    daysSinceLastWorkout: null,
    clearWorkoutDraft: vi.fn(async () => true),
    clearFinishWorkoutDraft: vi.fn(async () => true),
    deleteExercise: vi.fn(async () => {}),
    deleteGreaseGrooveEntry: vi.fn(async () => true),
    dismissOnboarding: vi.fn(async () => true),
    errorMessage: null,
    exportBackup: () => '{"ok":true}',
    getProgramPrefill: vi.fn((type: SessionType) => prefills[type]),
    importBackup: vi.fn(async () => true),
    isReady: true,
    finishWorkoutDraft: null,
    latestBodyweightEntry: null,
    maxHistory: [],
    notice: null,
    painTrendPoints: [],
    recentWorkouts: [],
    requestPersistentStorage: vi.fn(async () => true),
    resetAllData: vi.fn(async () => {}),
    saveBodyweight: vi.fn(async () => true),
    saveGreaseGrooveEntry: vi.fn(async () => true),
    saveSession: vi.fn(async () => true),
    saveFinishWorkout: vi.fn(async () => true),
    saveFinishWorkoutDraft: vi.fn(async () => true),
    saveFinishWorkoutSettings: vi.fn(async () => true),
    saveSettingsAndProgram: vi.fn(async () => true),
    saveWorkoutDraft: vi.fn(async () => true),
    setNotice: vi.fn(),
    storageDurability: {
      isPersisted: false,
      isSupported: true,
    },
    updateExercise: vi.fn(async () => {}),
    weeklyVolumeSummary: {
      brakeApplied: false,
      completedPoints: 0,
      message: 'No volume logged yet.',
      remainingPoints: 48,
      targetPoints: 48,
      volumeStatus: 'on-track',
      weekEnd: '2026-04-20',
      weekNumber: 3,
      weekStart: '2026-04-14',
    },
    workoutDraft: null,
  }
}

describe('LogWorkoutScreen preset rows', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockedUseAppState.mockReturnValue(createMockAppState())
    vi.restoreAllMocks()
    vi.mocked(playTone).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('renders compact pass/fail controls and removes manual row inputs', () => {
    const { container } = render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    const emomRow = container
      .querySelector('[aria-label="Outcome for EMOM pull-up block"]')
      ?.closest('.entry-row')
    const emomTimer = emomRow?.querySelector('.timer-panel')
    const emomOutcome = emomRow?.querySelector(
      '[aria-label="Outcome for EMOM pull-up block"]',
    )

    expect(screen.getByText('10m EMOM @ 3')).toBeInTheDocument()
    expect(
      screen.getByRole('radiogroup', {
        name: /outcome for emom pull-up block/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^pass$/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^fail$/i })).toHaveLength(2)
    expect(screen.queryByLabelText(/block label/i)).toBeNull()
    expect(screen.queryByLabelText(/^exercise$/i)).toBeNull()
    expect(screen.queryByLabelText(/^seconds$/i)).toBeNull()
    expect(
      screen.queryByRole('button', { name: /readiness detail/i }),
    ).toBeNull()
    expect(screen.queryByLabelText(/fatigue before/i)).toBeNull()
    expect(screen.queryByLabelText(/elbow pain/i)).toBeNull()
    expect(screen.queryByLabelText(/timer sound/i)).toBeNull()
    expect(screen.queryByLabelText(/timer volume/i)).toBeNull()
    expect(screen.getByText('Pull-up block timer')).toBeInTheDocument()
    expect(screen.getByText('Hold timer')).toBeInTheDocument()
    expect(emomTimer).not.toBeNull()
    expect(emomOutcome).not.toBeNull()
    expect(
      emomTimer!.compareDocumentPosition(emomOutcome!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getAllByText(/10s prep/i)).toHaveLength(2)
    expect(screen.getByText(/work 15s/i)).toBeInTheDocument()
    expect(screen.getAllByText(/rest 60s/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/rest 2:00/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /add row/i }),
    ).not.toBeInTheDocument()
  })

  it('lets support workouts switch between top, middle, and low presets', async () => {
    const user = userEvent.setup()
    const customState = createMockAppState()
    vi.mocked(customState.getProgramPrefill).mockImplementation(
      (type, supportFocus) => {
        if (type === 'max') {
          return []
        }

        return [
          createPrefillRow({
            templateStepId: `support-${supportFocus ?? 'middle'}`,
            presetKey: `support-${supportFocus ?? 'middle'}`,
            label:
              supportFocus === 'top'
                ? 'Top support'
                : supportFocus === 'start/bottom'
                  ? 'Low support'
                  : 'Middle support',
            target: {
              mode: 'reps',
              summary:
                supportFocus === 'top'
                  ? 'top target'
                  : supportFocus === 'start/bottom'
                    ? 'low target'
                    : 'middle target',
              entrySets: 2,
              entryReps: 4,
            },
          }),
        ]
      },
    )
    customState.data.recommendationState.defaultSupportFocus = 'top'
    mockedUseAppState.mockReturnValue(customState)

    render(
      <LogWorkoutScreen
        prefill={true}
        requestedType="support"
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /^top$/i })).toHaveClass(
      'is-active',
    )
    expect(screen.getByText('top target')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^low$/i }))

    expect(screen.getByRole('button', { name: /^low$/i })).toHaveClass(
      'is-active',
    )
    expect(screen.getByText('low target')).toBeInTheDocument()
  })

  it('adds five seconds to the EMOM work window for each rep above three', () => {
    const customState = createMockAppState()
    vi.mocked(customState.getProgramPrefill).mockReturnValue([
      createPrefillRow({
        templateStepId: 'max-row',
        presetKey: 'max-row',
        label: 'EMOM pull-up block',
        exerciseName: 'EMOM pull-up block',
        target: {
          mode: 'emom',
          summary: '10m EMOM @ 5',
          entrySets: 1,
          entryReps: 50,
          emomMinutes: 10,
          emomSegments: [{ sets: 10, reps: 5 }],
        },
      }),
    ])
    mockedUseAppState.mockReturnValue(customState)

    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    expect(screen.getByText(/work 25s/i)).toBeInTheDocument()
  })

  it('uses the prep countdown only before the first EMOM set', () => {
    vi.useFakeTimers()
    const { container } = render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )
    const emomRow = container
      .querySelector('[aria-label="Outcome for EMOM pull-up block"]')
      ?.closest('.entry-row') as HTMLElement

    fireEvent.click(
      emomRow.querySelector('.timer-panel--emom .button--primary')!,
    )

    expect(emomRow).toHaveTextContent('Get to the bar')
    expect(emomRow).toHaveTextContent('Set 1: 3 reps')

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(emomRow).toHaveTextContent('Work')
    expect(emomRow).toHaveTextContent('Set 1: 3 reps')

    act(() => {
      vi.advanceTimersByTime(15000)
    })

    expect(emomRow).toHaveTextContent('Rest')
    expect(emomRow).toHaveTextContent('Next set 2: 3 reps')

    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(emomRow).toHaveTextContent('Work')
    expect(emomRow).toHaveTextContent('Set 2: 3 reps')
    expect(emomRow).not.toHaveTextContent('Get to the bar')
  })

  it('uses the prep countdown only before the first top hold', () => {
    vi.useFakeTimers()
    const { container } = render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )
    const topHoldRow = container
      .querySelector('[aria-label="Outcome for Top hold"]')
      ?.closest('.entry-row') as HTMLElement

    fireEvent.click(topHoldRow.querySelector('.timer-panel .button--primary')!)

    expect(topHoldRow).toHaveTextContent('Get to the bar')
    expect(topHoldRow).toHaveTextContent('Set 1 / 2')

    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(topHoldRow).toHaveTextContent('Hold now')

    act(() => {
      vi.advanceTimersByTime(20000)
    })
    expect(topHoldRow).toHaveTextContent('Rest before next hold')

    act(() => {
      vi.advanceTimersByTime(120000)
    })

    expect(topHoldRow).toHaveTextContent('Hold now')
    expect(topHoldRow).toHaveTextContent('Set 2 / 2')
    expect(topHoldRow).not.toHaveTextContent('Get to the bar')
  })

  it('adds a timer for duration-based preset rows', () => {
    const customState = createMockAppState()
    vi.mocked(customState.getProgramPrefill).mockReturnValue([
      createPrefillRow({
        templateStepId: 'duration-row',
        presetKey: 'duration-row',
        label: 'Grip endurance work',
        exerciseName: 'Grip endurance work',
        target: {
          mode: 'duration-seconds',
          summary: '2x30s',
          entrySets: 2,
          entryDurationSeconds: 30,
        },
      }),
    ])
    mockedUseAppState.mockReturnValue(customState)

    render(
      <LogWorkoutScreen
        prefill={true}
        requestedType="support"
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByText('Timed exercise timer')).toBeInTheDocument()
    expect(screen.getByText(/30s work/i)).toBeInTheDocument()
  })

  it('does not warn when switching session type with untouched preset rows', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /^support$/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByText('2x22s hold')).toBeInTheDocument()
  })

  it('warns before switching session type after preset outcomes would be lost', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    await user.click(screen.getAllByRole('button', { name: /^pass$/i })[0]!)
    await user.click(screen.getByRole('button', { name: /^support$/i }))

    expect(confirmSpy).toHaveBeenCalledWith(
      'Discard the current row outcomes and load the default program?',
    )
    expect(screen.getByText('10m EMOM @ 3')).toBeInTheDocument()
  })

  it('autosaves preset outcomes as an in-progress workout draft', async () => {
    const user = userEvent.setup()
    const saveWorkoutDraft = vi.fn(async () => true)
    mockedUseAppState.mockReturnValue({
      ...createMockAppState(),
      saveWorkoutDraft,
    })

    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    await user.click(screen.getAllByRole('button', { name: /^pass$/i })[0]!)

    await waitFor(() => {
      expect(saveWorkoutDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'current-workout',
          entries: expect.arrayContaining([
            expect.objectContaining({
              presetKey: 'max-row',
              outcome: 'pass',
            }),
          ]),
        }),
      )
    })

    expect(screen.getByText(/draft saved/i)).toBeInTheDocument()
  })

  it('starts the next-exercise rest timer when a row is marked', async () => {
    const user = userEvent.setup()

    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    expect(screen.queryByRole('button', { name: /pause rest/i })).toBeNull()

    await user.click(screen.getAllByRole('button', { name: /^pass$/i })[0]!)

    expect(
      screen.getByRole('button', { name: /pause rest/i }),
    ).toBeInTheDocument()
  })

  it('highlights rest and plays start, five-second, and completion cues', () => {
    vi.useFakeTimers()
    const { container } = render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )
    const emomOutcome = container.querySelector(
      '[aria-label="Outcome for EMOM pull-up block"]',
    )
    const emomRow = emomOutcome?.closest('.entry-row')

    fireEvent.click(
      emomOutcome?.querySelector('button[aria-pressed="false"]') as HTMLElement,
    )

    const restPanel = emomRow?.querySelector('.timer-panel--rest')
    expect(restPanel).toHaveClass('is-active')
    expect(restPanel).toHaveTextContent('Resting')
    expect(playTone).toHaveBeenCalledWith(expect.any(Object), 'start')

    vi.mocked(playTone).mockClear()

    act(() => {
      vi.advanceTimersByTime(295000)
    })
    for (let second = 0; second < 4; second += 1) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    expect(
      vi.mocked(playTone).mock.calls.filter(([, kind]) => kind === 'ending'),
    ).toHaveLength(5)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(playTone).toHaveBeenCalledWith(expect.any(Object), 'alarm')
    expect(restPanel).not.toHaveClass('is-active')
  })

  it('does not show or start a rest timer after the last exercise', () => {
    const { container } = render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )
    const topHoldOutcome = container.querySelector(
      '[aria-label="Outcome for Top hold"]',
    )
    const topHoldRow = topHoldOutcome?.closest('.entry-row')

    expect(topHoldRow?.querySelector('.timer-panel--rest')).toBeNull()
    vi.mocked(playTone).mockClear()

    fireEvent.click(
      topHoldOutcome?.querySelector(
        'button[aria-pressed="false"]',
      ) as HTMLElement,
    )

    expect(playTone).not.toHaveBeenCalledWith(expect.any(Object), 'start')
    expect(topHoldRow?.querySelector('.timer-panel--rest')).toBeNull()
  })

  it('saves the max test step as an in-progress draft before workout rows', async () => {
    const user = userEvent.setup()
    const saveWorkoutDraft = vi.fn(async () => true)
    mockedUseAppState.mockReturnValue({
      ...createMockAppState(),
      saveWorkoutDraft,
    })

    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    await user.type(screen.getByLabelText(/true max reps/i), '12')
    await user.click(screen.getByRole('button', { name: /max test detail/i }))
    await user.selectOptions(screen.getByLabelText(/set quality/i), 'clean')
    await user.click(screen.getByRole('button', { name: /save max/i }))

    expect(screen.getByText('12 reps')).toBeInTheDocument()
    expect(screen.getByText('clean')).toBeInTheDocument()
    expect(screen.getByText('Rest before pull-up block')).toBeInTheDocument()
    expect(screen.getByText('7:00')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /pause rest/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit max/i }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/true max reps/i)).toBeNull()

    await waitFor(() => {
      expect(saveWorkoutDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          maxReps: '12',
          maxTestSaved: true,
          qualityFlag: 'clean',
        }),
      )
    })
  })

  it('restores an existing in-progress workout draft', () => {
    mockedUseAppState.mockReturnValue({
      ...createMockAppState(),
      workoutDraft: {
        id: 'current-workout',
        date: '2026-04-19',
        elbowPain: '',
        entries: [
          {
            ...createPrefillRow({
              templateStepId: 'max-row',
              presetKey: 'max-row',
              label: 'EMOM pull-up block',
              exerciseName: 'EMOM pull-up block',
              outcome: 'pass',
            }),
            localId: 'draft-existing',
          },
        ],
        failurePoint: '',
        fatigueAfter: '',
        fatigueBefore: '',
        maxReps: '12',
        maxTestSaved: true,
        notes: '',
        qualityFlag: '',
        sessionType: 'max',
        shoulderPain: '',
        updatedAt: new Date('2026-04-19T12:00:00').toISOString(),
        videoLink: '',
      },
    })

    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    expect(screen.getByText('12 reps')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit max/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^pass$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('saves preset outcomes and target snapshots', async () => {
    const user = userEvent.setup()
    const saveSession = vi.fn(async () => true)
    const clearWorkoutDraft = vi.fn(async () => true)
    mockedUseAppState.mockReturnValue({
      ...createMockAppState(),
      clearWorkoutDraft,
      saveSession,
    })

    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
    )

    await user.type(screen.getByLabelText(/true max reps/i), '12')
    const passButtons = screen.getAllByRole('button', { name: /^pass$/i })
    await user.click(passButtons[0]!)
    await user.click(passButtons[1]!)
    await user.click(screen.getByRole('button', { name: /save workout/i }))

    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            presetKey: 'max-row',
            outcome: 'pass',
            presetTargetMode: 'emom',
            presetTargetSummary: '10m EMOM @ 3',
            reps: 30,
            sets: 1,
          }),
          expect.objectContaining({
            presetKey: 'max-top-hold',
            outcome: 'pass',
            presetTargetMode: 'hold-seconds',
            presetTargetSummary: '2x20s hold',
            durationSeconds: 20,
            sets: 2,
          }),
        ]),
      }),
    )
    expect(clearWorkoutDraft).toHaveBeenCalled()
  })
})
