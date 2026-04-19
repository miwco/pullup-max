import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import type { AppData, ProgramTemplate } from '../domain/types'

const { mockedUseAppState } = vi.hoisted(() => ({
  mockedUseAppState: vi.fn(),
}))

vi.mock('../app/AppProvider', () => ({
  useAppState: mockedUseAppState,
}))

function buildProgramTemplate(): ProgramTemplate {
  return {
    maxDay: {
      warmup: {
        title: 'Warm-up',
        steps: [
          {
            id: 'warm-1',
            title: 'Dead hang',
            exerciseId: 'dead-hang',
            sets: 2,
            holdSeconds: 20,
            notes: '',
          },
          {
            id: 'warm-2',
            title: 'Scap pull-up',
            exerciseId: 'scap',
            sets: 2,
            reps: 5,
            notes: '',
          },
        ],
      },
      mainSet: {
        title: 'EMOM',
        steps: [
          {
            id: 'main-1',
            title: 'Pull-up',
            exerciseId: 'pull-up',
            emomMinutes: 10,
            emomReps: 4,
            notes: '',
          },
        ],
      },
      volumeBlock: {
        title: 'Volume block',
        steps: [
          {
            id: 'volume-1',
            title: 'Band-assisted pull-up',
            exerciseId: 'band',
            sets: 3,
            reps: 6,
            bodyweightOption: 'band',
            notes: '',
          },
        ],
      },
      finisher: {
        title: 'Top hold',
        steps: [
          {
            id: 'finish-1',
            title: 'Top hold',
            exerciseId: 'top-hold',
            sets: 2,
            holdSeconds: 20,
            notes: '',
          },
        ],
      },
    },
    supportDayBase: {
      title: 'Support work',
      steps: [
        {
          id: 'support-1',
          title: 'Mid-pause pull-up',
          exerciseId: 'mid-pause',
          sets: 3,
          reps: 4,
          notes: '',
        },
      ],
    },
    supportFallback: {
      title: 'Fallback',
      steps: [
        {
          id: 'fallback-1',
          title: 'Band-assisted pull-up',
          exerciseId: 'band',
          sets: 3,
          reps: 8,
          notes: '',
        },
      ],
    },
    weakPointBlocks: {
      top: {
        title: 'Top range',
        steps: [
          {
            id: 'top-1',
            title: 'Top hold',
            exerciseId: 'top-hold',
            sets: 2,
            holdSeconds: 20,
            notes: '',
          },
        ],
      },
      middle: {
        title: 'Middle range',
        steps: [
          {
            id: 'middle-1',
            title: 'Mid-pause pull-up',
            exerciseId: 'mid-pause',
            sets: 3,
            reps: 4,
            notes: '',
          },
        ],
      },
      'start/bottom': {
        title: 'Bottom range',
        steps: [
          {
            id: 'bottom-1',
            title: 'Bottom-pause pull-up',
            exerciseId: 'bottom-pause',
            sets: 3,
            reps: 4,
            notes: '',
          },
        ],
      },
      grip: {
        title: 'Grip',
        steps: [
          {
            id: 'grip-1',
            title: 'Active hang',
            exerciseId: 'active-hang',
            sets: 2,
            holdSeconds: 30,
            notes: '',
          },
        ],
      },
    },
  }
}

function buildData(): AppData {
  return {
    athleteProfile: {
      id: 'athlete-1',
      mainMovement: 'Pull-up',
      cycleStartDate: '2026-04-01',
      notes: '',
    },
    settings: {
      bodyweightTrackingEnabled: true,
      bandsAvailable: true,
      cycleLengthDays: 90,
      fatigueSensitivity: 3,
      jointPainSensitivity: 3,
      exportFormatVersion: 1,
    },
    exercises: [
      {
        id: 'pull-up',
        name: 'Pull-up',
        type: 'max',
        active: true,
        builtIn: true,
        defaultUnit: 'reps',
        tags: [],
      },
      {
        id: 'dead-hang',
        name: 'Dead hang',
        type: 'support',
        active: true,
        builtIn: true,
        defaultUnit: 'seconds',
        tags: [],
      },
      {
        id: 'scap',
        name: 'Scapular pull-up',
        type: 'support',
        active: true,
        builtIn: true,
        defaultUnit: 'reps',
        tags: [],
      },
      {
        id: 'band',
        name: 'Band-assisted pull-up',
        type: 'support',
        active: true,
        builtIn: true,
        defaultUnit: 'reps',
        tags: [],
      },
      {
        id: 'top-hold',
        name: 'Top hold',
        type: 'support',
        active: true,
        builtIn: true,
        defaultUnit: 'seconds',
        tags: [],
      },
      {
        id: 'mid-pause',
        name: 'Mid-pause pull-up',
        type: 'support',
        active: true,
        builtIn: true,
        defaultUnit: 'reps',
        tags: [],
      },
      {
        id: 'bottom-pause',
        name: 'Bottom-pause pull-up',
        type: 'support',
        active: true,
        builtIn: true,
        defaultUnit: 'reps',
        tags: [],
      },
      {
        id: 'active-hang',
        name: 'Active hang',
        type: 'support',
        active: true,
        builtIn: true,
        defaultUnit: 'seconds',
        tags: [],
      },
    ],
    bodyweightEntries: [
      {
        id: 'bw-1',
        date: '2026-04-18',
        weightKg: 78.4,
      },
    ],
    sessions: [],
    exerciseEntries: [],
    maxTests: [],
    programTemplate: buildProgramTemplate(),
    recommendationState: {
      id: 'rec-1',
      nextSessionType: 'support',
      maxReadinessSatisfied: false,
      daysSinceLastMax: 5,
      daysSinceLastWorkout: 1,
      baselineMax: 12,
      currentPhase: 'develop',
      trend: 'stable',
      defaultSupportFocus: 'top',
      suggestedExercises: ['Band-assisted pull-up', 'Top hold'],
      explanation:
        'Freshness is not satisfied yet, so keep today focused on support work.',
      computedAt: '2026-04-19',
    },
  }
}

function renderIntoDom(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    container,
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('compact hybrid UI', () => {
  beforeEach(() => {
    mockedUseAppState.mockReset()
    document.body.innerHTML = ''
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
  })

  it('renders Today with one compact summary block, weekly target, and weight row', () => {
    const data = buildData()
    mockedUseAppState.mockReturnValue({
      data,
      daysSinceLastMax: 5,
      daysSinceLastWorkout: 1,
      latestBodyweightEntry: data.bodyweightEntries[0],
      saveBodyweight: vi.fn().mockResolvedValue(true),
      weeklyVolumeSummary: {
        brakeApplied: false,
        completedPoints: 8,
        message: 'One more support session keeps the week on track.',
        remainingPoints: 4,
        targetPoints: 12,
        volumeStatus: 'on-track',
        weekEnd: '2026-04-20',
        weekNumber: 3,
        weekStart: '2026-04-14',
      },
    })

    const view = renderIntoDom(
      <TodayScreen
        canInstall={false}
        onInstall={vi.fn()}
        onOpenSettings={vi.fn()}
        onQuickLog={vi.fn()}
      />,
    )

    expect(view.container.querySelectorAll('.section--summary')).toHaveLength(1)
    expect(view.container.querySelector('[data-testid="today-mini-grid"]')).not.toBeNull()
    expect(view.container.querySelector('[data-testid="today-weekly-target"]')?.textContent).toContain(
      'One more support session keeps the week on track.',
    )
    expect(view.container.querySelector('[data-testid="today-weight-row"]')).not.toBeNull()

    view.unmount()
  })

  it('keeps Program blocks collapsed by default and expands an editor on demand', () => {
    const data = buildData()
    mockedUseAppState.mockReturnValue({
      activeExercises: data.exercises,
      data,
      exportBackup: vi.fn().mockReturnValue('{}'),
      importBackup: vi.fn().mockResolvedValue(true),
      resetAllData: vi.fn().mockResolvedValue(undefined),
      updatePreferences: vi.fn().mockResolvedValue(undefined),
      updateProgramTemplate: vi.fn().mockResolvedValue(undefined),
    })

    const view = renderIntoDom(<SettingsScreen />)

    expect(view.container.textContent).toContain('Dead hang')
    expect(view.container.textContent).toContain('2 exercises')
    expect(view.container.textContent).not.toContain('Main set')
    expect(view.container.textContent).not.toContain('Step label')

    const warmupTrigger = Array.from(
      view.container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent?.includes('Warm-up'))

    expect(warmupTrigger).toBeDefined()

    act(() => {
      warmupTrigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(view.container.textContent).toContain('Step label')
    expect(view.container.querySelector('[data-testid="program-accordion-list"]')).not.toBeNull()

    view.unmount()
  })
})
