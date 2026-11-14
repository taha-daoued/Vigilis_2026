// File de priorité : qui traiter en premier, et depuis combien de temps un incident attend.
import type { Incident } from '../services/types'

/** Seuil d'attente par défaut avant le signalement « dépassé » (configurable dans l'interface). */
export const DEFAULT_WAIT_THRESHOLD_S = 120

const STATUS_RANK = { nouveau: 0, en_cours: 1, cloture: 2 } as const

/**
 * Ordre d'urgence : d'abord les « nouveaux », puis « en cours », puis clos ;
 * dans chaque groupe : SOS, puis score décroissant, puis le plus ancien (il attend depuis plus longtemps).
 */
export function comparePriority(a: Incident, b: Incident): number {
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
  if ((a.type === 'sos') !== (b.type === 'sos')) return a.type === 'sos' ? -1 : 1
  const sa = a.score ?? -1
  const sb = b.score ?? -1
  if (sa !== sb) return sb - sa
  return +new Date(a.receivedAt) - +new Date(b.receivedAt)
}

export const sortByPriority = (list: Incident[]): Incident[] => [...list].sort(comparePriority)

export function waitSeconds(incident: Pick<Incident, 'receivedAt'>, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(incident.receivedAt).getTime()) / 1000))
}

export const isOverdue = (waitS: number, thresholdS: number): boolean => waitS >= thresholdS
