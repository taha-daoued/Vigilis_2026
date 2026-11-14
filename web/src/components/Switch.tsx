/** Interrupteur accessible (role="switch"), cible tactile ≥ 44 px, état écrit en toutes lettres. */
export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-semibold">{label}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="btn !min-w-24 shrink-0">
        {checked ? '● Activé' : '○ Désactivé'}
      </button>
    </div>
  )
}
