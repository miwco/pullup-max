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

  it('preserves intentionally empty Max-day warm-up and main-set blocks', () => {
    const seeded = createSeedData('2026-04-18')
    seeded.programTemplate.maxDay.warmup.steps = []
    seeded.programTemplate.maxDay.mainSet.steps = []

    const parsed = parseImportBundle(serializeExportBundle(seeded))

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.value.data.programTemplate.maxDay.warmup.steps).toEqual([])
      expect(parsed.value.data.programTemplate.maxDay.mainSet.steps).toEqual([])
    }
  })

  it('migrates the legacy built-in Max-day template to the new EMOM plus finisher default', () => {
    const seeded = createSeedData('2026-04-18')
    const [
      pullUpId,
      bandAssistedId,
      scapId,
      deadHangId,
      ,
      topHoldId,
      ,
      ,
      ,
      ,
      ,
    ] = seeded.exercises.map((exercise) => exercise.id)

    seeded.programTemplate.maxDay.warmup.steps = [
      {
        id: 'legacy-step-1',
        title: 'Dead hang',
        exerciseId: deadHangId ?? '',
        holdSeconds: 20,
        notes: '',
      },
      {
        id: 'legacy-step-2',
        title: 'Scapular pull-ups',
        exerciseId: scapId ?? '',
        sets: 2,
        reps: 5,
        notes: '',
      },
      {
        id: 'legacy-step-3',
        title: 'Easy band-assisted pull-ups',
        exerciseId: bandAssistedId ?? '',
        sets: 2,
        reps: 5,
        bandAllowed: true,
        bodyweightOption: 'band',
        notes: '',
      },
      {
        id: 'legacy-step-4',
        title: 'Easy bodyweight set',
        exerciseId: pullUpId ?? '',
        sets: 1,
        reps: 3,
        bodyweightOption: 'bodyweight',
        notes: 'About 30% of usual max.',
      },
    ]
    seeded.programTemplate.maxDay.mainSet.steps = [
      {
        id: 'legacy-step-5',
        title: 'All-out max set',
        exerciseId: pullUpId ?? '',
        sets: 1,
        captureAsMaxTest: true,
        bodyweightOption: 'bodyweight',
        notes: 'Rest 4 minutes before this set and 6 minutes after.',
      },
    ]
    seeded.programTemplate.maxDay.volumeBlock.steps = [
      {
        id: 'legacy-step-6',
        title: 'EMOM pull-up block',
        exerciseId: pullUpId ?? '',
        emomMinutes: 10,
        emomReps: 4,
        sets: 10,
        reps: 4,
        bodyweightOption: 'bodyweight',
        notes: 'Adjust reps if needed so all 10 minutes stay clean.',
      },
    ]
    seeded.programTemplate.maxDay.finisher.steps = [
      {
        id: 'legacy-step-7',
        title: 'Top hold',
        exerciseId: topHoldId ?? '',
        sets: 2,
        holdSeconds: 20,
        notes: 'Chin above the bar.',
      },
    ]

    const parsed = parseImportBundle(serializeExportBundle(seeded))

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.value.data.programTemplate.maxDay.warmup.steps).toEqual([])
      expect(parsed.value.data.programTemplate.maxDay.mainSet.steps).toEqual([])
      expect(
        parsed.value.data.programTemplate.maxDay.volumeBlock.steps[0]?.notes,
      ).toContain('complete all 10 minutes with clean form')
      expect(
        parsed.value.data.programTemplate.maxDay.finisher.steps[0]?.notes,
      ).toContain('increase the hold time over the weeks')
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
