import type { StatusPillTone } from '../components/StatusPill'
import type { QualityFlag } from '../domain/types'

export function getQualityTone(qualityFlag?: QualityFlag | ''): StatusPillTone {
  if (qualityFlag === 'clean') {
    return 'success'
  }

  if (qualityFlag === 'grindy') {
    return 'warning'
  }

  if (qualityFlag === 'partial') {
    return 'danger'
  }

  return 'neutral'
}

export function formatQualityFlag(qualityFlag?: QualityFlag | '') {
  if (qualityFlag === 'clean') {
    return 'clean'
  }

  if (qualityFlag === 'grindy') {
    return 'hard'
  }

  if (qualityFlag === 'partial') {
    return 'very hard'
  }

  return null
}
