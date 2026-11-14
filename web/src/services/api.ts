// Contrats des services. Les écrans ne dépendent QUE de ces interfaces.
// V1 : implémentation mock (services/mock). V2 : implémentation FastAPI (services/http).
import type { AlertLog, Camera, Incident, IncidentStatus, LatLng, Role, User } from './types'

export interface NewDetectedIncident {
  type: Exclude<Incident['type'], 'sos'>
  score: number
  position: LatLng
  cameraId?: string
  description: string
  windowsConfirmed: number
}

export interface IncidentsApi {
  list(): Promise<Incident[]>
  listCameras(): Promise<Camera[]>
  listLogs(): Promise<AlertLog[]>
  /** Change le statut, assigne l'admin courant et écrit dans le journal d'audit. */
  setStatus(id: string, status: IncidentStatus, actor: User): Promise<Incident>
  /** Crée un incident issu d'une détection (en V2 : fait par le service IA, pas par le navigateur). */
  createDetected(input: NewDetectedIncident): Promise<Incident>
  /** Notifié à chaque changement (V1 : BroadcastChannel/localStorage, V2 : WebSocket). */
  subscribe(listener: () => void): () => void
  /** Remet les données de départ. */
  reset(): Promise<void>
}

export interface AuthApi {
  login(email: string, password: string): Promise<User>
  loginAs(role: Role): Promise<User>
  logout(): void
  current(): User | null
  demoAccounts(): { role: Role; email: string; password: string }[]
}

export interface SosApi {
  /** Crée un incident SOS : position GPS directe, sans passer par l'IA. */
  send(user: User, position: LatLng, positionSource: string): Promise<Incident>
}

export interface Services {
  incidents: IncidentsApi
  auth: AuthApi
  sos: SosApi
}
