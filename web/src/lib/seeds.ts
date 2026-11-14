// Données de départ de la démo : tout est fictif (aucune vraie personne, aucun vrai lieu d'incident).
import type { AlertLog, Camera, DbState, Incident, IncidentStatus, IncidentType, User } from '../services/types'
import { DEMO_CENTER, offsetMeters } from './geo'

export const DEMO_USER: User = { id: 'u-user', name: 'Amina Demo', email: 'user@vigilis.demo', role: 'user' }
export const DEMO_ADMIN: User = { id: 'u-admin', name: 'Admin Démo', email: 'admin@vigilis.demo', role: 'admin' }
export const DEMO_PASSWORD = 'demo1234'

export const SYSTEM_ACTOR = 'Système (IA simulée)'

const CAMERA_DEFS: [string, string, number, number, boolean][] = [
  ['cam-1', 'Entrée principale', 0, 0, true],
  ['cam-2', 'Parking', 180, -120, true],
  ['cam-3', 'Hall', -90, 70, true],
  ['cam-4', 'Quai de livraison', -220, -160, false],
  ['cam-5', 'Rayon centre', 120, 150, true],
]

export function seedCameras(): Camera[] {
  return CAMERA_DEFS.map(([id, name, dx, dy, online]) => ({ id, name, position: offsetMeters(DEMO_CENTER, dx, dy), online }))
}

// [type, minutes passées, statut, score, fenêtres, caméra, dx, dy, description]
type Row = [IncidentType, number, IncidentStatus, number | undefined, number, string | undefined, number, number, string]

const ROWS: Row[] = [
  ['violence', 8, 'nouveau', 0.86, 3, 'cam-1', 4, 6, "Deux personnes semblent se battre près de l'entrée."],
  ['chute', 22, 'nouveau', 0.81, 4, 'cam-3', -88, 74, 'Une personne est tombée et reste immobile au sol depuis plus de 10 secondes.'],
  ['sos', 35, 'en_cours', undefined, 0, undefined, 260, 90, "Alerte SOS envoyée depuis l'application. Position GPS transmise."],
  ['vol', 51, 'nouveau', 0.58, 3, 'cam-5', 118, 155, 'Comportement inhabituel près des rayonnages (module expérimental, à vérifier).'],
  ['violence', 95, 'en_cours', 0.79, 3, 'cam-2', 176, -118, 'Altercation physique détectée sur le parking.'],
  ['chute', 140, 'cloture', 0.88, 5, 'cam-1', -3, 2, "Chute d'une personne dans l'allée d'accès, secours alertés."],
  ['sos', 190, 'cloture', undefined, 0, undefined, -310, 40, "Alerte SOS envoyée depuis l'application. Position GPS transmise."],
  ['violence', 260, 'cloture', 0.74, 3, 'cam-3', -92, 66, 'Bousculade violente observée dans le hall.'],
  ['vol', 330, 'cloture', 0.55, 3, 'cam-5', 124, 146, 'Objet dissimulé sous un vêtement (module expérimental, non confirmé).'],
  ['chute', 480, 'cloture', 0.77, 3, 'cam-2', 190, -126, 'Personne au sol près des places réservées, relevée par un agent.'],
  ['sos', 640, 'cloture', undefined, 0, undefined, 90, -220, "Alerte SOS envoyée depuis l'application. Position GPS transmise."],
  ['violence', 790, 'cloture', 0.72, 3, 'cam-1', 8, -4, "Échange de coups signalé à l'entrée, situation calmée."],
  ['vol', 960, 'cloture', 0.52, 3, 'cam-5', 110, 160, 'Scène ambiguë classée sans suite (module expérimental).'],
  ['chute', 1250, 'cloture', 0.83, 4, 'cam-3', -80, 60, 'Malaise : personne assise au sol, immobile, prise en charge.'],
]

export function seedState(now: number = Date.now()): DbState {
  const incidents: Incident[] = []
  const logs: AlertLog[] = []
  const cameras = seedCameras()
  ROWS.forEach(([type, minutes, status, score, windows, cameraId, dx, dy, description], i) => {
    const id = `inc-seed-${String(i + 1).padStart(2, '0')}`
    const createdAt = new Date(now - minutes * 60_000).toISOString()
    const fromApp = type === 'sos'
    incidents.push({
      id,
      type,
      score,
      status,
      createdAt,
      position: offsetMeters(DEMO_CENTER, dx, dy),
      source: fromApp ? 'app' : 'camera',
      cameraId,
      userId: fromApp ? DEMO_USER.id : undefined,
      imageUrl: `svg:${type}:${i % 4}`,
      description,
      windowsConfirmed: windows,
      assignedTo: status === 'nouveau' ? undefined : DEMO_ADMIN.name,
      experimental: type === 'vol' ? true : undefined,
    })
    const at = (plusMin: number) => new Date(now - (minutes - plusMin) * 60_000).toISOString()
    logs.push({ id: `log-${id}-1`, incidentId: id, action: fromApp ? 'SOS reçu' : 'Incident détecté', actor: fromApp ? DEMO_USER.name : SYSTEM_ACTOR, at: createdAt })
    if (status !== 'nouveau') logs.push({ id: `log-${id}-2`, incidentId: id, action: 'Passé en cours (assigné)', actor: DEMO_ADMIN.name, at: at(2) })
    if (status === 'cloture') logs.push({ id: `log-${id}-3`, incidentId: id, action: 'Clôturé', actor: DEMO_ADMIN.name, at: at(9) })
  })
  return { incidents, cameras, logs }
}
