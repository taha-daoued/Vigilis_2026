// Contrats des services. Les écrans ne dépendent QUE de ces interfaces.
// V1 : implémentation mock (services/mock). V2 : implémentation FastAPI (services/http).
import type { AlertLog, Camera, Incident, IncidentStatus, LatLng, PrivacyPrefs, Resolution, Role, SystemHealth, User } from './types'

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
  getHealth(): Promise<SystemHealth>
  /**
   * Change le statut, assigne l'admin courant et écrit dans le journal d'audit.
   * La clôture exige une résolution (confirmé ou fausse alerte).
   */
  setStatus(id: string, status: IncidentStatus, actor: User, resolution?: Resolution): Promise<Incident>
  /** Crée un incident issu d'une détection (en V2 : fait par le service IA, pas par le navigateur). */
  createDetected(input: NewDetectedIncident): Promise<Incident>
  /** Démo : met une caméra en ligne hors ligne. Renvoie la caméra touchée, ou null s'il n'y en a plus. */
  simulateCameraOutage(actor: User): Promise<Camera | null>
  /** Démo : remet en ligne les caméras en panne simulée. Renvoie leur nombre. */
  restoreCameras(actor: User): Promise<number>
  /** Notifié à chaque changement (V1 : BroadcastChannel/localStorage, V2 : WebSocket). */
  subscribe(listener: () => void): () => void
  /** Remet les données de départ (incidents, pannes, résolutions, préférences). */
  reset(actor?: User): Promise<void>
}

export interface AuthApi {
  login(email: string, password: string): Promise<User>
  loginAs(role: Role): Promise<User>
  logout(): void
  current(): User | null
  demoAccounts(): { role: Role; email: string; password: string }[]
}

export interface SosApi {
  /** Crée un incident SOS : position GPS directe (ou null si GPS révoqué), sans passer par l'IA. */
  send(user: User, position: LatLng | null, positionSource: string): Promise<Incident>
}

export interface PrefsApi {
  getAll(): Promise<Record<string, PrivacyPrefs>>
  update(userId: string, patch: Partial<PrivacyPrefs>): Promise<void>
}

export interface Services {
  incidents: IncidentsApi
  auth: AuthApi
  sos: SosApi
  prefs: PrefsApi
}
