import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { incidentsApi } from '../services'
import { TYPE_LABEL } from '../lib/format'
import { onIncidentArrival, startDataSync } from '../stores/data'
import { useSession } from '../stores/session'
import { useToasts } from '../stores/toasts'
import { DemoBanner } from './DemoBanner'
import { Toaster } from './Toaster'

/** Bip court (optionnel) via Web Audio : aucune ressource externe. */
function beep(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    osc.frequency.value = 880
    osc.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    /* audio indisponible */
  }
}

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/detection', label: 'Détection' },
  { to: '/admin/evaluation', label: 'Performance et conformité' },
  { to: '/admin/audit', label: "Journal d'audit" },
]

export function AdminShell() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const push = useToasts((s) => s.push)
  const [sound, setSound] = useState(() => localStorage.getItem('vigilis.sound') === '1')

  useEffect(() => {
    startDataSync()
    return onIncidentArrival((inc) => {
      push(`Nouvel incident : ${TYPE_LABEL[inc.type]}`, inc.description)
      if (sound) beep()
    })
  }, [push, sound])

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    localStorage.setItem('vigilis.sound', next ? '1' : '0')
  }
  const reset = async () => {
    if (window.confirm('Réinitialiser la démo ? Les incidents et le journal reviennent aux données de départ.')) {
      await incidentsApi.reset()
      push('Démo réinitialisée', 'Données de départ restaurées.')
    }
  }

  return (
    <div className="theme-admin flex h-full flex-col bg-bg text-ink">
      <DemoBanner />
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-surface px-4 py-2">
        <span className="text-lg font-extrabold tracking-tight">Vigilis <span className="font-normal text-muted">Admin</span></span>
        <nav aria-label="Navigation administrateur" className="flex flex-wrap gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `btn !border-transparent ${isActive ? '!bg-brand-600 !text-white' : '!bg-transparent'}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="btn" onClick={toggleSound} aria-pressed={sound}>{sound ? 'Bip : activé' : 'Bip : désactivé'}</button>
          <button className="btn" onClick={reset}>Réinitialiser la démo</button>
          <span className="text-sm text-muted">{user?.name}</span>
          <button className="btn" onClick={() => { logout(); navigate('/') }}>Déconnexion</button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto"><Outlet /></main>
      <Toaster />
    </div>
  )
}
