// Sélecteur de rôle de la démo : change de compte sans déconnexion manuelle. Les gardes de rôles restent appliquées.
import { useNavigate } from 'react-router-dom'
import type { Role } from '../services'
import { useSession } from '../stores/session'
import { useUi } from '../stores/ui'

export function RoleSwitcher() {
  const { user, loginAs } = useSession()
  const navigate = useNavigate()
  if (!user) return null
  const go = async (role: Role) => {
    if (role === user.role) return
    await loginAs(role)
    navigate(role === 'admin' ? '/admin' : '/app')
  }
  return (
    <div role="group" aria-label="Changer de vue (démo)" className="flex items-center gap-1 text-xs">
      <span className="text-muted">Vue démo :</span>
      {(['admin', 'user'] as Role[]).map((r) => (
        <button key={r} aria-pressed={user.role === r} onClick={() => void go(r)} className={`btn !px-2 text-sm ${user.role === r ? '!bg-brand-600 !text-white' : ''}`}>
          {r === 'admin' ? 'Admin' : 'Utilisateur'}
        </button>
      ))}
    </div>
  )
}

export function TourButton() {
  const openTour = useUi((s) => s.openTour)
  return <button className="btn text-sm" onClick={openTour}>Visite guidée</button>
}
