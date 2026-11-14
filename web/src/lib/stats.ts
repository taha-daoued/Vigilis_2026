// Statistiques opérationnelles calculées sur les incidents. Aucune prévision : uniquement du passé.
import type { Incident, IncidentType } from '../services/types'

/** Jour de la semaine avec lundi = 0 ... dimanche = 6. */
export const weekdayIndex = (d: Date): number => (d.getDay() + 6) % 7
export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

/** Matrice 7 jours × 24 heures : nombre d'incidents par case. */
export function heatmap(incidents: Incident[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const i of incidents) {
    const d = new Date(i.createdAt)
    grid[weekdayIndex(d)][d.getHours()]++
  }
  return grid
}

export function countByType(incidents: Incident[]): Record<IncidentType, number> {
  const out: Record<IncidentType, number> = { violence: 0, chute: 0, sos: 0, vol: 0 }
  incidents.forEach((i) => out[i.type]++)
  return out
}

export function countByCamera(incidents: Incident[]): Map<string, number> {
  const out = new Map<string, number>()
  incidents.forEach((i) => i.cameraId && out.set(i.cameraId, (out.get(i.cameraId) ?? 0) + 1))
  return out
}

/** Délai moyen entre réception et prise en charge, en secondes (null si aucune donnée). */
export function meanTakeSeconds(incidents: Incident[]): number | null {
  const delays = incidents.filter((i) => i.takenAt).map((i) => (+new Date(i.takenAt!) - +new Date(i.receivedAt)) / 1000)
  return delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null
}

export interface FalseAlarmShare {
  closed: number
  falseAlarms: number
  /** Part entre 0 et 1, ou null si aucun incident clos avec résolution. */
  share: number | null
}

/** Part de fausses alertes parmi les incidents clos ayant une résolution. */
export function falseAlarmShare(incidents: Incident[]): FalseAlarmShare {
  const closed = incidents.filter((i) => i.status === 'cloture' && i.resolution)
  const falseAlarms = closed.filter((i) => i.resolution === 'fausse_alerte').length
  return { closed: closed.length, falseAlarms, share: closed.length ? falseAlarms / closed.length : null }
}
