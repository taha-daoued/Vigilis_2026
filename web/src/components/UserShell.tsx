import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { startDataSync } from '../stores/data'
import { useSession } from '../stores/session'
import { DemoBanner } from './DemoBanner'
import { RoleSwitcher, TourButton } from './RoleSwitcher'

const tabs = [
  { to: '/app', label: 'SOS', end: true },
  { to: '/app/alertes', label: 'Alertes' },
  { to: '/app/carte', label: 'Carte' },
  { to: '/app/confidentialite', label: 'Vie privée' },
  { to: '/app/contacts', label: 'Contacts' },
]

export function UserShell() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  useEffect(() => { startDataSync() }, [])

  return (
    <div className="min-h-full bg-bg text-ink">
      <DemoBanner />
      <div className="mx-auto flex min-h-[calc(100%-1.75rem)] max-w-md flex-col px-4 pb-24">
        <header className="flex flex-wrap items-center justify-between gap-2 py-3">
          <p className="font-bold">{user?.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            <RoleSwitcher />
            <TourButton />
            <button className="btn text-sm" onClick={() => { logout(); navigate('/') }}>Déconnexion</button>
          </div>
        </header>
        <main className="flex-1"><Outlet /></main>
      </div>
      <nav aria-label="Navigation de l'application" className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface">
        <ul className="mx-auto flex max-w-md">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink to={t.to} end={t.end} className={({ isActive }) => `flex min-h-14 items-center justify-center px-1 text-center text-sm font-semibold ${isActive ? 'border-t-4 border-brand-600 text-brand-600' : 'border-t-4 border-transparent text-muted'}`}>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
