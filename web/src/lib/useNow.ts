// Un SEUL minuteur partagé pour toute l'application (compteurs d'attente, frise, santé).
// Il démarre au premier abonné et s'arrête au dernier : pas de fuite à la navigation.
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
let now = Date.now()

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** Heure courante, rafraîchie chaque seconde. Seuls les composants qui l'utilisent se redessinent. */
export const useNow = (): number => useSyncExternalStore(subscribe, () => now)

/** Minute courante : ne redessine le composant qu'une fois par minute. */
export const useNowMinute = (): number => useSyncExternalStore(subscribe, () => Math.floor(now / 60_000)) * 60_000
