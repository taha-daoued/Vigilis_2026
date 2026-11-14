// Accueil utilisateur : un seul objectif, le bouton SOS (appui long 1,5 s), et une ligne d'état.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTimeline } from '../components/AlertTimeline'
import { formatPosition } from '../lib/geo'
import { useOnline } from '../lib/useOnline'
import { usePosition } from '../lib/usePosition'
import { prefsApi, sosApi } from '../services'
import { selectPrefs, useData } from '../stores/data'
import { useSession } from '../stores/session'

const HOLD_MS = 1500

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
        className="relative grid aspect-square w-[min(80vw,20rem)] touch-none select-none place-items-center rounded-full focus-visible:outline-offset-4"
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
        <span className="grid size-[80%] place-items-center rounded-full bg-[#b91c1c] text-6xl font-black tracking-wide text-white shadow-lg">SOS</span>
      </button>
      <p className="mt-3 text-center text-sm font-semibold">Maintenez 1,5 s pour envoyer l'alerte</p>
      <p className="text-center text-xs text-muted" aria-live="polite">{progress > 0 ? `Envoi dans ${((1 - progress) * HOLD_MS / 1000).toFixed(1)} s…` : 'Appui long (ou touche Espace maintenue)'}</p>
    </div>
  )
}

function StatePill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <li className={`rounded-full border px-3 py-1 text-xs font-bold ${ok ? 'border-ok text-ok' : 'border-line text-muted'}`}><span aria-hidden="true">{ok ? '● ' : '○ '}</span>{children}</li>
}

export function UserHome() {
  const user = useSession((s) => s.user)!
  const banner = (useLocation().state as { message?: string } | null)?.message
  const { incidents } = useData()
  const prefs = useData(selectPrefs(user.id))
  const online = useOnline()
  const pos = usePosition(prefs.gpsConsent)
  const [lastId, setLastId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)

  const mine = incidents.filter((i) => i.userId === user.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  const open = mine.filter((i) => i.status !== 'cloture')
  const tracked = mine.find((i) => i.id === lastId) ?? open[0]
  const showTracked = tracked && tracked.id !== dismissed

  const send = useCallback(async () => {
    const inc = await sosApi.send(user, pos.position, pos.source)
    setLastId(inc.id)
    setDismissed(null)
  }, [user, pos.position, pos.source])

  return (
    <div className="space-y-5">
      {banner && <p role="alert" className="rounded-lg border border-danger p-3 text-sm font-semibold text-danger">{banner}</p>}

      {prefs.gpsConsent === null && (
        <section className="card space-y-3 border-brand-600 p-4" aria-labelledby="consent">
          <h2 id="consent" className="font-bold">Partager ma position ?</h2>
          <p className="text-sm">Votre position GPS est envoyée uniquement quand vous déclenchez un SOS, jamais en continu. Vous pouvez changer d'avis à tout moment dans « Vie privée ». Sans partage, le SOS part sans position.</p>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => void prefsApi.update(user.id, { gpsConsent: true })}>Autoriser</button>
            <button className="btn flex-1" onClick={() => void prefsApi.update(user.id, { gpsConsent: false })}>Refuser</button>
          </div>
        </section>
      )}

      <SosButton onTrigger={send} />

      <ul className="flex flex-wrap justify-center gap-2" aria-label="État">
        <StatePill ok={prefs.gpsConsent === true}>{prefs.gpsConsent === true ? 'Position active' : 'Position non partagée'}</StatePill>
        <StatePill ok={online}>{online ? 'Connecté' : 'Hors ligne'}</StatePill>
        <StatePill ok={open.length === 0}>{open.length === 0 ? 'Aucune alerte en cours' : `${open.length} alerte${open.length > 1 ? 's' : ''} en cours`}</StatePill>
      </ul>
      <p className="text-center text-xs text-muted">
        {pos.position ? <>Position : {pos.source} · <span className="font-mono">{formatPosition(pos.position)}</span></> : pos.message}
      </p>
      {pos.position && pos.message && <p role="status" className="text-center text-xs text-warn">{pos.message}</p>}

      {showTracked && (
        <section className="card space-y-3 p-4" aria-labelledby="suivi" aria-live="polite">
          <h2 id="suivi" className="font-bold">{tracked.id === lastId ? 'Alerte envoyée' : 'Suivi de votre alerte'}</h2>
          <AlertTimeline incident={tracked} />
          {tracked.status === 'cloture' && <button className="btn w-full" onClick={() => setDismissed(tracked.id)}>Masquer</button>}
        </section>
      )}

      <p className="rounded-lg border border-line bg-surface-2 p-3 text-sm font-semibold">
        Appelez les secours locaux en cas de danger immédiat. Vigilis ne remplace pas les services d'urgence.
      </p>
    </div>
  )
}
