// Dialogue de clôture : la résolution (Confirmé / Fausse alerte) est obligatoire.
// Utilise <dialog> natif : focus piégé, Échap = annuler, focus rendu au bouton d'origine.
import { useEffect, useRef, useState } from 'react'
import { RESOLUTION_LABEL, TYPE_LABEL } from '../lib/format'
import type { Incident, Resolution } from '../services'

interface Props {
  incident: Incident | null
  onCancel: () => void
  onConfirm: (resolution: Resolution) => void
}

export function ResolutionDialog({ incident, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [choice, setChoice] = useState<Resolution | null>(null)

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (incident && !dlg.open) {
      setChoice(null)
      dlg.showModal()
    } else if (!incident && dlg.open) dlg.close()
  }, [incident])

  return (
    <dialog
      ref={ref}
      aria-labelledby="res-title"
      onCancel={(e) => { e.preventDefault(); onCancel() }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      {incident && (
        <form
          method="dialog"
          onSubmit={(e) => { e.preventDefault(); if (choice) onConfirm(choice) }}
          className="space-y-4 p-5"
        >
          <h2 id="res-title" className="text-lg font-bold">Clôturer l'incident</h2>
          <p className="text-sm text-muted">{TYPE_LABEL[incident.type]} : {incident.description}</p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Quel est le résultat ? (obligatoire)</legend>
            {(['confirme', 'fausse_alerte'] as Resolution[]).map((r) => (
              <label key={r} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 ${choice === r ? 'border-brand-300 bg-surface-2' : 'border-line'}`}>
                <input type="radio" name="resolution" value={r} checked={choice === r} onChange={() => setChoice(r)} className="size-5" />
                <span>
                  <span className="font-semibold">{RESOLUTION_LABEL[r]}</span>
                  <span className="block text-xs text-muted">{r === 'confirme' ? 'La situation était réelle.' : "Aucune situation à risque constatée (compte dans la part de fausses alertes)."}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={!choice}>Clôturer</button>
          </div>
        </form>
      )}
    </dialog>
  )
}
