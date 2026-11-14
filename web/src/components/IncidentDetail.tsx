import { incidentsApi } from '../services'
import type { AlertLog, Camera, Incident, IncidentStatus } from '../services'
import { REQUIRED_WINDOWS, THRESHOLDS } from '../lib/decision'
import { formatPosition } from '../lib/geo'
import { STATUS_LABEL, clockTime, dateTime } from '../lib/format'
import { useSession } from '../stores/session'
import { ExperimentalBadge, StatusBadge, TypeBadge } from './badges'
import { IncidentThumb } from './IncidentThumb'

const NEXT: Record<IncidentStatus, { to: IncidentStatus; label: string } | null> = {
  nouveau: { to: 'en_cours', label: 'Prendre en charge' },
  en_cours: { to: 'cloture', label: 'Clôturer' },
  cloture: null,
}

interface Props {
  incident: Incident
  cameras: Camera[]
  logs: AlertLog[]
  onClose: () => void
}

export function IncidentDetail({ incident: i, cameras, logs, onClose }: Props) {
  const user = useSession((s) => s.user)!
  const camera = cameras.find((c) => c.id === i.cameraId)
  const history = logs.filter((l) => l.incidentId === i.id).sort((a, b) => +new Date(a.at) - +new Date(b.at))
  const next = NEXT[i.status]
  const threshold = i.type === 'sos' ? undefined : THRESHOLDS[i.type]

  return (
    <article aria-label="Détail de l'incident" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line p-3">
        <button className="btn" onClick={onClose}>← Liste</button>
        <StatusBadge status={i.status} />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
        <IncidentThumb url={i.imageUrl} />
        <div className="flex flex-wrap items-center gap-2"><TypeBadge type={i.type} /> {i.experimental && <ExperimentalBadge />}</div>
        <p className="text-base">{i.description}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">Score</dt>
          <dd>{i.score !== undefined ? `${i.score.toFixed(2)} (seuil démo ${threshold})` : 'Aucun : le SOS ne passe pas par l\'IA'}</dd>
          <dt className="text-muted">Fenêtres confirmées</dt>
          <dd>{i.type === 'sos' ? '—' : `${i.windowsConfirmed} (minimum ${REQUIRED_WINDOWS})`}</dd>
          <dt className="text-muted">Source</dt>
          <dd>{i.source === 'camera' ? `Caméra${camera ? ` : ${camera.name}` : ''}` : 'Application utilisateur'}</dd>
          <dt className="text-muted">Position</dt>
          <dd className="font-mono text-xs">{formatPosition(i.position)}</dd>
          <dt className="text-muted">Détecté</dt>
          <dd>{dateTime(i.createdAt)}</dd>
          <dt className="text-muted">Assigné à</dt>
          <dd>{i.assignedTo ?? 'Personne'}</dd>
        </dl>
        {next ? (
          <button className="btn btn-primary w-full" onClick={() => void incidentsApi.setStatus(i.id, next.to, user)}>
            {next.label} ({STATUS_LABEL[i.status]} → {STATUS_LABEL[next.to]})
          </button>
        ) : (
          <button className="btn w-full" onClick={() => void incidentsApi.setStatus(i.id, 'nouveau', user)}>Rouvrir l'incident</button>
        )}
        <section aria-labelledby="hist">
          <h3 id="hist" className="mb-2 text-sm font-bold">Historique des actions</h3>
          <ol className="space-y-1 text-sm">
            {history.map((l) => (
              <li key={l.id} className="flex gap-2"><span className="font-mono text-xs text-muted">{clockTime(l.at)}</span><span>{l.action} <span className="text-muted">— {l.actor}</span></span></li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  )
}
