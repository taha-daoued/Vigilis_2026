// Unique point de choix de l'implémentation. Les composants importent d'ici, jamais de ./mock ni de ./http directement.
//   VITE_DATA_MODE=mock (défaut) : démo 100 % navigateur, aucun réseau.
//   VITE_DATA_MODE=http          : FastAPI + Firebase (nécessite le backend lancé et un vrai compte).
import type { Services } from './api'
import { httpServices } from './http'
import { mockServices } from './mock'

const mode = import.meta.env.VITE_DATA_MODE ?? 'mock'

/** Vrai en mode démo : les contrôles de démonstration (simulateur, pannes, changement de rôle) n'existent qu'ici. */
export const isMock = mode !== 'http'

export const services: Services = isMock ? mockServices : httpServices
export const { incidents: incidentsApi, auth: authApi, sos: sosApi, prefs: prefsApi } = services
export type * from './types'
