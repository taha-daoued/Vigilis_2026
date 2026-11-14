import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { startSimulator } from '../lib/simulator'
import { incidentsApi } from '../services'
import { TYPE_LABEL } from '../lib/format'
import { onIncidentArrival, startDataSync, useData } from '../stores/data'
import { useSession } from '../stores/session'
import { useToasts } from '../stores/toasts'
import { useUi } from '../stores/ui'
import { DemoBanner } from './DemoBanner'
import { RoleSwitcher, TourButton } from './RoleSwitcher'
import { Toaster } from './Toaster'

/** Bip court (Web Audio). Le contexte audio n'est créé qu'après un clic de l'utilisateur. */
let audio: AudioContext | null = null
function unlockAudio(): void {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    /* audio indisponible */
  }
}
function beep(): void {
  if (!audio) return
  const osc = audio.createOscillator()
  osc.frequency.value = 880
  osc.connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.18)
}

const links = [
  { to: '/admin', label: 'Centre de commande', end: true },
  { to: '/admin/health', label: 'Santé' },
  { to: '/admin/stats', label: 'Statistiques' },
  { to: '/admin/detection', label: 'Détection' },
  { to: '/admin/evaluation', label: 'Performance et conformité' },
  { to: '/admin/audit', label: "Journal d'activité" },
]

function SoundToggle() {
  const { soundOn, setSound } = useUi()
  return (
    <button className="btn" aria-pressed={soundOn} onClick={() => { if (!soundOn) unlockAudio(); setSound(!soundOn) }}
      title="Son uniquement pour les SOS et les alertes de violence">
      {soundOn ? '🔊 Son : activé' : '🔇 Son : muet'}
    </button>
  )
}

export function AdminShell() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const push = useToasts((s) => s.push)
  const { supervision, setSupervision, soundOn, simRunning, resetUi } = useUi()
  const soundRef = useRef(soundOn)
  useEffect(() => { soundRef.current = soundOn }, [soundOn])

  useEffect(() => {
    startDataSync()
    return onIncidentArrival((inc) => {
      push(`Nouvel incident : ${TYPE_LABEL[inc.type]}`, inc.description)
      // Son réservé aux SOS et à la violence, et seulement si l'utilisateur l'a activé.
      if (soundRef.current && (inc.type === 'sos' || inc.type === 'violence')) beep()
    })
  }, [push])

  // Simulateur : un seul, dans le shell, arrêté proprement à la déconnexion
  useEffect(() => (simRunning ? startSimulator(() => useData.getState().cameras) : undefined), [simRunning])

  // Mode supervision : plein écran + texte agrandi ; Échap (sortie du plein écran) quitte le mode
  useEffect(() => {
    if (!supervision) return
    document.documentElement.style.fontSize = '125%'
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
    const onChange = () => { if (!document.fullscreenElement) setSupervision(false) }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.documentElement.style.fontSize = ''
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
  }, [supervision, setSupervision])

  const reset = async () => {
    if (window.confirm('Réinitialiser la démo ? Incidents, pannes simulées, résolutions et préférences reviennent aux valeurs de départ.')) {
      await incidentsApi.reset(user ?? undefined)
      resetUi()
      push('Démo réinitialisée', 'Données de départ restaurées.')
    }
  }

  return (
    <div className="theme-admin flex h-full flex-col bg-bg text-ink">
      <DemoBanner />
      {supervision ? (
        <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
          <span className="font-extrabold">Vigilis · Salle de supervision</span>
          <div className="ml-auto flex items-center gap-2">
            <SoundToggle />
            <button className="btn" onClick={() => setSupervision(false)}>Quitter le mode supervision</button>
          </div>
        </div>
      ) : (
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2">
          <span className="text-lg font-extrabold tracking-tight">Vigilis <span className="font-normal text-muted">Admin</span></span>
          <nav aria-label="Navigation administrateur" className="flex flex-wrap gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `btn !border-transparent ${isActive ? '!bg-brand-600 !text-white' : '!bg-transparent'}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <RoleSwitcher />
            <TourButton />
            <SoundToggle />
            <button className="btn" onClick={() => { navigate('/admin'); setSupervision(true) }}>Mode supervision</button>
            <button className="btn" onClick={reset}>Réinitialiser la démo</button>
            <span className="text-sm text-muted">{user?.name}</span>
            <button className="btn" onClick={() => { logout(); navigate('/') }}>Déconnexion</button>
          </div>
        </header>
      )}
      <main className="min-h-0 flex-1 overflow-auto"><Outlet /></main>
      <Toaster />
    </div>
  )
}
