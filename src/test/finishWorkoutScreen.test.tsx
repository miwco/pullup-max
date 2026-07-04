import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppState, type AppContextValue } from '../app/appContext'
import { createSeedData } from '../domain/defaults'
import { FinishWorkoutScreen } from '../features/finish/FinishWorkoutScreen'

vi.mock('../app/appContext', async () => {
  const actual = await vi.importActual('../app/appContext')
  return {
    ...actual,
    useAppState: vi.fn(),
  }
})

const mockedUseAppState = vi.mocked(useAppState)

function createFinishAppState() {
  const data = createSeedData('2026-07-04')
  const saveFinishWorkout = vi.fn(async () => true)
  const saveFinishWorkoutDraft = vi.fn(async () => true)

  mockedUseAppState.mockReturnValue({
    data,
    finishWorkoutDraft: null,
    saveFinishWorkout,
    saveFinishWorkoutDraft,
    saveFinishWorkoutSettings: vi.fn(async () => true),
  } as unknown as AppContextValue)

  return { saveFinishWorkout, saveFinishWorkoutDraft }
}

describe('FinishWorkoutScreen', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('autosaves outcomes, starts transition rest, and saves only when complete', async () => {
    const user = userEvent.setup()
    const { saveFinishWorkout, saveFinishWorkoutDraft } = createFinishAppState()
    const { container } = render(<FinishWorkoutScreen />)
    const saveButton = screen.getByRole('button', {
      name: 'Save Finish workout',
    })

    expect(saveButton).toBeDisabled()
    const sections = container.querySelectorAll('.finish-exercise')
    expect(sections).toHaveLength(4)
    expect(
      within(sections[1] as HTMLElement).getByRole('heading', {
        name: '2. Ab exercise',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Ab exercise' }),
    ).not.toBeInTheDocument()

    await user.click(
      within(sections[0] as HTMLElement).getByRole('button', { name: 'pass' }),
    )

    expect(saveFinishWorkoutDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'current-finish-workout',
        outcomes: { 'back-extension': 'pass' },
      }),
    )
    expect(
      within(sections[0] as HTMLElement).getByText('Next exercise'),
    ).toBeInTheDocument()
    expect(
      within(sections[0] as HTMLElement).getAllByText('Rest').length,
    ).toBeGreaterThan(0)

    for (let index = 1; index < sections.length; index += 1) {
      await user.click(
        within(sections[index] as HTMLElement).getByRole('button', {
          name: 'pass',
        }),
      )
    }

    expect(
      within(sections[3] as HTMLElement).queryByText('Next exercise'),
    ).not.toBeInTheDocument()
    expect(saveButton).toBeEnabled()

    await user.click(saveButton)
    expect(saveFinishWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        outcomes: {
          'back-extension': 'pass',
          abs: 'pass',
          dips: 'pass',
          'squat-jumps': 'pass',
        },
      }),
    )
  })
})
