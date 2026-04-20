import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  getHeaderStatusPillItems,
  type HeaderStatusPillItem,
} from '../app/headerStatusPills'
import { HeaderStatusPillGroup } from '../components/HeaderStatusPillGroup'

const TEST_ITEMS: HeaderStatusPillItem[] = [
  {
    id: 'next-workout',
    label: 'Next max',
    title: 'Next workout',
    body: 'Max means you are ready now.',
    tone: 'accent',
    align: 'start',
  },
  {
    id: 'trend',
    label: 'Trend stable',
    title: 'Trend',
    body: 'Stable means baseline is holding.',
    tone: 'success',
    align: 'end',
  },
]

describe('HeaderStatusPillGroup', () => {
  it('shows the matching explainer on hover and focus', async () => {
    const user = userEvent.setup()

    render(<HeaderStatusPillGroup items={TEST_ITEMS} />)

    await user.hover(screen.getByRole('button', { name: 'Next max' }))
    expect(screen.getByText('Max means you are ready now.')).toBeInTheDocument()

    await user.unhover(screen.getByRole('button', { name: 'Next max' }))
    expect(
      screen.queryByText('Max means you are ready now.'),
    ).not.toBeInTheDocument()

    await user.tab()
    expect(screen.getByText('Max means you are ready now.')).toBeInTheDocument()
  })

  it('toggles open on click and closes the previous pill when another opens', async () => {
    const user = userEvent.setup()

    render(<HeaderStatusPillGroup items={TEST_ITEMS} />)

    await user.click(screen.getByRole('button', { name: 'Next max' }))
    expect(screen.getByText('Max means you are ready now.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trend stable' }))
    expect(
      screen.queryByText('Max means you are ready now.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Stable means baseline is holding.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trend stable' }))
    expect(
      screen.queryByText('Stable means baseline is holding.'),
    ).not.toBeInTheDocument()
  })

  it('closes on outside click and Escape', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <HeaderStatusPillGroup items={TEST_ITEMS} />
        <button type="button">Outside</button>
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Next max' }))
    expect(screen.getByText('Max means you are ready now.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(
      screen.queryByText('Max means you are ready now.'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trend stable' }))
    expect(
      screen.getByText('Stable means baseline is holding.'),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByText('Stable means baseline is holding.'),
    ).not.toBeInTheDocument()
  })
})

describe('getHeaderStatusPillItems', () => {
  it('returns the correct next workout and trend explanations', () => {
    const items = getHeaderStatusPillItems({
      currentPhase: 'build',
      mainMovement: 'Pull-up',
      nextSessionType: 'max',
      trend: 'falling',
    })

    expect(items.find((item) => item.id === 'next-workout')?.body).toBe(
      'This is the workout the app recommends you log next. Max means you currently meet the freshness rules for a true max test: at least 7 days since the last max test and 2 full days since the most recent workout.',
    )
    expect(items.find((item) => item.id === 'trend')?.body).toBe(
      'Your recent max-test results are below baseline twice in a row. Falling means performance has dropped enough that support work should stay cleaner and easier until the trend turns around.',
    )
  })

  it('returns the correct support and phase explanations', () => {
    const items = getHeaderStatusPillItems({
      currentPhase: 'competition-prep',
      mainMovement: 'Pull-up',
      nextSessionType: 'support',
      trend: 'stable',
    })

    expect(items.find((item) => item.id === 'next-workout')?.body).toBe(
      'This means the app does not recommend a true max test yet. Support day is the default until you have enough recovery and freshness for the next real max attempt.',
    )
    expect(items.find((item) => item.id === 'current-phase')?.body).toBe(
      'Competition prep is the final part of the cycle. The goal here is to stay specific, reduce extra fatigue, and keep you fresh for strong max attempts.',
    )
  })
})
