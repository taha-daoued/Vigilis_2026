// Types partagés. Alignés sur le futur backend FastAPI (V2) : ne pas les changer sans mettre à jour le contrat.

export type IncidentType = 'violence' | 'chute' | 'sos' | 'vol'
export type IncidentStatus = 'nouveau' | 'en_cours' | 'cloture'
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
  createdAt: string // ISO 8601
  position: LatLng
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

export interface AlertLog {
  id: string
  incidentId: string
  action: string
  actor: string
  at: string // ISO 8601
}

export interface Camera {
  id: string
  name: string
  position: LatLng
  online: boolean
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
}
