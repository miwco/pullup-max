export const FINISH_TIMER_STORAGE_PREFIX = 'pullup-max:finish-timer'

export function clearFinishTimers() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(`${FINISH_TIMER_STORAGE_PREFIX}:`))
      .forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Ignore cleanup failures.
  }
}
