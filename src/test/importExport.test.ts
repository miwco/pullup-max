import { describe, expect, it } from 'vitest'
import { createSeedData } from '../domain/defaults'
import {
  createExportBundle,
  parseImportBundle,
  serializeExportBundle,
} from '../domain/importExport'
import { withComputedRecommendation } from '../domain/selectors'

describe('import/export validation', () => {
  it('accepts a valid v4 exported backup with cycle, weight, and video data', () => {
    const seeded = withComputedRecommendation(
      {
        ...createSeedData('2026-04-18'),
        bodyweightEntries: [
          {
            id: 'weight-1',
            date: '2026-04-18',
            weightKg: 79.2,
          },
        ],
        settings: {
          ...createSeedData('2026-04-18').settings,
          cycleLengthDays: 120,
        },
        sessions: [
          {
            id: 'session-1',
            date: '2026-04-18',
            sessionType: 'max',
            notes: '',
          },
        ],
        maxTests: [
          {
            id: 'max-1',
            workoutSessionId: 'session-1',
            reps: 12,
            movement: 'Pull-up',
            videoUrl: 'https://example.com/max-attempt',
            bodyweightKgSnapshot: 79.2,
            trendClassification: 'stable',
          },
        ],
      },
      '2026-04-18',
    )
    const raw = serializeExportBundle(seeded)
    const parsed = parseImportBundle(raw)

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.value.version).toBe(4)
      expect(parsed.value.data.athleteProfile.mainMovement).toBe('Pull-up')
      expect(parsed.value.data.settings.cycleLengthDays).toBe(120)
      expect(parsed.value.data.bodyweightEntries[0]?.weightKg).toBe(79.2)
      expect(
        parsed.value.data.programTemplate.maxDay.volumeBlock.steps[0]
          ?.emomMinutes,
      ).toBe(10)
      expect(parsed.value.data.maxTests[0]?.videoUrl).toBe(
        'https://example.com/max-attempt',
      )
      expect(parsed.value.data.maxTests[0]?.bodyweightKgSnapshot).toBe(79.2)
    }
  })

  it('accepts and normalizes a legacy v2 backup into the v4 model', () => {
    const seeded = createSeedData('2026-04-18')
    const legacyBundle = JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        ...seeded,
        exercises: seeded.exercises.map((exercise, index) =>
          index === 0 ? { ...exercise, type: 'recovery' } : exercise,
        ),
        sessions: [
          {
            id: 'session-1',
            date: '2026-04-10',
            sessionType: 'deload',
            notes: '',
          },
        ],
        maxTests: [
          {
            id: 'max-1',
            workoutSessionId: 'session-1',
            reps: 10,
            movement: 'Pull-up',
            failurePoint: 'finish',
            qualityFlag: 'cleaner',
            trendClassification: 'stable',
          },
        ],
        recommendationState: {
          stale: true,
        },
      },
    })

    const parsed = parseImportBundle(legacyBundle)

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.value.version).toBe(4)
      expect(parsed.value.data.sessions[0]?.sessionType).toBe('support')
      expect(parsed.value.data.exercises[0]?.type).toBe('support')
      expect(parsed.value.data.maxTests[0]?.failurePoint).toBe('top')
      expect(parsed.value.data.maxTests[0]?.qualityFlag).toBe('clean')
      expect(parsed.value.data.settings.cycleLengthDays).toBe(90)
      expect(parsed.value.data.bodyweightEntries).toEqual([])
      expect(
        parsed.value.data.programTemplate.supportFallback.steps.length,
      ).toBeGreaterThan(0)
      expect(parsed.value.data.recommendationState.id).toBe(
        'recommendation-current',
      )
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
      error: 'Unsupported backup version. Expected 2, 3, or 4.',
    })
  })

  it('rejects structurally invalid backup data', () => {
    const invalidBundle = JSON.stringify({
      version: 4,
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
