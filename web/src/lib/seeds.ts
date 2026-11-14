// Données de départ de la démo : tout est fictif (aucune vraie personne, aucun vrai lieu d'incident).
import type { AlertLog, Camera, DbState, Incident, IncidentStatus, IncidentType, PrivacyPrefs, Resolution, User } from '../services/types'
import { DEMO_CENTER, offsetMeters } from './geo'

export const DEMO_USER: User = { id: 'u-user', name: 'Amina Demo', email: 'user@vigilis.demo', role: 'user' }
export const DEMO_ADMIN: User = { id: 'u-admin', name: 'Admin Démo', email: 'admin@vigilis.demo', role: 'admin' }
export const DEMO_PASSWORD = 'demo1234'
export const SYSTEM_ACTOR = 'Système (IA simulée)'

export const DEFAULT_PREFS: PrivacyPrefs = { gpsConsent: null, shareCamerasOnMap: false, retentionDays: 30 }

const MIN = 60_000
const iso = (ms: number) => new Date(ms).toISOString()

// [id, nom, dx, dy, en ligne, ancienneté de la dernière image (min) si hors ligne]
const CAMERA_DEFS: [string, string, number, number, boolean][] = [
  ['cam-1', 'Entrée principale', 0, 0, true],
  ['cam-2', 'Parking', 180, -120, true],
  ['cam-3', 'Hall', -90, 70, true],
  ['cam-4', 'Quai de livraison', -220, -160, false],
  ['cam-5', 'Rayon centre', 120, 150, true],
]

export function seedCameras(now: number = Date.now()): Camera[] {
  return CAMERA_DEFS.map(([id, name, dx, dy, online]) => ({
    id,
    name,
    position: offsetMeters(DEMO_CENTER, dx, dy),
    online,
    lastFrameAt: iso(online ? now - 3000 : now - 190 * MIN),
    incidentsToday: 0,
  }))
}

const DESC: Record<IncidentType, string[]> = {
  violence: ["Deux personnes semblent se battre près de l'entrée.", 'Altercation physique détectée dans le couloir.', 'Bousculade violente observée devant le guichet.'],
  chute: ['Une personne est tombée et reste immobile au sol.', 'Malaise possible : personne au sol depuis plus de 10 secondes.', "Chute détectée dans l'escalier, aucune réaction visible."],
  sos: ["Alerte SOS envoyée depuis l'application. Position GPS transmise."],
  vol: ['Geste suspect près des rayonnages (module expérimental, à vérifier).', 'Objet possiblement dissimulé (module expérimental, non confirmé).'],
}

// [type, minutes passées, statut, score, fenêtres, caméra, dx, dy, description, résolution]
type Row = [IncidentType, number, IncidentStatus, number | undefined, number, string | undefined, number, number, string, Resolution?]

const ROWS: Row[] = [
  ['violence', 1, 'nouveau', 0.86, 3, 'cam-1', 4, 6, "Deux personnes semblent se battre près de l'entrée."],
  ['chute', 3, 'nouveau', 0.81, 4, 'cam-3', -88, 74, 'Une personne est tombée et reste immobile au sol depuis plus de 10 secondes.'],
  ['sos', 35, 'en_cours', undefined, 0, undefined, 260, 90, "Alerte SOS envoyée depuis l'application. Position GPS transmise."],
  ['vol', 7, 'nouveau', 0.58, 3, 'cam-5', 118, 155, 'Comportement inhabituel près des rayonnages (module expérimental, à vérifier).'],
  ['violence', 95, 'en_cours', 0.79, 3, 'cam-2', 176, -118, 'Altercation physique détectée sur le parking.'],
  ['chute', 140, 'cloture', 0.88, 5, 'cam-1', -3, 2, "Chute d'une personne dans l'allée d'accès, secours alertés.", 'confirme'],
  ['sos', 190, 'cloture', undefined, 0, undefined, -310, 40, "Alerte SOS envoyée depuis l'application. Position GPS transmise.", 'confirme'],
  ['violence', 260, 'cloture', 0.74, 3, 'cam-3', -92, 66, 'Bousculade violente observée dans le hall.', 'confirme'],
  ['vol', 330, 'cloture', 0.55, 3, 'cam-5', 124, 146, 'Objet dissimulé sous un vêtement (module expérimental, non confirmé).', 'fausse_alerte'],
  ['chute', 480, 'cloture', 0.77, 3, 'cam-2', 190, -126, 'Personne au sol près des places réservées, relevée par un agent.', 'confirme'],
  ['sos', 640, 'cloture', undefined, 0, undefined, 90, -220, "Alerte SOS envoyée depuis l'application. Position GPS transmise.", 'confirme'],
  ['violence', 790, 'cloture', 0.72, 3, 'cam-1', 8, -4, "Échange de coups signalé à l'entrée, situation calmée.", 'confirme'],
  ['vol', 960, 'cloture', 0.52, 3, 'cam-5', 110, 160, 'Scène ambiguë classée sans suite (module expérimental).', 'fausse_alerte'],
  ['chute', 1250, 'cloture', 0.83, 4, 'cam-3', -80, 60, 'Malaise : personne assise au sol, immobile, prise en charge.', 'confirme'],
]

/** Générateur pseudo-aléatoire déterministe : l'historique est le même à chaque réinitialisation. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Historique des jours précédents (tous clos) : alimente les statistiques. */
function historyRows(now: number): Row[] {
  const rnd = mulberry32(2026)
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]
  const hours = [7, 8, 9, 12, 13, 14, 17, 18, 18, 19, 19, 20, 21, 22, 10, 15, 16, 23, 2, 5]
  const cams = ['cam-1', 'cam-2', 'cam-3', 'cam-5']
  const rows: Row[] = []
  for (let n = 0; n < 40; n++) {
    const r = rnd()
    const type: IncidentType = r < 0.3 ? 'violence' : r < 0.6 ? 'chute' : r < 0.85 ? 'sos' : 'vol'
    const day = 2 + Math.floor(rnd() * 5) // entre 2 et 6 jours en arrière
    const d = new Date(now)
    const nowMin = d.getHours() * 60 + d.getMinutes()
    const minutesAgo = day * 1440 + nowMin - (pick(hours) * 60 + Math.floor(rnd() * 60)) // même jour passé, heure choisie
    const score = type === 'sos' ? undefined : type === 'vol' ? +(0.5 + rnd() * 0.12).toFixed(2) : +(0.72 + rnd() * 0.23).toFixed(2)
    const fausse = type === 'vol' ? rnd() < 0.45 : rnd() < 0.12
    const cam = type === 'sos' ? undefined : pick(cams)
    rows.push([type, minutesAgo, 'cloture', score, 3 + Math.floor(rnd() * 3), cam, Math.round(rnd() * 360 - 180), Math.round(rnd() * 300 - 150), pick(DESC[type]), fausse ? 'fausse_alerte' : 'confirme'])
  }
  return rows
}

export function seedState(now: number = Date.now()): DbState {
  const incidents: Incident[] = []
  const logs: AlertLog[] = []
  const cameras = seedCameras(now)
  const all: [string, Row][] = [
    ...ROWS.map((r, i): [string, Row] => [`inc-seed-${String(i + 1).padStart(2, '0')}`, r]),
    ...historyRows(now).map((r, i): [string, Row] => [`inc-hist-${String(i + 1).padStart(2, '0')}`, r]),
  ]

  all.forEach(([id, [type, minutes, status, score, windows, cameraId, dx, dy, description, resolution]], i) => {
    const created = now - minutes * MIN
    const fromApp = type === 'sos'
    const received = created + (fromApp ? 600 : 1200 + (i % 5) * 400) // latence simulée
    const taken = status === 'nouveau' ? undefined : received + (1.5 + (i % 6)) * MIN
    const closed = status === 'cloture' ? taken! + (6 + (i % 9) * 2) * MIN : undefined
    incidents.push({
      id,
      type,
      score,
      status,
      createdAt: iso(created),
      receivedAt: iso(received),
      takenAt: taken ? iso(taken) : undefined,
      closedAt: closed ? iso(closed) : undefined,
      resolution: status === 'cloture' ? resolution : undefined,
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
    logs.push({ id: `log-${id}-1`, incidentId: id, kind: fromApp ? 'sos' : 'detection', action: fromApp ? 'SOS reçu' : 'Incident détecté', actor: fromApp ? DEMO_USER.name : SYSTEM_ACTOR, at: iso(received) })
    if (taken) logs.push({ id: `log-${id}-2`, incidentId: id, kind: 'prise_en_charge', action: 'Passé en cours (assigné)', actor: DEMO_ADMIN.name, at: iso(taken) })
    if (closed) {
      logs.push({ id: `log-${id}-3`, incidentId: id, kind: 'cloture', action: 'Clôturé', actor: DEMO_ADMIN.name, at: iso(closed) })
      logs.push({ id: `log-${id}-4`, incidentId: id, kind: 'resolution', action: `Résolution : ${resolution === 'fausse_alerte' ? 'Fausse alerte' : 'Confirmé'}`, actor: DEMO_ADMIN.name, at: iso(closed) })
    }
  })

  return {
    incidents,
    cameras,
    logs,
    health: { aiService: 'actif', api: 'actif', realtime: 'actif', lastLatencyMs: 1600 },
    prefs: { [DEMO_USER.id]: { ...DEFAULT_PREFS }, [DEMO_ADMIN.id]: { ...DEFAULT_PREFS } },
  }
}
