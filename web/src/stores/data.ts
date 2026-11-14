// Store des données : lit la couche services et se met à jour à chaque notification (temps réel simulé).
import { create } from 'zustand'
import { incidentsApi, prefsApi } from '../services'
import type { AlertLog, Camera, Incident, PrivacyPrefs, SystemHealth } from '../services'
import { DEFAULT_PREFS } from '../lib/seeds'

interface DataState {
  incidents: Incident[]
  cameras: Camera[]
  logs: AlertLog[]
  health: SystemHealth | null
  prefs: Record<string, PrivacyPrefs>
  ready: boolean
}

export const useData = create<DataState>(() => ({ incidents: [], cameras: [], logs: [], health: null, prefs: {}, ready: false }))

/** Préférences d'un utilisateur (valeurs par défaut tant que rien n'est enregistré). */
export const selectPrefs = (userId: string | undefined) => (s: DataState): PrivacyPrefs => (userId && s.prefs[userId]) || DEFAULT_PREFS

type ArrivalListener = (incident: Incident) => void
const arrivalListeners = new Set<ArrivalListener>()
/** S'abonne aux nouveaux incidents (toast, bip...). Renvoie la fonction de désabonnement. */
export function onIncidentArrival(l: ArrivalListener): () => void {
  arrivalListeners.add(l)
  return () => arrivalListeners.delete(l)
}

let started = false
async function refresh(): Promise<void> {
  const [incidents, cameras, logs, health, prefs] = await Promise.all([
    incidentsApi.list(),
    incidentsApi.listCameras(),
    incidentsApi.listLogs(),
    incidentsApi.getHealth(),
    prefsApi.getAll(),
  ])
  const known = new Set(useData.getState().incidents.map((i) => i.id))
  const wasReady = useData.getState().ready
  useData.setState({ incidents, cameras, logs, health, prefs, ready: true })
  if (wasReady) incidents.filter((i) => !known.has(i.id)).forEach((i) => arrivalListeners.forEach((l) => l(i)))
}

/** Démarre une seule fois le chargement et l'abonnement aux changements. */
export function startDataSync(): void {
  if (started) return
  started = true
  void refresh()
  incidentsApi.subscribe(() => void refresh())
}
