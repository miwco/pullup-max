import '@testing-library/jest-dom/vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppProvider'
import { useAppState } from '../app/appContext'
import { createSeedData } from '../domain/defaults'
import { withComputedRecommendation } from '../domain/selectors'
import { todayDateString } from '../lib/date'
import { loadOrSeedAppData } from '../storage/indexedDb'

vi.mock('../storage/indexedDb', () => ({
  clearFinishWorkoutDraft: vi.fn(async () => {}),
  clearWorkoutDraft: vi.fn(async () => {}),
  loadFinishWorkoutDraft: vi.fn(async () => null),
  loadOrSeedAppData: vi.fn(async () =>
    withComputedRecommendation(createSeedData('2026-07-18'), '2026-07-18'),
  ),
  loadWorkoutDraft: vi.fn(async () => null),
  persistAppDataDiff: vi.fn(async () => {}),
  persistFinishWorkoutDraft: vi.fn(async () => {}),
  persistWorkoutDraft: vi.fn(async () => {}),
  replaceAppData: vi.fn(),
  resetAppData: vi.fn(),
}))

function PersistenceProbe() {
  const {
    data,
    daysSinceLastMax,
    isReady,
    saveGreaseGrooveEntry,
    startNextCycle,
    updateGreaseGrooveEntry,
  } = useAppState()

  if (!isReady) return <span>Loading</span>

  return (
    <>
      <span>GG count: {data.greaseGrooveEntries.length}</span>
      <span>
        GG reps: {data.greaseGrooveEntries.map((entry) => entry.reps).join(',')}
      </span>
      <span>Days since max: {daysSinceLastMax ?? 'none'}</span>
      <span>Next workout: {data.recommendationState.nextSessionType}</span>
      <span>Cycle start: {data.athleteProfile.cycleStartDate}</span>
      <span>
        Cycle history:{' '}
        {data.cycleHistory
          .map((cycle) => `${cycle.startDate}:${cycle.endDate}`)
          .join(',')}
      </span>
      <span>
        Preset progressions: {JSON.stringify(data.presetProgressions)}
      </span>
      <span>
        Finish progression: {JSON.stringify(data.finishWorkout.progression)}
      </span>
      <button
        type="button"
        onClick={() => {
          void Promise.all([
            saveGreaseGrooveEntry(2, '2026-07-18'),
            saveGreaseGrooveEntry(3, '2026-07-18'),
          ])
        }}
      >
        Save two sets
      </button>
      <button
        type="button"
        disabled={!data.greaseGrooveEntries[0]}
        onClick={() => {
          const entry = data.greaseGrooveEntries[0]
          if (entry) {
            void updateGreaseGrooveEntry(entry.id, 7, '2026-07-14')
          }
        }}
      >
        Correct first set
      </button>
      <button type="button" onClick={() => void startNextCycle()}>
        Start next cycle
      </button>
    </>
  )
}

describe('AppProvider persistence', () => {
  it('serializes rapid app-data writes without losing either update', async () => {
    const user = userEvent.setup()
    render(
      <AppProvider>
        <PersistenceProbe />
      </AppProvider>,
    )

    await screen.findByText('GG count: 0')
    await user.click(screen.getByRole('button', { name: 'Save two sets' }))

    await waitFor(() => {
      expect(screen.getByText('GG count: 2')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Correct first set' }))

    await waitFor(() => {
      expect(screen.getByText('GG reps: 7,3')).toBeInTheDocument()
    })
  })

  it('refreshes date-based readiness when an open PWA returns on a later day', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 6, 18, 12))

    const stored = createSeedData('2026-07-01')
    stored.sessions = [
      {
        id: 'max-session',
        date: '2026-07-18',
        sessionType: 'max',
        notes: '',
      },
    ]
    stored.maxTests = [
      {
        id: 'max-test',
        workoutSessionId: 'max-session',
        movement: 'Pull-up',
        reps: 12,
        trendClassification: 'stable',
      },
    ]
    vi.mocked(loadOrSeedAppData).mockResolvedValueOnce(
      withComputedRecommendation(stored, '2026-07-18'),
    )

    render(
      <AppProvider>
        <PersistenceProbe />
      </AppProvider>,
    )

    expect(await screen.findByText('Days since max: 0')).toBeInTheDocument()
    expect(screen.getByText('Next workout: support')).toBeInTheDocument()

    act(() => {
      vi.setSystemTime(new Date(2026, 6, 25, 12))
      window.dispatchEvent(new Event('focus'))
    })

    expect(await screen.findByText('Days since max: 7')).toBeInTheDocument()
    expect(screen.getByText('Next workout: max')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('preserves all exercise progression when starting a new cycle', async () => {
    const user = userEvent.setup()
    const stored = createSeedData('2026-01-01')
    const expectedPresetProgressions = [
      {
        presetKey: 'emom-step',
        mode: 'emom' as const,
        emomBaseReps: 2,
        emomStageOffset: 4,
      },
      {
        presetKey: 'rep-step',
        mode: 'reps' as const,
        currentValue: 7,
      },
      {
        presetKey: 'hold-step',
        mode: 'hold-seconds' as const,
        currentValue: 28,
      },
      {
        presetKey: 'duration-step',
        mode: 'duration-seconds' as const,
        currentValue: 50,
      },
    ]
    const expectedFinishProgression = {
      backExtensionSeconds: 55,
      absSeconds: 50,
      dipBaseReps: 2,
      dipStageOffset: 3,
      squatJumpReps: 14,
    }
    stored.presetProgressions = expectedPresetProgressions
    stored.finishWorkout.progression = expectedFinishProgression
    vi.mocked(loadOrSeedAppData).mockResolvedValueOnce(
      withComputedRecommendation(stored, todayDateString()),
    )

    render(
      <AppProvider>
        <PersistenceProbe />
      </AppProvider>,
    )

    expect(
      await screen.findByText('Cycle start: 2026-01-01'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start next cycle' }))

    expect(
      await screen.findByText(`Cycle start: ${todayDateString()}`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `Cycle history: 2026-01-01:${stored.athleteProfile.cycleEndDate}`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `Preset progressions: ${JSON.stringify(expectedPresetProgressions)}`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `Finish progression: ${JSON.stringify(expectedFinishProgression)}`,
      ),
    ).toBeInTheDocument()
  })
})
