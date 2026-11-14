// Base en mémoire + localStorage, partagée entre onglets (BroadcastChannel + événement « storage »).
import { SYSTEM_ACTOR, seedState } from '../../lib/seeds'
import type { DbState } from '../types'

export const STORAGE_KEY = 'vigilis.demo.v2'
const CHANNEL = 'vigilis-demo'

function readStorage(): DbState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DbState) : null
  } catch {
    return null
  }
}

function writeStorage(state: DbState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* stockage indisponible (navigation privée) : la démo continue en mémoire */
  }
}

let state: DbState = readStorage() ?? seedState()
writeStorage(state)

const listeners = new Set<() => void>()
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null

function notify(): void {
  listeners.forEach((l) => l())
}

function refreshFromStorage(): void {
  state = readStorage() ?? seedState()
  notify()
}

channel?.addEventListener('message', refreshFromStorage)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) refreshFromStorage()
  })
}

export const db = {
  get: (): DbState => state,
  /** Applique une modification, la sauvegarde et prévient les autres onglets. */
  update(mutator: (draft: DbState) => void): void {
    const next: DbState = structuredClone(state)
    mutator(next)
    state = next
    writeStorage(state)
    channel?.postMessage('changed')
    notify()
  },
  /** Remet tout à zéro (incidents, pannes, résolutions, préférences), puis trace la réinitialisation. */
  reset(actorName: string = SYSTEM_ACTOR): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignoré */
    }
    const fresh = seedState()
    const at = new Date().toISOString()
    fresh.logs.push({ id: `log-reset-${Date.now()}`, incidentId: null, kind: 'reinitialisation', action: 'Réinitialisation de la démo', actor: actorName, at })
    state = fresh
    writeStorage(state)
    channel?.postMessage('changed')
    notify()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
