import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

/** Vrai si le navigateur a accès au réseau (la démo, elle, fonctionne aussi hors ligne). */
export const useOnline = (): boolean => useSyncExternalStore(subscribe, () => navigator.onLine)
