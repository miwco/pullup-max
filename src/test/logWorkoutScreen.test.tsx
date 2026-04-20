import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppState } from '../app/AppProvider'
import { createSeedData } from '../domain/defaults'
import type { ProgramEntryDraft, SessionType } from '../domain/types'
import { LogWorkoutScreen } from '../features/log-workout/LogWorkoutScreen'

vi.mock('../app/AppProvider', () => ({
  useAppState: vi.fn(),
}))

type MockAppState = ReturnType<typeof useAppState>

const mockedUseAppState = vi.mocked(useAppState)

function createPrefillRow(
  overrides: Partial<ProgramEntryDraft> = {},
): ProgramEntryDraft {
  return {
    templateStepId: 'template-step',
    label: 'Default block',
    exerciseId: 'exercise-id',
    exerciseName: 'Pull-up',
    sets: '4',
    reps: '4',
    durationSeconds: '',
    bandAssisted: false,
    effort: '',
    notes: '',
    ...overrides,
  }
}

function createMockAppState(): MockAppState {
  const data = createSeedData('2026-04-19')
  const pullUp = data.exercises.find((exercise) => exercise.name === 'Pull-up')
  const bandAssisted = data.exercises.find(
    (exercise) => exercise.name === 'Band-assisted pull-up',
  )

  const prefills: Record<SessionType, ProgramEntryDraft[]> = {
    max: [
      createPrefillRow({
        templateStepId: 'max-row',
        label: 'Volume block',
        exerciseId: pullUp?.id ?? 'pull-up',
        exerciseName: 'Pull-up',
      }),
    ],
    support: [
      createPrefillRow({
        templateStepId: 'support-row',
        label: 'Support block',
        exerciseId: bandAssisted?.id ?? 'band-assisted',
        exerciseName: 'Band-assisted pull-up',
        bandAssisted: true,
      }),
    ],
  }

  return {
    activeExercises: data.exercises.filter((exercise) => exercise.active),
    allTimeBestMax: null,
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
    deleteExercise: vi.fn(async () => {}),
    errorMessage: null,
    exportBackup: () => '{"ok":true}',
    getProgramPrefill: vi.fn((type: SessionType) => prefills[type]),
    importBackup: vi.fn(async () => true),
    isReady: true,
    latestBodyweightEntry: null,
    maxHistory: [],
    notice: null,
    recentWorkouts: [],
    resetAllData: vi.fn(async () => {}),
    saveBodyweight: vi.fn(async () => true),
    saveSession: vi.fn(async () => true),
    saveSettingsAndProgram: vi.fn(async () => true),
    setNotice: vi.fn(),
    supportVolumeTrend: [],
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
  }
}

describe('LogWorkoutScreen row replacement warnings', () => {
  beforeEach(() => {
    mockedUseAppState.mockReturnValue(createMockAppState())
    vi.restoreAllMocks()
  })

  it('does not warn when switching session type with untouched default rows', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <LogWorkoutScreen
        prefill={true}
        requestedType="max"
        onSaved={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^support$/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Support block')).toBeInTheDocument()
  })

  it('warns before switching session type after row edits would be lost', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <LogWorkoutScreen
        prefill={true}
        requestedType="max"
        onSaved={vi.fn()}
      />,
    )

    await user.clear(screen.getByLabelText(/block label/i))
    await user.type(screen.getByLabelText(/block label/i), 'Custom volume block')
    await user.click(screen.getByRole('button', { name: /^support$/i }))

    expect(confirmSpy).toHaveBeenCalledWith(
      'Discard the current row edits and load the default program?',
    )
    expect(screen.getByDisplayValue('Custom volume block')).toBeInTheDocument()
  })
})
