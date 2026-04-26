import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BottomNav } from '../components/BottomNav'

describe('BottomNav', () => {
  it('links the Workout tab to the recommended workout prefill', () => {
    render(<BottomNav currentRoute="today" recommendedSessionType="support" />)

    expect(screen.getByRole('link', { name: 'Workout' })).toHaveAttribute(
      'href',
      '#/log?prefill=1&type=support',
    )
  })
})
