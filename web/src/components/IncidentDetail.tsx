// Détail d'incident enrichi : image + squelette, score + fenêtres, mini-carte, incidents proches, historique.
import { useEffect, useMemo, useRef } from 'react'
import { incidentsApi } from '../services'
import type { AlertLog, Camera, Incident } from '../services'
import { REQUIRED_WINDOWS, THRESHOLDS } from '../lib/decision'
import { formatPosition } from '../lib/geo'
import { clockTime, dateTime, formatDuration, hourMinute, TYPE_LABEL } from '../lib/format'
import { nearbyIncidents } from '../lib/proximity'
import { useSession } from '../stores/session'
import { ExperimentalBadge, ResolutionBadge, SimulatedBadge, StatusBadge, TypeBadge } from './badges'
import { IncidentThumb } from './IncidentThumb'
import { MiniMap } from './MiniMap'

interface Props {
  incident: Incident
  incidents: Incident[]
  cameras: Camera[]
  logs: AlertLog[]
  onClose: () => void
  onOpen: (id: string) => void
  onRequestClose: (incident: Incident) => void
}

function ScoreBars({ incident: i }: { incident: Incident }) {
  if (i.type === 'sos' || i.score === undefined) {
    return <p className="rounded-lg border border-line p-3 text-sm">Pas d'analyse IA : le SOS part directement de l'application, sans score ni fenêtres.</p>
  }
  const threshold = THRESHOLDS[i.type]
  const segments = Math.max(i.windowsConfirmed, REQUIRED_WINDOWS)
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <div>
        <p className="flex justify-between text-sm"><span className="font-semibold">Score</span><span>{i.score.toFixed(2)} / seuil {threshold.toFixed(2)} <SimulatedBadge /></span></p>
        <div className="relative mt-1 h-3 rounded bg-surface-2" role="img" aria-label={`Score ${i.score.toFixed(2)}, seuil ${threshold.toFixed(2)}`}>
          <div className="h-3 rounded bg-brand-500" style={{ width: `${i.score * 100}%` }} />
          <div className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: `${threshold * 100}%` }} aria-hidden="true" />
        </div>
        <p className="mt-0.5 text-right text-xs text-muted" style={{ paddingRight: `${(1 - threshold) * 100}%` }}>▲ seuil</p>
      </div>
      <div>
        <p className="flex justify-between text-sm"><span className="font-semibold">Fenêtres consécutives</span><span>{Math.min(i.windowsConfirmed, REQUIRED_WINDOWS)}/{REQUIRED_WINDOWS}{i.windowsConfirmed > REQUIRED_WINDOWS && ` (+${i.windowsConfirmed - REQUIRED_WINDOWS})`}</span></p>
        <ol className="mt-1 flex gap-1" aria-label={`${i.windowsConfirmed} fenêtres au-dessus du seuil, minimum ${REQUIRED_WINDOWS}`}>
          {Array.from({ length: segments }, (_, k) => (
            <li key={k} className={`grid h-6 flex-1 place-items-center rounded text-xs font-bold ${k < REQUIRED_WINDOWS ? 'border border-ok text-ok' : 'border border-dashed border-line text-muted'}`}>{k < i.windowsConfirmed ? '✓' : ''}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export function IncidentDetail({ incident: i, incidents, cameras, logs, onClose, onOpen, onRequestClose }: Props) {
  const user = useSession((s) => s.user)!
  const heading = useRef<HTMLHeadingElement>(null)
  const camera = cameras.find((c) => c.id === i.cameraId)
  const history = logs.filter((l) => l.incidentId === i.id).sort((a, b) => +new Date(a.at) - +new Date(b.at))
  const near = useMemo(() => nearbyIncidents(i, incidents).slice(0, 6), [i, incidents])

  // Accessibilité : le focus passe au titre à l'ouverture, Échap referme.
  useEffect(() => { heading.current?.focus() }, [i.id])

  return (
    <article aria-label="Détail de l'incident" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line p-3">
        <button className="btn" onClick={onClose}>← Retour à la file</button>
        <div className="flex items-center gap-2">{i.resolution && <ResolutionBadge resolution={i.resolution} />}<StatusBadge status={i.status} /></div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <h2 ref={heading} tabIndex={-1} className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold outline-none">
          <TypeBadge type={i.type} /> {i.experimental && <ExperimentalBadge />}
        </h2>
        <p className="mb-3">{i.description}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <IncidentThumb url={i.imageUrl} skeleton />
            <ScoreBars incident={i} />
            {i.position ? <MiniMap position={i.position} type={i.type} label={`Position de l'incident : ${formatPosition(i.position)}`} /> : (
              <p className="rounded-lg border border-line p-3 text-sm">Position non transmise : l'utilisateur a désactivé le partage GPS.</p>
            )}
          </div>
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted">Source</dt>
              <dd>{i.source === 'camera' ? `Caméra${camera ? ` : ${camera.name}` : ''}` : 'Application utilisateur'}</dd>
              <dt className="text-muted">Position</dt>
              <dd className="font-mono text-xs">{i.position ? formatPosition(i.position) : '—'}</dd>
              <dt className="text-muted">Détecté</dt>
              <dd>{dateTime(i.createdAt)}</dd>
              <dt className="text-muted">Reçu</dt>
              <dd>{clockTime(i.receivedAt)}</dd>
              <dt className="text-muted">Prise en charge</dt>
              <dd>{i.takenAt ? `${clockTime(i.takenAt)} (délai ${formatDuration((+new Date(i.takenAt) - +new Date(i.receivedAt)) / 1000)})` : '—'}</dd>
              <dt className="text-muted">Clôturé</dt>
              <dd>{i.closedAt ? clockTime(i.closedAt) : '—'}</dd>
              <dt className="text-muted">Assigné à</dt>
              <dd>{i.assignedTo ?? 'Personne'}</dd>
            </dl>

            {i.status === 'nouveau' && <button className="btn btn-primary w-full" onClick={() => void incidentsApi.setStatus(i.id, 'en_cours', user)}>Prendre en charge</button>}
            {i.status === 'en_cours' && <button className="btn btn-primary w-full" onClick={() => onRequestClose(i)}>Clôturer…</button>}
            {i.status === 'cloture' && <button className="btn w-full" onClick={() => void incidentsApi.setStatus(i.id, 'nouveau', user)}>Rouvrir l'incident</button>}

            <section aria-labelledby="near">
              <h3 id="near" className="mb-1 text-sm font-bold">Incidents proches (± 10 min ou ≤ 300 m)</h3>
              {near.length === 0 ? <p className="text-sm text-muted">Aucun.</p> : (
                <ul className="space-y-1">
                  {near.map((n) => (
                    <li key={n.id}><button className="btn !min-h-11 w-full !justify-start text-left text-sm" onClick={() => onOpen(n.id)}>{TYPE_LABEL[n.type]} · {hourMinute(n.createdAt)} <StatusBadge status={n.status} /></button></li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="hist">
              <h3 id="hist" className="mb-1 text-sm font-bold">Historique des actions</h3>
              <ol className="space-y-1 text-sm">
                {history.map((l) => (
                  <li key={l.id} className="flex gap-2"><span className="font-mono text-xs text-muted">{clockTime(l.at)}</span><span>{l.action} <span className="text-muted">— {l.actor}</span></span></li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </article>
  )
}
