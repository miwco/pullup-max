import { useEffect, useRef } from 'react'

const DEFAULT_MESSAGE = 'You have unsaved changes. Leave this screen?'
const DEFAULT_HASH = '#/today'

export function useUnsavedChangesPrompt(
  shouldWarn: boolean,
  message = DEFAULT_MESSAGE,
) {
  const currentHashRef = useRef(DEFAULT_HASH)
  const isRevertingRef = useRef(false)

  useEffect(() => {
    currentHashRef.current = window.location.hash || DEFAULT_HASH
  }, [])

  useEffect(() => {
    if (!shouldWarn) {
      currentHashRef.current = window.location.hash || DEFAULT_HASH
    }
  }, [shouldWarn])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!shouldWarn) {
        return
      }

      event.preventDefault()
      event.returnValue = message
    }

    function handleHashChange() {
      const nextHash = window.location.hash || DEFAULT_HASH

      if (isRevertingRef.current) {
        isRevertingRef.current = false
        currentHashRef.current = nextHash
        return
      }

      if (!shouldWarn || nextHash === currentHashRef.current) {
        currentHashRef.current = nextHash
        return
      }

      if (window.confirm(message)) {
        currentHashRef.current = nextHash
        return
      }

      isRevertingRef.current = true
      window.location.hash = currentHashRef.current || DEFAULT_HASH
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [message, shouldWarn])
}
