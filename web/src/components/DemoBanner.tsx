import { isMock } from '../services'

export function DemoBanner() {
  if (!isMock) {
    return (
      <div className="bg-emerald-700 px-3 py-1 text-center text-xs font-semibold text-white" role="note">
        Mode connecté : backend FastAPI et Firestore réels
      </div>
    )
  }
  return (
    <div className="bg-brand-600 px-3 py-1 text-center text-xs font-semibold text-white" role="note">
      Version démo : données simulées
    </div>
  )
}
