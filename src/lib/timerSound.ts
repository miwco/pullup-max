import type { TimerSoundId } from '../domain/types'

export interface TimerSoundSettings {
  soundId: TimerSoundId
  volume: number
}

export const TIMER_SOUND_OPTIONS: Array<{ id: TimerSoundId; label: string }> = [
  { id: 'soft', label: 'Soft' },
  { id: 'bright', label: 'Bright' },
  { id: 'low', label: 'Low' },
]

let audioContext: AudioContext | null = null

function getAudioContext() {
  audioContext ??= new AudioContext()
  return audioContext
}

type TimerToneKind = 'alarm' | 'countdown' | 'ending' | 'start'

function getToneFrequency(
  soundId: TimerSoundId,
  kind: Exclude<TimerToneKind, 'alarm'>,
) {
  const baseBySound: Record<TimerSoundId, number> = {
    soft: 660,
    bright: 920,
    low: 440,
  }

  if (kind === 'ending') {
    return baseBySound[soundId] + 120
  }

  if (kind === 'start') {
    return baseBySound[soundId] - 80
  }

  return baseBySound[soundId]
}

export function playTone(settings: TimerSoundSettings, kind: TimerToneKind) {
  if (settings.volume <= 0) {
    return
  }

  try {
    const context = getAudioContext()
    if (context.state === 'suspended') {
      void context.resume()
    }

    const now = context.currentTime
    const beepCount = kind === 'alarm' ? 3 : 1
    const frequency =
      kind === 'alarm'
        ? getToneFrequency(settings.soundId, 'ending')
        : getToneFrequency(settings.soundId, kind)

    for (let index = 0; index < beepCount; index += 1) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const start = now + index * 0.18
      const stop =
        start + (kind === 'alarm' ? 0.16 : kind === 'start' ? 0.09 : 0.12)
      const audibleVolume = Math.min(
        1,
        settings.volume *
          (kind === 'alarm' ? 0.8 : kind === 'start' ? 0.5 : 0.62),
      )

      oscillator.type = settings.soundId === 'bright' ? 'square' : 'sine'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(audibleVolume, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, stop)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(stop + 0.02)
    }
  } catch {
    // Audio is a convenience cue; timer text still works if Web Audio is blocked.
  }
}
