// Historique personnel : date, lieu, statut final. Un clic rouvre la frise de suivi.
import { useState } from 'react'
import { AlertTimeline } from '../components/AlertTimeline'
import { ResolutionBadge, StatusBadge } from '../components/badges'
import { USER_STATUS_LABEL, dateTime } from '../lib/format'
import { placeLabel } from '../lib/geo'
import { useData } from '../stores/data'
import { useSession } from '../stores/session'

export function UserAlerts() {
  const user = useSession((s) => s.user)!
  const { incidents, cameras } = useData()
  const [openId, setOpenId] = useState<string | null>(null)
  const mine = incidents.filter((i) => i.userId === user.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

  return (
    <section aria-labelledby="mes" className="space-y-3">
      <h1 id="mes" className="text-xl font-bold">Mes alertes</h1>
      {mine.length === 0 ? <p className="card p-4 text-sm text-muted">Aucune alerte envoyée pour l'instant.</p> : (
        <ul className="space-y-2">
          {mine.map((i) => {
            const expanded = openId === i.id
            return (
              <li key={i.id} className="card">
                <button className="flex min-h-14 w-full flex-col gap-1 p-3 text-left" aria-expanded={expanded} aria-controls={`frise-${i.id}`} onClick={() => setOpenId(expanded ? null : i.id)}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">SOS · {dateTime(i.createdAt)}</span>
                    <StatusBadge status={i.status} label={USER_STATUS_LABEL[i.status]} />
                  </span>
                  <span className="text-xs text-muted">{placeLabel(i.position, cameras)}</span>
                  {i.status === 'cloture' && i.resolution && <ResolutionBadge resolution={i.resolution} />}
                </button>
                {expanded && <div id={`frise-${i.id}`} className="border-t border-line p-3"><AlertTimeline incident={i} /></div>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
