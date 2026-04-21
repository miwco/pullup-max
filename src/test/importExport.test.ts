import { describe, expect, it } from 'vitest'
import { createSeedData } from '../domain/defaults'
import {
  createExportBundle,
  parseImportBundle,
  serializeExportBundle,
} from '../domain/importExport'
import { withComputedRecommendation } from '../domain/selectors'

describe('import/export validation', () => {
  it('accepts a valid v6 exported backup with cycle, weight, and video data', () => {
    const seededBase = createSeedData('2026-04-18')
    const emomExerciseId = seededBase.exercises.find(
      (exercise) => exercise.name === 'EMOM ring pull-up block',
    )!.id
    const seeded = withComputedRecommendation(
      {
        ...seededBase,
        athleteProfile: {
          ...seededBase.athleteProfile,
          mainMovement: 'Ring pull-up',
        },
        bodyweightEntries: [
          {
            id: 'weight-1',
            date: '2026-04-18',
            weightKg: 79.2,
          },
        ],
        settings: {
          ...seededBase.settings,
          cycleLengthDays: 120,
        },
        sessions: [
          {
            id: 'session-1',
            date: '2026-04-18',
            sessionType: 'support',
            notes: '',
          },
        ],
        exerciseEntries: [
          {
            id: 'entry-1',
            workoutSessionId: 'session-1',
            exerciseId: emomExerciseId,
            sets: 1,
            reps: 25,
            presetKey: 'step-emom',
            outcome: 'pass',
            presetTargetMode: 'emom',
            presetTargetSummary: '10m EMOM: 5x3 + 5x2',
            isMaxTest: false,
          },
        ],
        maxTests: [
          {
            id: 'max-1',
            workoutSessionId: 'session-1',
            reps: 12,
            movement: 'Ring pull-up',
            videoUrl: 'https://example.com/max-attempt',
            bodyweightKgSnapshot: 79.2,
            trendClassification: 'stable',
          },
        ],
        presetProgressions: [
          {
            presetKey: 'step-emom',
            mode: 'emom',
            emomBaseReps: 2,
            emomStageOffset: 1,
          },
        ],
      },
      '2026-04-18',
    )
    const raw = serializeExportBundle(seeded)
    const parsed = parseImportBundle(raw)

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.value.version).toBe(6)
      expect(parsed.value.data.athleteProfile.mainMovement).toBe('Ring pull-up')
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
      expect(parsed.value.data.exerciseEntries[0]?.outcome).toBe('pass')
      expect(parsed.value.data.exerciseEntries[0]?.presetTargetSummary).toBe(
        '10m EMOM: 5x3 + 5x2',
      )
      expect(parsed.value.data.presetProgressions[0]).toMatchObject({
        presetKey: 'step-emom',
        mode: 'emom',
        emomBaseReps: 2,
        emomStageOffset: 1,
      })
    }
  })

  it('accepts and normalizes a legacy v2 backup into the v6 model', () => {
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
      expect(parsed.value.version).toBe(6)
      expect(parsed.value.data.sessions[0]?.sessionType).toBe('support')
      expect(parsed.value.data.exercises[0]?.type).toBe('support')
      expect(parsed.value.data.maxTests[0]?.failurePoint).toBe('top')
      expect(parsed.value.data.maxTests[0]?.qualityFlag).toBe('clean')
      expect(parsed.value.data.settings.cycleLengthDays).toBe(90)
      expect(parsed.value.data.athleteProfile.mainMovement).toBe('Pull-up')
      expect(parsed.value.data.bodyweightEntries).toEqual([])
      expect(
        parsed.value.data.programTemplate.supportFallback.steps.length,
      ).toBeGreaterThan(0)
      expect(parsed.value.data.recommendationState.id).toBe(
        'recommendation-current',
      )
    }
  })

  it('normalizes unsupported main movement values back to Pull-up', () => {
    const seeded = createSeedData('2026-04-18')
    const invalidMovementBundle = JSON.stringify({
      version: 6,
      exportedAt: new Date().toISOString(),
      data: {
        ...seeded,
        athleteProfile: {
          ...seeded.athleteProfile,
          mainMovement: 'Muscle-up',
        },
      },
    })

    const parsed = parseImportBundle(invalidMovementBundle)

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.value.data.athleteProfile.mainMovement).toBe('Pull-up')
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
    const pullUpId = seeded.exercises.find(
      (exercise) => exercise.name === 'Pull-up',
    )?.id
    const bandAssistedId = seeded.exercises.find(
      (exercise) => exercise.name === 'Band-assisted pull-up',
    )?.id
    const scapId = seeded.exercises.find(
      (exercise) => exercise.name === 'Scapular pull-up',
    )?.id
    const deadHangId = seeded.exercises.find(
      (exercise) => exercise.name === 'Dead hang',
    )?.id
    const topHoldId = seeded.exercises.find(
      (exercise) => exercise.name === 'Top hold',
    )?.id

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
      error: 'Unsupported backup version. Expected 2, 3, 4, 5, or 6.',
    })
  })

  it('rejects structurally invalid backup data', () => {
    const invalidBundle = JSON.stringify({
      version: 6,
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
