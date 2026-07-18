import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GreaseGrooveHistory } from '../features/progress/GreaseGrooveHistory'

const entries = [
  {
    id: 'gg-older',
    date: '2026-07-15',
    reps: 4,
    loggedAt: '2026-07-15T09:30:00.000Z',
  },
  {
    id: 'gg-latest',
    date: '2026-07-17',
    reps: 5,
    loggedAt: '2026-07-17T11:00:00.000Z',
  },
]

describe('GreaseGrooveHistory', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('corrects the reps and date of an older GG set', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn(async () => true)

    render(
      <GreaseGrooveHistory
        entries={entries}
        onDelete={vi.fn(async () => true)}
        onUpdate={onUpdate}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Edit 4 rep GG set from 2026-07-15',
      }),
    )
    await user.clear(screen.getByRole('spinbutton', { name: 'Reps' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Reps' }), '6')
    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), '2026-07-14')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onUpdate).toHaveBeenCalledWith('gg-older', 6, '2026-07-14')
  })

  it('confirms before deleting an older GG set', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn(async () => true)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <GreaseGrooveHistory
        entries={entries}
        onDelete={onDelete}
        onUpdate={vi.fn(async () => true)}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Delete 4 rep GG set from 2026-07-15',
      }),
    )

    expect(onDelete).toHaveBeenCalledWith('gg-older')
  })
})
