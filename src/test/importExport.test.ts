import { describe, expect, it } from 'vitest'
import { createSeedData } from '../domain/defaults'
import {
  createExportBundle,
  parseImportBundle,
  serializeExportBundle,
} from '../domain/importExport'
import { withComputedRecommendation } from '../domain/selectors'

describe('import/export validation', () => {
  it('accepts a valid exported backup', () => {
    const seeded = withComputedRecommendation(
      createSeedData('2026-04-18'),
      '2026-04-18',
    )
    const raw = serializeExportBundle(seeded)
    const parsed = parseImportBundle(raw)

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.value.version).toBe(1)
      expect(parsed.value.data.athleteProfile.mainMovement).toBe('Pull-up')
    }
  })

  it('rejects invalid JSON and unsupported versions', () => {
    expect(parseImportBundle('{bad json')).toEqual({
      ok: false,
      error: 'The selected file is not valid JSON.',
    })

    const seeded = withComputedRecommendation(
      createSeedData('2026-04-18'),
      '2026-04-18',
    )
    const bundle = createExportBundle(seeded)
    const unsupportedVersion = JSON.stringify({
      ...bundle,
      version: 99,
    })

    expect(parseImportBundle(unsupportedVersion)).toEqual({
      ok: false,
      error: 'Unsupported backup version. Expected 1.',
    })
  })

  it('rejects structurally invalid backup data', () => {
    const invalidBundle = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        athleteProfile: null,
      },
    })

    expect(parseImportBundle(invalidBundle)).toEqual({
      ok: false,
      error: 'The backup file structure is invalid or incomplete.',
    })
  })
})
