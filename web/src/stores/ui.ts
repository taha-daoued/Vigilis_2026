// État d'interface partagé : mode supervision, son, simulateur, visite guidée, seuil d'attente.
import { create } from 'zustand'
import { DEFAULT_WAIT_THRESHOLD_S } from '../lib/priority'

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* ignoré */
  }
}

export const UI_KEYS = ['vigilis.sound', 'vigilis.waitThreshold', 'vigilis.tour.done'] as const

interface UiState {
  supervision: boolean
  /** Son : désactivé par défaut tant que l'utilisateur n'a pas cliqué. */
  soundOn: boolean
  simRunning: boolean
  tourOpen: boolean
  waitThresholdS: number
  setSupervision: (v: boolean) => void
  setSound: (v: boolean) => void
  setSimRunning: (v: boolean) => void
  openTour: () => void
  closeTour: () => void
  setWaitThreshold: (s: number) => void
  /** Remet les préférences d'interface à zéro (utilisé par « Réinitialiser la démo »). */
  resetUi: () => void
}

export const useUi = create<UiState>((set) => ({
  supervision: false,
  soundOn: read('vigilis.sound') === '1',
  simRunning: true,
  tourOpen: false,
  waitThresholdS: Number(read('vigilis.waitThreshold')) || DEFAULT_WAIT_THRESHOLD_S,
  setSupervision: (supervision) => set({ supervision }),
  setSound(soundOn) {
    write('vigilis.sound', soundOn ? '1' : '0')
    set({ soundOn })
  },
  setSimRunning: (simRunning) => set({ simRunning }),
  openTour: () => set({ tourOpen: true }),
  closeTour() {
    write('vigilis.tour.done', '1')
    set({ tourOpen: false })
  },
  setWaitThreshold(waitThresholdS) {
    write('vigilis.waitThreshold', String(waitThresholdS))
    set({ waitThresholdS })
  },
  resetUi() {
    UI_KEYS.forEach((k) => write(k, null))
    set({ soundOn: false, simRunning: true, waitThresholdS: DEFAULT_WAIT_THRESHOLD_S, tourOpen: false })
  },
}))

export const tourAlreadySeen = (): boolean => read('vigilis.tour.done') === '1'
