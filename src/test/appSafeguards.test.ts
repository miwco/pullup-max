import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getBackupFreshness,
  readLastBackupAt,
  recordBackupCreated,
} from '../lib/backupStatus'
import {
  applyPwaUpdate,
  configurePwaUpdate,
  notifyPwaUpdateAvailable,
  subscribeToPwaUpdate,
} from '../lib/pwaUpdate'

describe('local app safeguards', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('records backup freshness metadata on the current device', () => {
    expect(readLastBackupAt()).toBeNull()

    recordBackupCreated('2026-07-18T08:00:00.000Z')

    expect(readLastBackupAt()).toBe('2026-07-18T08:00:00.000Z')
  })

  it('marks missing and two-week-old backups as due', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')

    expect(getBackupFreshness(null, now)).toMatchObject({
      ageDays: null,
      isDue: true,
    })
    expect(getBackupFreshness('2026-07-04T12:00:00.000Z', now)).toMatchObject({
      ageDays: 14,
      isDue: true,
    })
    expect(getBackupFreshness('2026-07-05T12:00:00.000Z', now)).toMatchObject({
      ageDays: 13,
      isDue: false,
    })
  })

  it('notifies the UI and applies a waiting PWA update', async () => {
    const listener = vi.fn()
    const updateHandler = vi.fn(async () => {})
    const unsubscribe = subscribeToPwaUpdate(listener)
    configurePwaUpdate(updateHandler)

    notifyPwaUpdateAvailable()
    await applyPwaUpdate()

    expect(listener).toHaveBeenCalledOnce()
    expect(updateHandler).toHaveBeenCalledWith(true)
    unsubscribe()
  })
})
