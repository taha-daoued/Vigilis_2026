// Store des incidents : lit la couche services et se met à jour à chaque notification (temps réel simulé).
import { create } from 'zustand'
import { incidentsApi } from '../services'
import type { AlertLog, Camera, Incident } from '../services'

interface DataState {
  incidents: Incident[]
  cameras: Camera[]
  logs: AlertLog[]
  ready: boolean
}

export const useData = create<DataState>(() => ({ incidents: [], cameras: [], logs: [], ready: false }))

type ArrivalListener = (incident: Incident) => void
const arrivalListeners = new Set<ArrivalListener>()
/** S'abonne aux nouveaux incidents (toast, bip...). Renvoie la fonction de désabonnement. */
export function onIncidentArrival(l: ArrivalListener): () => void {
  arrivalListeners.add(l)
  return () => arrivalListeners.delete(l)
}

let started = false
async function refresh(): Promise<void> {
  const [incidents, cameras, logs] = await Promise.all([incidentsApi.list(), incidentsApi.listCameras(), incidentsApi.listLogs()])
  const known = new Set(useData.getState().incidents.map((i) => i.id))
  const wasReady = useData.getState().ready
  useData.setState({ incidents, cameras, logs, ready: true })
  if (wasReady) incidents.filter((i) => !known.has(i.id)).forEach((i) => arrivalListeners.forEach((l) => l(i)))
}

/** Démarre une seule fois le chargement et l'abonnement aux changements. */
export function startDataSync(): void {
  if (started) return
  started = true
  void refresh()
  incidentsApi.subscribe(() => void refresh())
}
