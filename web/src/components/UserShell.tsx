import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { startDataSync } from '../stores/data'
import { useSession } from '../stores/session'
import { DemoBanner } from './DemoBanner'

export function UserShell() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    startDataSync()
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <div className="min-h-full bg-bg text-ink">
      <DemoBanner />
      <div className="mx-auto flex min-h-[calc(100%-1.75rem)] max-w-md flex-col px-4 pb-8">
        <header className="flex items-center justify-between gap-2 py-3">
          <div>
            <p className="font-bold">{user?.name}</p>
            <p className="text-xs text-muted">{online ? 'Connexion : en ligne' : 'Connexion : hors ligne (démo disponible)'}</p>
          </div>
          <div className="flex gap-2">
            {user?.role === 'admin' && <Link className="btn" to="/admin">Admin</Link>}
            <button className="btn" onClick={() => { logout(); navigate('/') }}>Déconnexion</button>
          </div>
        </header>
        <main className="flex-1"><Outlet /></main>
      </div>
    </div>
  )
}
