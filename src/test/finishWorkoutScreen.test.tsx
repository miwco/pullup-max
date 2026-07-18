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
  const saveFinishWorkoutProgression = vi.fn(async () => true)

  mockedUseAppState.mockReturnValue({
    data,
    finishWorkoutDraft: null,
    saveFinishWorkout,
    saveFinishWorkoutDraft,
    saveFinishWorkoutProgression,
    saveFinishWorkoutSettings: vi.fn(async () => true),
  } as unknown as AppContextValue)

  return {
    saveFinishWorkout,
    saveFinishWorkoutDraft,
    saveFinishWorkoutProgression,
  }
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

  it('edits timed targets and dip reps through the exercise pencils', async () => {
    const user = userEvent.setup()
    const { saveFinishWorkoutProgression } = createFinishAppState()
    const { container } = render(<FinishWorkoutScreen />)
    const sections = container.querySelectorAll('.finish-exercise')

    expect(
      screen.getByRole('button', { name: 'Edit Back extension' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit Ab exercise' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit Dips' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'About Squat jumps target' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Edit Back extension' }),
    )
    await user.clear(screen.getByLabelText('Work seconds'))
    await user.type(screen.getByLabelText('Work seconds'), '4')
    await user.click(
      within(sections[0] as HTMLElement).getByRole('button', { name: 'Save' }),
    )

    expect(
      screen.getByText('Enter a whole number from 5 to 600 seconds.'),
    ).toBeInTheDocument()
    expect(saveFinishWorkoutProgression).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Work seconds'))
    await user.type(screen.getByLabelText('Work seconds'), '60')
    await user.click(
      within(sections[0] as HTMLElement).getByRole('button', { name: 'Save' }),
    )

    expect(saveFinishWorkoutProgression).toHaveBeenCalledWith(
      expect.objectContaining({ backExtensionSeconds: 60 }),
    )

    await user.click(screen.getByRole('button', { name: 'Edit Dips' }))
    await user.clear(screen.getByLabelText('Reps per set'))
    await user.type(screen.getByLabelText('Reps per set'), '4')
    await user.click(
      within(sections[2] as HTMLElement).getByRole('button', { name: 'Save' }),
    )

    expect(saveFinishWorkoutProgression).toHaveBeenLastCalledWith(
      expect.objectContaining({ dipBaseReps: 4, dipStageOffset: 0 }),
    )
  })

  it('stops the previous rest timer when the next exercise starts', async () => {
    const user = userEvent.setup()
    const { container } = render(<FinishWorkoutScreen />)
    const sections = container.querySelectorAll('.finish-exercise')

    await user.click(
      within(sections[0] as HTMLElement).getByRole('button', { name: 'pass' }),
    )
    expect(
      within(sections[0] as HTMLElement).getByRole('button', {
        name: 'Pause',
      }),
    ).toBeInTheDocument()

    await user.click(
      within(sections[1] as HTMLElement).getByRole('button', { name: 'Start' }),
    )

    expect(
      within(sections[0] as HTMLElement).queryByRole('button', {
        name: 'Pause',
      }),
    ).not.toBeInTheDocument()
  })
})
