import { EXPORT_FORMAT_VERSION } from './defaults'
import { normalizeAppData } from './normalization'
import type { AppData, ExportBundle } from './types'
import { isIsoDateTime, todayDateString } from '../lib/date'

interface ValidationSuccess<T> {
  ok: true
  value: T
}

interface ValidationFailure {
  ok: false
  error: string
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createExportBundle(data: AppData): ExportBundle {
  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function serializeExportBundle(data: AppData) {
  return JSON.stringify(createExportBundle(data), null, 2)
}

export function serializeMaxTestsCsv(data: AppData): string {
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]))

  const header = 'date,movement,reps,failure_point,quality_flag,bodyweight_kg\n'
  const rows = [...data.maxTests]
    .sort((left, right) => {
      const dateLeft = sessionById.get(left.workoutSessionId)?.date ?? ''
      const dateRight = sessionById.get(right.workoutSessionId)?.date ?? ''
      return dateLeft.localeCompare(dateRight)
    })
    .map((test) => {
      const session = sessionById.get(test.workoutSessionId)
      const date = session?.date ?? ''
      const bw = test.bodyweightKgSnapshot ?? session?.bodyweightKg ?? ''
      return [
        date,
        test.movement,
        test.reps,
        test.failurePoint ?? '',
        test.qualityFlag ?? '',
        bw,
      ].join(',')
    })

  return header + rows.join('\n')
}

export function parseImportBundle(
  rawText: string,
): ValidationResult<ExportBundle> {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText)
  } catch {
    return {
      ok: false,
      error: 'The selected file is not valid JSON.',
    }
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: 'The backup file must be a JSON object.',
    }
  }

  if (
    parsed.version !== 2 &&
    parsed.version !== 3 &&
    parsed.version !== 4 &&
    parsed.version !== 5 &&
    parsed.version !== 6 &&
    parsed.version !== 7 &&
    parsed.version !== 8 &&
    parsed.version !== EXPORT_FORMAT_VERSION
  ) {
    return {
      ok: false,
      error: `Unsupported backup version. Expected 2, 3, 4, 5, 6, 7, 8, or ${EXPORT_FORMAT_VERSION}.`,
    }
  }

  if (
    typeof parsed.exportedAt !== 'string' ||
    !isIsoDateTime(parsed.exportedAt)
  ) {
    return {
      ok: false,
      error: 'The backup file is missing a valid export timestamp.',
    }
  }

  const normalizedData = normalizeAppData(parsed.data, todayDateString())

  if (!normalizedData) {
    return {
      ok: false,
      error: 'The backup file structure is invalid or incomplete.',
    }
  }

  return {
    ok: true,
    value: {
      version: EXPORT_FORMAT_VERSION,
      exportedAt: parsed.exportedAt,
      data: normalizedData,
    },
  }
}
