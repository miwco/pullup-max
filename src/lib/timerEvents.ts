const TIMER_STOP_EVENT = 'pullup-max:stop-timer'

export function requestTimerStop(storageKey: string) {
  window.dispatchEvent(
    new CustomEvent<string>(TIMER_STOP_EVENT, { detail: storageKey }),
  )
}

export function subscribeToTimerStop(storageKey: string, onStop: () => void) {
  function handleTimerStop(event: Event) {
    if ((event as CustomEvent<string>).detail === storageKey) {
      onStop()
    }
  }

  window.addEventListener(TIMER_STOP_EVENT, handleTimerStop)
  return () => window.removeEventListener(TIMER_STOP_EVENT, handleTimerStop)
}
