import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppState } from '../app/appContext'
import { createSeedData } from '../domain/defaults'
import type { ProgramEntryDraft, SessionType } from '../domain/types'
import { LogWorkoutScreen } from '../features/log-workout/LogWorkoutScreen'

vi.mock('../app/appContext', () => ({
  useAppState: vi.fn(),
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
    deleteExercise: vi.fn(async () => {}),
    dismissOnboarding: vi.fn(async () => true),
    errorMessage: null,
    exportBackup: () => '{"ok":true}',
    getProgramPrefill: vi.fn((type: SessionType) => prefills[type]),
    importBackup: vi.fn(async () => true),
    isReady: true,
    latestBodyweightEntry: null,
    maxHistory: [],
    notice: null,
    painTrendPoints: [],
    recentWorkouts: [],
    requestPersistentStorage: vi.fn(async () => true),
    resetAllData: vi.fn(async () => {}),
    saveBodyweight: vi.fn(async () => true),
    saveSession: vi.fn(async () => true),
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
    mockedUseAppState.mockReturnValue(createMockAppState())
    vi.restoreAllMocks()
  })

  it('renders compact pass/fail controls and removes manual row inputs', () => {
    render(
      <LogWorkoutScreen prefill={true} requestedType="max" onSaved={vi.fn()} />,
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
      screen.queryByRole('button', { name: /add row/i }),
    ).not.toBeInTheDocument()
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

    expect(screen.getByLabelText(/true max reps/i)).toHaveValue('12')
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
