// Unique point de choix de l'implémentation. Les composants importent d'ici, jamais de ./mock directement.
import type { Services } from './api'
import { mockServices } from './mock'

const mode = import.meta.env.VITE_DATA_MODE ?? 'mock'

if (mode !== 'mock') {
  // V2 : brancher ici l'implémentation FastAPI (voir services/http/README.md).
  console.warn(`VITE_DATA_MODE="${mode}" non disponible en V1 : retour au mode mock.`)
}

export const services: Services = mockServices
export const { incidents: incidentsApi, auth: authApi, sos: sosApi } = services
export type * from './types'
