import { useCallback, useEffect, useRef } from 'react'

export function useScreenWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const releaseWakeLock = useCallback(async () => {
    const wakeLock = wakeLockRef.current
    wakeLockRef.current = null

    if (wakeLock && !wakeLock.released) {
      await wakeLock.release()
    }
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (
      !active ||
      document.visibilityState !== 'visible' ||
      !('wakeLock' in navigator)
    ) {
      return
    }

    if (wakeLockRef.current && !wakeLockRef.current.released) {
      return
    }

    try {
      const wakeLock = await navigator.wakeLock.request('screen')

      if (!active || document.visibilityState !== 'visible') {
        await wakeLock.release()
        return
      }

      wakeLockRef.current = wakeLock
    } catch {
      // Wake Lock is optional; the timer remains usable without it.
    }
  }, [active])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    void requestWakeLock()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void releaseWakeLock()
    }
  }, [releaseWakeLock, requestWakeLock])
}
