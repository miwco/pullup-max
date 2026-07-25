const TIMER_STOP_EVENT = 'pullup-max:stop-timer'
const TIMER_ACTIVATE_EVENT = 'pullup-max:activate-timer'

interface TimerActivationDetail {
  groupId: string
  storageKey: string
}

export function requestTimerStop(storageKey: string) {
  window.dispatchEvent(
    new CustomEvent<string>(TIMER_STOP_EVENT, { detail: storageKey }),
  )
}

export function requestExclusiveTimerStart(
  groupId: string,
  storageKey: string,
) {
  window.dispatchEvent(
    new CustomEvent<TimerActivationDetail>(TIMER_ACTIVATE_EVENT, {
      detail: { groupId, storageKey },
    }),
  )
}

export function subscribeToTimerStop(
  storageKey: string,
  onStop: () => void,
  exclusiveGroupId?: string,
) {
  function handleTimerStop(event: Event) {
    if ((event as CustomEvent<string>).detail === storageKey) {
      onStop()
    }
  }

  function handleTimerActivation(event: Event) {
    const detail = (event as CustomEvent<TimerActivationDetail>).detail

    if (
      exclusiveGroupId &&
      detail.groupId === exclusiveGroupId &&
      detail.storageKey !== storageKey
    ) {
      onStop()
    }
  }

  window.addEventListener(TIMER_STOP_EVENT, handleTimerStop)
  window.addEventListener(TIMER_ACTIVATE_EVENT, handleTimerActivation)

  return () => {
    window.removeEventListener(TIMER_STOP_EVENT, handleTimerStop)
    window.removeEventListener(TIMER_ACTIVATE_EVENT, handleTimerActivation)
  }
}
