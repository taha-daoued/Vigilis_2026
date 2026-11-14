// Garde de routes : les rôles sont réellement appliqués (un utilisateur ne peut pas ouvrir /admin).
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../services'
import { useSession } from '../stores/session'

export function RoleGuard({ allow }: { allow: Role[] }) {
  const user = useSession((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ message: 'Connectez-vous pour accéder à cet espace.', from: location.pathname }} />
  if (!allow.includes(user.role)) {
    return <Navigate to="/app" replace state={{ message: "Accès refusé : l'espace administrateur est réservé aux comptes admin." }} />
  }
  return <Outlet />
}
