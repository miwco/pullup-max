import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppContext, type AppContextValue } from '../app/appContext'
import { createSeedData } from '../domain/defaults'
import { GreaseGrooveScreen } from '../features/grease-groove/GreaseGrooveScreen'
import { todayDateString } from '../lib/date'

function renderScreen() {
  const today = todayDateString()
  const data = createSeedData(today)
  data.recommendationState.baselineMax = 10
  data.greaseGrooveEntries = [
    {
      id: 'gg-existing',
      date: today,
      reps: 4,
      loggedAt: `${today}T09:30:00.000Z`,
    },
  ]
  const saveGreaseGrooveEntry = vi.fn(async () => true)
  const deleteGreaseGrooveEntry = vi.fn(async () => true)
  const value = {
    data,
    saveGreaseGrooveEntry,
    deleteGreaseGrooveEntry,
  } as unknown as AppContextValue

  render(
    <AppContext value={value}>
      <GreaseGrooveScreen />
    </AppContext>,
  )

  return { deleteGreaseGrooveEntry, saveGreaseGrooveEntry }
}

describe('GreaseGrooveScreen', () => {
  it('shows the light-practice target and logs one reps value', async () => {
    const user = userEvent.setup()
    const { saveGreaseGrooveEntry } = renderScreen()

    expect(screen.getByText(/about 40-60% of your max/i)).toBeInTheDocument()
    expect(screen.getByText(/suggested now:/i)).toHaveTextContent('4-6 reps')
    expect(screen.getByRole('heading', { name: '4 reps' })).toBeInTheDocument()
    expect(screen.getByText('0.8 load points')).toBeInTheDocument()

    await user.type(screen.getByRole('spinbutton', { name: 'Reps' }), '5')
    await user.click(screen.getByRole('button', { name: 'Add set' }))

    expect(saveGreaseGrooveEntry).toHaveBeenCalledWith(5)
  })

  it('can remove an accidentally logged set', async () => {
    const user = userEvent.setup()
    const { deleteGreaseGrooveEntry } = renderScreen()

    await user.click(
      screen.getByRole('button', { name: 'Remove 4 rep GG set' }),
    )

    expect(deleteGreaseGrooveEntry).toHaveBeenCalledWith('gg-existing')
  })
})
