// Types partagés. Alignés sur le futur backend FastAPI (V2) : ne pas les changer sans mettre à jour le contrat.

export type IncidentType = 'violence' | 'chute' | 'sos' | 'vol'
export type IncidentStatus = 'nouveau' | 'en_cours' | 'cloture'
export type Resolution = 'confirme' | 'fausse_alerte'
export type Role = 'user' | 'admin'

export interface LatLng {
  lat: number
  lng: number
}

export interface Incident {
  id: string
  type: IncidentType
  /** Score 0-1 donné par le moteur de décision. Absent pour un SOS (pas d'IA). */
  score?: number
  status: IncidentStatus
  /** Moment de l'événement (détection ou envoi du SOS), ISO 8601. */
  createdAt: string
  /** Moment de réception par le système : sert au compteur d'attente. */
  receivedAt: string
  /** Prise en charge par un admin. */
  takenAt?: string
  closedAt?: string
  /** Renseignée à la clôture : confirmé ou fausse alerte. */
  resolution?: Resolution
  /** Null si l'utilisateur a révoqué son GPS : le SOS part « sans position ». */
  position: LatLng | null
  source: 'camera' | 'app'
  cameraId?: string
  userId?: string
  /** Référence d'une vignette SVG générée (ex. "svg:violence:2"). Aucune vraie image en V1. */
  imageUrl: string
  description: string
  /** Nombre de fenêtres consécutives au-dessus du seuil au moment de l'alerte. */
  windowsConfirmed: number
  assignedTo?: string
  /** Vrai pour la détection de vol (module expérimental). */
  experimental?: boolean
}

export type AlertKind =
  | 'detection'
  | 'sos'
  | 'prise_en_charge'
  | 'cloture'
  | 'resolution'
  | 'reouverture'
  | 'panne_camera'
  | 'retablissement'
  | 'reinitialisation'

export interface AlertLog {
  id: string
  /** Null pour les événements système (panne simulée, réinitialisation). */
  incidentId: string | null
  kind: AlertKind
  action: string
  actor: string
  at: string // ISO 8601
}

export interface Camera {
  id: string
  name: string
  position: LatLng
  online: boolean
  lastFrameAt: string
  /** Calculé à partir des incidents du jour. */
  incidentsToday: number
  /** Vrai si la caméra est hors ligne à cause de la panne simulée (« Rétablir » la remet en ligne). */
  simulatedOutage?: boolean
}

export type ServiceState = 'actif' | 'degrade' | 'inactif'

/** État du système : entièrement simulé en V1. */
export interface SystemHealth {
  aiService: ServiceState
  api: ServiceState
  realtime: ServiceState
  /** Latence de bout en bout du dernier incident (simulée). */
  lastLatencyMs: number | null
}

export interface PrivacyPrefs {
  /** Null tant que l'utilisateur n'a pas répondu. */
  gpsConsent: boolean | null
  shareCamerasOnMap: boolean
  /** Valeur indicative (simulée). */
  retentionDays: number
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface DbState {
  incidents: Incident[]
  cameras: Camera[]
  logs: AlertLog[]
  health: SystemHealth
  prefs: Record<string, PrivacyPrefs>
}
