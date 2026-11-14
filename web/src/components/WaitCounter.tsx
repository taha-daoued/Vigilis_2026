import { memo } from 'react'
import { formatDuration } from '../lib/format'
import { isOverdue, waitSeconds } from '../lib/priority'
import { useNow } from '../lib/useNow'

/**
 * Compteur d'attente d'un incident « nouveau », mis à jour chaque seconde grâce au minuteur partagé.
 * Au-delà du seuil : icône ⚠, texte « dépassée » et bordure (jamais la couleur seule).
 */
export const WaitCounter = memo(function WaitCounter({ receivedAt, thresholdS }: { receivedAt: string; thresholdS: number }) {
  const now = useNow()
  const seconds = waitSeconds({ receivedAt }, now)
  const overdue = isOverdue(seconds, thresholdS)
  return overdue ? (
    <span className="inline-flex items-center gap-1 rounded border-2 border-danger px-1.5 py-0.5 text-xs font-bold text-danger">
      <span aria-hidden="true">⚠</span> Attente dépassée : {formatDuration(seconds)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <span aria-hidden="true">⏱</span> En attente depuis {formatDuration(seconds)}
    </span>
  )
})
