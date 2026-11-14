// Visite guidée en 3 bulles. Relançable depuis le bouton « Visite guidée ».
import { useEffect, useRef, useState } from 'react'
import { useUi } from '../stores/ui'

const STEPS = [
  { title: '1. De la caméra à l\'IA', flow: ['Caméra', 'Analyse IA (pose + vidéo)'], text: "Une caméra filme ; le service IA repère les personnes et analyse le mouvement. En V1, tout est simulé dans le navigateur." },
  { title: '2. De la décision à la carte', flow: ['Moteur de décision', 'Alerte', 'Carte admin'], text: "Une alerte n'est émise que si le score dépasse le seuil sur plusieurs fenêtres consécutives. L'administrateur la voit sur la carte et la traite. Vigilis détecte et alerte, il ne prédit pas." },
  { title: '3. La voie directe du SOS', flow: ['Bouton SOS', 'Alerte', 'Carte admin'], text: "Le SOS ne passe pas par l'IA : l'utilisateur maintient le bouton, sa position part directement vers la file de priorité, en tête des détections." },
]

export function Tour() {
  const { tourOpen, closeTour } = useUi()
  const ref = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (tourOpen && !dlg.open) {
      setStep(0)
      dlg.showModal()
    } else if (!tourOpen && dlg.open) dlg.close()
  }, [tourOpen])

  const s = STEPS[step]
  return (
    <dialog ref={ref} aria-labelledby="tour-title" onCancel={(e) => { e.preventDefault(); closeTour() }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/60">
      <div className="space-y-4 p-5">
        <p className="text-xs font-semibold text-muted">Visite guidée · étape {step + 1} sur {STEPS.length}</p>
        <h2 id="tour-title" className="text-lg font-bold">{s.title}</h2>
        <ol className="flex flex-wrap items-center gap-2" aria-label="Schéma">
          {s.flow.map((f, k) => (
            <li key={f} className="flex items-center gap-2"><span className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-semibold">{f}</span>{k < s.flow.length - 1 && <span aria-hidden="true">→</span>}</li>
          ))}
        </ol>
        <p className="text-sm">{s.text}</p>
        <div className="flex items-center justify-between gap-2">
          <button className="btn" onClick={closeTour}>Fermer</button>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setStep((n) => n - 1)} disabled={step === 0}>Précédent</button>
            {step < STEPS.length - 1 ? <button className="btn btn-primary" onClick={() => setStep((n) => n + 1)}>Suivant</button> : <button className="btn btn-primary" onClick={closeTour}>Terminer</button>}
          </div>
        </div>
      </div>
    </dialog>
  )
}
