// Santé du système : caméras, services (simulés) et latence de bout en bout comparée à l'objectif de 3 s.
import { memo } from 'react'
import { SimulatedBadge } from '../components/badges'
import { relativeTime, simulatedFrameAge } from '../lib/format'
import { useNow } from '../lib/useNow'
import { incidentsApi, isMock } from '../services'
import type { Camera, ServiceState } from '../services'
import { useData } from '../stores/data'
import { useSession } from '../stores/session'
import { useToasts } from '../stores/toasts'

const OBJECTIVE_MS = 3000
const GAUGE_MAX_MS = 4000
const STATE: Record<ServiceState, { icon: string; label: string; cls: string }> = {
  actif: { icon: '●', label: 'Actif', cls: 'text-ok' },
  degrade: { icon: '⚠', label: 'Dégradé', cls: 'text-warn' },
  inactif: { icon: '✕', label: 'Inactif', cls: 'text-danger' },
}

const CameraCard = memo(function CameraCard({ cam }: { cam: Camera }) {
  const now = useNow()
  const frame = cam.online ? `il y a ${simulatedFrameAge(cam.id, now)} s (simulé)` : relativeTime(cam.lastFrameAt, now)
  return (
    <li className="card space-y-1 p-3">
      <p className="flex items-center justify-between gap-2 font-bold">{cam.name}
        <span className={`text-sm ${cam.online ? 'text-ok' : 'text-danger'}`}>{cam.online ? '● En ligne' : '⊘ Hors ligne'}</span>
      </p>
      <p className="text-sm"><span className="text-muted">Dernière image :</span> {frame}</p>
      <p className="text-sm"><span className="text-muted">Incidents du jour :</span> {cam.incidentsToday}</p>
      {cam.simulatedOutage && <p className="text-xs font-semibold text-warn">⚠ Panne simulée (démo)</p>}
    </li>
  )
})

function ServiceCard({ label, state }: { label: string; state: ServiceState }) {
  const s = STATE[state]
  return (
    <li className="card flex items-center justify-between gap-2 p-3">
      <span className="font-semibold">{label}</span>
      <span className={`flex items-center gap-2 text-sm font-bold ${s.cls}`}><span aria-hidden="true">{s.icon}</span>{s.label} <SimulatedBadge /></span>
    </li>
  )
}

export function AdminHealth() {
  const { cameras, health, ready } = useData()
  const user = useSession((s) => s.user)!
  const push = useToasts((s) => s.push)
  if (!ready || !health) return <p className="p-6 text-muted">Chargement…</p>

  const ms = health.lastLatencyMs
  const under = ms !== null && ms < OBJECTIVE_MS
  const hasOutage = cameras.some((c) => c.simulatedOutage)

  const outage = async () => {
    const cam = await incidentsApi.simulateCameraOutage(user)
    push(cam ? `Panne simulée : ${cam.name}` : 'Aucune caméra en ligne à mettre en panne')
  }
  const restore = async () => {
    const n = await incidentsApi.restoreCameras(user)
    push(n ? `${n} caméra(s) rétablie(s)` : 'Aucune panne simulée à rétablir')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold">Santé du système</h1>
        <p className="text-sm text-muted">24/7 = architecture cible, pas une garantie de cette démonstration. Les indicateurs ci-dessous sont simulés.</p>
      </div>

      <section aria-labelledby="cams">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 id="cams" className="font-bold">Caméras</h2>
          <div className={`ml-auto flex gap-2 ${isMock ? '' : 'hidden'}`} role="group" aria-label="Démo : panne caméra">
            <button className="btn" onClick={() => void outage()}>Simuler une panne caméra</button>
            <button className="btn" onClick={() => void restore()} disabled={!hasOutage} title={hasOutage ? undefined : 'Aucune panne simulée en cours'}>Rétablir</button>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cameras.map((c) => <CameraCard key={c.id} cam={c} />)}</ul>
      </section>

      <section aria-labelledby="svc">
        <h2 id="svc" className="mb-2 font-bold">Services</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          <ServiceCard label="Service IA" state={health.aiService} />
          <ServiceCard label="API" state={health.api} />
          <ServiceCard label="Connexion temps réel" state={health.realtime} />
        </ul>
      </section>

      <section aria-labelledby="lat" className="card space-y-3 p-4">
        <h2 id="lat" className="flex flex-wrap items-center gap-2 font-bold">Latence de bout en bout du dernier incident <SimulatedBadge /></h2>
        <p className="text-3xl font-extrabold">{ms === null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`}
          <span className={`ml-3 text-base font-bold ${under ? 'text-ok' : 'text-warn'}`}>{ms === null ? '' : under ? '✓ Sous l\'objectif' : '⚠ Au-dessus de l\'objectif'}</span>
        </p>
        <div className="relative h-3 rounded bg-surface-2" role="img" aria-label={`Latence ${ms ?? 'inconnue'} millisecondes, objectif inférieur à 3 secondes`}>
          <div className="h-3 rounded bg-brand-500" style={{ width: `${Math.min(100, ((ms ?? 0) / GAUGE_MAX_MS) * 100)}%` }} />
          <div className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: `${(OBJECTIVE_MS / GAUGE_MAX_MS) * 100}%` }} aria-hidden="true" />
        </div>
        <p className="text-xs text-muted">Repère : objectif {'<'} 3 s. Objectif, pas une mesure garantie : la vraie latence sera mesurée avec le service IA.</p>
      </section>
    </div>
  )
}
