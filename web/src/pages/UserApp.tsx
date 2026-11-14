import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { StatusBadge } from '../components/badges'
import { DEMO_CENTER, formatPosition } from '../lib/geo'
import { USER_STATUS_LABEL, dateTime, relativeTime } from '../lib/format'
import { sosApi } from '../services'
import type { IncidentStatus, LatLng } from '../services'
import { useData } from '../stores/data'
import { useSession } from '../stores/session'

const HOLD_MS = 1500
const CONSENT_KEY = 'vigilis.gpsConsent'
const SIM_SOURCE = 'simulée (centre de la démo)'

/** Appui long avec progression : évite les déclenchements accidentels. */
function useHold(onComplete: () => void) {
  const [progress, setProgress] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setProgress(0)
  }, [])
  const begin = useCallback(() => {
    if (timer.current) return
    const startedAt = performance.now()
    timer.current = setInterval(() => {
      const p = Math.min(1, (performance.now() - startedAt) / HOLD_MS)
      setProgress(p)
      if (p >= 1) {
        stop()
        onComplete()
      }
    }, 40)
  }, [onComplete, stop])
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  return { progress, begin, stop }
}

function SosButton({ onTrigger }: { onTrigger: () => void }) {
  const { progress, begin, stop } = useHold(onTrigger)
  const R = 96
  const C = 2 * Math.PI * R
  return (
    <div className="flex flex-col items-center">
      <button
        aria-label="Bouton SOS : maintenir appuyé 1,5 seconde pour envoyer l'alerte"
        className="relative grid h-56 w-56 touch-none select-none place-items-center rounded-full focus-visible:outline-offset-4"
        onPointerDown={begin}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin() } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop() }}
      >
        <svg viewBox="0 0 220 220" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle cx="110" cy="110" r={R} fill="none" stroke="#b91c1c" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <span className="grid h-44 w-44 place-items-center rounded-full bg-[#b91c1c] text-5xl font-black tracking-wide text-white shadow-lg">SOS</span>
      </button>
      <p className="mt-3 text-center text-sm font-semibold">Maintenez 1,5 s pour envoyer l'alerte</p>
      <p className="text-center text-xs text-muted" aria-live="polite">{progress > 0 ? `Envoi dans ${((1 - progress) * HOLD_MS / 1000).toFixed(1)} s…` : 'Appui long (ou touche Espace maintenue)'}</p>
    </div>
  )
}

const STEPS: IncidentStatus[] = ['nouveau', 'en_cours', 'cloture']
function StatusTracker({ status }: { status: IncidentStatus }) {
  const current = STEPS.indexOf(status)
  return (
    <ol className="flex items-center gap-2" aria-label="Suivi de l'alerte">
      {STEPS.map((s, i) => (
        <li key={s} className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold ${i <= current ? 'border-ok text-ok' : 'border-line text-muted'}`} aria-current={i === current ? 'step' : undefined}>
          <span aria-hidden="true">{i < current ? '✓' : i === current ? '●' : '○'}</span> {USER_STATUS_LABEL[s]}
        </li>
      ))}
    </ol>
  )
}

export function UserApp() {
  const user = useSession((s) => s.user)!
  const location = useLocation()
  const banner = (location.state as { message?: string } | null)?.message
  const incidents = useData((s) => s.incidents)
  const [consent, setConsent] = useState<string | null>(() => localStorage.getItem(CONSENT_KEY))
  const [pos, setPos] = useState<{ position: LatLng; source: string }>({ position: DEMO_CENTER, source: SIM_SOURCE })
  const [geoMessage, setGeoMessage] = useState<string | null>(() =>
    'geolocation' in navigator ? null : 'Géolocalisation indisponible sur cet appareil : position simulée utilisée.',
  )
  const [lastId, setLastId] = useState<string | null>(null)

  const requestGps = useCallback(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ position: { lat: p.coords.latitude, lng: p.coords.longitude }, source: 'GPS réel (appareil)' }); setGeoMessage(null) },
      () => setGeoMessage("Position refusée ou indisponible (HTTPS requis) : la position simulée de la démo est utilisée."),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])

  useEffect(() => { if (consent === 'granted') requestGps() }, [consent, requestGps])

  const answer = (v: 'granted' | 'declined') => {
    localStorage.setItem(CONSENT_KEY, v)
    setConsent(v)
    if (v === 'declined') setGeoMessage('Partage refusé : position simulée de la démo utilisée.')
  }

  const mine = incidents.filter((i) => i.userId === user.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  const last = mine.find((i) => i.id === lastId)

  const send = useCallback(async () => {
    const inc = await sosApi.send(user, pos.position, pos.source)
    setLastId(inc.id)
  }, [user, pos])

  return (
    <div className="space-y-5">
      {banner && <p role="alert" className="rounded-lg border border-danger p-3 text-sm font-semibold text-danger">{banner}</p>}

      <section className="card p-3 text-sm" aria-label="État de la localisation">
        <p><strong>Localisation :</strong> {pos.source}</p>
        <p className="font-mono text-xs text-muted">{formatPosition(pos.position)}</p>
        {geoMessage && <p role="status" className="mt-1 text-xs text-warn">{geoMessage}</p>}
      </section>

      {consent === null && (
        <section className="card space-y-3 border-brand-600 p-4" aria-labelledby="consent">
          <h2 id="consent" className="font-bold">Partager ma position ?</h2>
          <p className="text-sm">Votre position GPS est envoyée uniquement quand vous déclenchez un SOS. Elle n'est pas enregistrée en continu. Vous pouvez refuser : une position simulée sera alors utilisée dans cette démo.</p>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => answer('granted')}>Autoriser</button>
            <button className="btn flex-1" onClick={() => answer('declined')}>Refuser</button>
          </div>
        </section>
      )}

      {last ? (
        <section className="card space-y-3 p-4 text-center" aria-live="polite" aria-labelledby="sent">
          <h2 id="sent" className="text-xl font-extrabold">Alerte envoyée</h2>
          <p className="text-sm">Votre position a été transmise à l'équipe de supervision, sans passer par l'IA.</p>
          <StatusTracker status={last.status} />
          <button className="btn w-full" onClick={() => setLastId(null)}>Revenir au bouton SOS</button>
        </section>
      ) : (
        <SosButton onTrigger={send} />
      )}

      <p className="rounded-lg border border-line bg-surface-2 p-3 text-sm font-semibold">
        Appelez les secours locaux en cas de danger immédiat. Vigilis ne remplace pas les services d'urgence.
      </p>

      <section aria-labelledby="mes" className="card">
        <h2 id="mes" className="p-3 font-bold">Mes alertes</h2>
        {mine.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted">Aucune alerte envoyée pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-line">
            {mine.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span><span className="font-semibold">SOS</span> · {dateTime(i.createdAt)}<br /><span className="text-xs text-muted">{relativeTime(i.createdAt)}</span></span>
                <StatusBadge status={i.status} label={USER_STATUS_LABEL[i.status]} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
