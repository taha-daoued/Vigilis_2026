// Moteur de décision (illustration V1) : alerte seulement si le score dépasse le seuil
// sur plusieurs fenêtres consécutives, pour limiter les faux positifs.
import type { IncidentType } from '../services/types'

/** Valeurs de démonstration. Les vraies valeurs seront calibrées sur les vidéos de test (à mesurer). */
export const THRESHOLDS: Record<Exclude<IncidentType, 'sos'>, number> = {
  violence: 0.7,
  chute: 0.7,
  vol: 0.5, // module expérimental : seuil plus bas
}
export const REQUIRED_WINDOWS = 3

export interface DecisionResult {
  /** Nombre de fenêtres consécutives (en partant de la plus récente) au-dessus du seuil. */
  consecutive: number
  triggered: boolean
}

export function evaluateWindows(scores: number[], threshold: number, required: number = REQUIRED_WINDOWS): DecisionResult {
  let consecutive = 0
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i] >= threshold) consecutive++
    else break
  }
  return { consecutive, triggered: consecutive >= required }
}
