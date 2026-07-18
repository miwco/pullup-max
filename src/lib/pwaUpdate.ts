const PWA_UPDATE_EVENT = 'pullup-max:pwa-update'
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null

export function configurePwaUpdate(
  updateHandler: (reloadPage?: boolean) => Promise<void>,
) {
  applyUpdate = updateHandler
}

export function notifyPwaUpdateAvailable() {
  window.dispatchEvent(new Event(PWA_UPDATE_EVENT))
}

export function subscribeToPwaUpdate(onUpdate: () => void) {
  window.addEventListener(PWA_UPDATE_EVENT, onUpdate)
  return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdate)
}

export async function applyPwaUpdate() {
  await applyUpdate?.(true)
}
