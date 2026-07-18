import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppProvider'
import { useAppState } from '../app/appContext'
import { createSeedData } from '../domain/defaults'
import { withComputedRecommendation } from '../domain/selectors'

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
  const { data, isReady, saveGreaseGrooveEntry, updateGreaseGrooveEntry } =
    useAppState()

  if (!isReady) return <span>Loading</span>

  return (
    <>
      <span>GG count: {data.greaseGrooveEntries.length}</span>
      <span>
        GG reps: {data.greaseGrooveEntries.map((entry) => entry.reps).join(',')}
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
})
