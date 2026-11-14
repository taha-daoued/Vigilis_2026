import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DemoBanner } from '../components/DemoBanner'
import { TourButton } from '../components/RoleSwitcher'
import { tourAlreadySeen, useUi } from '../stores/ui'

const FLOW = ['Caméra', 'Analyse IA (pose + vidéo)', 'Moteur de décision', 'Alerte', 'Carte admin']

export function Home() {
  const openTour = useUi((s) => s.openTour)
  // Visite guidée proposée à la première visite ; relançable ensuite avec le bouton.
  useEffect(() => { if (!tourAlreadySeen()) openTour() }, [openTour])
  return (
    <div className="min-h-full bg-bg text-ink">
      <DemoBanner />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight">Vigilis</h1>
        <p className="mt-4 max-w-2xl text-lg">
          Vigilis détecte et signale en temps réel les situations à risque : violence, chute ou malaise, urgence médicale.
          Une caméra analysée par l'IA et un bouton SOS sur mobile alimentent une même carte de supervision.
          Le système détecte tôt et alerte vite ; il ne prédit pas.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/login" state={{ role: 'user' }} className="btn btn-primary">Espace utilisateur</Link>
          <Link to="/login" state={{ role: 'admin' }} className="btn">Espace administrateur</Link>
          <TourButton />
        </div>

        <section aria-labelledby="flux" className="mt-10">
          <h2 id="flux" className="text-xl font-bold">Comment ça circule</h2>
          <ol className="card mt-3 flex flex-wrap items-center gap-2 p-4">
            {FLOW.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-semibold">{step}</span>
                {i < FLOW.length - 1 && <span aria-hidden="true" className="text-muted">→</span>}
              </li>
            ))}
          </ol>
          <p className="card mt-2 p-3 text-sm">
            <strong>Voie directe :</strong> Bouton SOS (position GPS, sans IA) <span aria-hidden="true">→</span> Alerte <span aria-hidden="true">→</span> Carte admin.
          </p>
        </section>

        <section aria-labelledby="limites" className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h2 id="limites" className="text-lg font-bold">Ce que fait Vigilis</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Détecte la violence et les chutes sur un flux caméra.</li>
              <li>Transmet un SOS avec la position de l'utilisateur.</li>
              <li>Alerte l'administrateur sur une carte, avec un historique des actions.</li>
              <li>Limite les fausses alertes : seuil et plusieurs fenêtres consécutives.</li>
            </ul>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-bold">Ce qu'il ne fait pas</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Il ne prédit pas les situations à risque : il détecte et alerte.</li>
              <li>Il ne remplace pas les services d'urgence.</li>
              <li>La détection de vol est <strong>expérimentale</strong>.</li>
              <li>Aucune performance chiffrée n'est affichée : « À mesurer ».</li>
            </ul>
          </div>
        </section>

        <p className="card mt-6 p-4 text-sm">
          <strong>24/7 = architecture cible.</strong> La disponibilité continue est un objectif d'architecture, pas une garantie de cette démonstration.
        </p>
      </main>
    </div>
  )
}
