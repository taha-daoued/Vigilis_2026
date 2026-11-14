import { ExperimentalBadge } from '../components/badges'

const INDICATORS: [string, string][] = [
  ['Précision', 'À mesurer'],
  ['Rappel', 'À mesurer'],
  ['F1', 'À mesurer'],
  ['Faux positifs par heure', 'À mesurer'],
  ['Latence de bout en bout (événement filmé → alerte affichée)', 'Objectif < 3 s (à mesurer)'],
]

const PRIVACY: [string, string][] = [
  ['HTTPS', 'Prévu V2 (fourni par l\'hébergement ; requis pour la géolocalisation navigateur)'],
  ['Rôles utilisateur / admin', 'Simulé (garde de routes en V1, vérification serveur en V2)'],
  ['Floutage des visages', 'Simulé (vignettes SVG avec visages floutés, aucune vraie image)'],
  ["Journal d'audit", 'Simulé (alimenté par les actions de la démo)'],
  ['Durée de conservation limitée', 'Prévu V2'],
  ['Consentement GPS', 'Simulé (consentement demandé avant toute demande de position)'],
]

export function AdminEvaluation() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-xl font-bold">Performance et conformité</h1>

      <section aria-labelledby="perf" className="card overflow-x-auto">
        <h2 id="perf" className="p-3 font-bold">Indicateurs prévus</h2>
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted"><tr><th scope="col" className="p-3">Indicateur</th><th scope="col" className="p-3">Valeur</th></tr></thead>
          <tbody className="divide-y divide-line">
            {INDICATORS.map(([k, v]) => <tr key={k}><td className="p-3">{k}</td><td className="p-3 font-semibold">{v}</td></tr>)}
          </tbody>
        </table>
        <p className="p-3 text-xs text-muted">Aucun chiffre n'est affiché tant qu'il n'a pas été mesuré sur un jeu de test verrouillé et sur des vidéos filmées par l'équipe.</p>
      </section>

      <section aria-labelledby="priv" className="card overflow-x-auto">
        <h2 id="priv" className="p-3 font-bold">Sécurité et vie privée</h2>
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted"><tr><th scope="col" className="p-3">Mesure</th><th scope="col" className="p-3">Statut réel en V1</th></tr></thead>
          <tbody className="divide-y divide-line">
            {PRIVACY.map(([k, v]) => <tr key={k}><td className="p-3 font-semibold">{k}</td><td className="p-3">{v}</td></tr>)}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="perim" className="card p-4">
        <h2 id="perim" className="font-bold">Périmètre</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>MVP : détection de violence, détection de chute / malaise, bouton SOS.</li>
          <li>Vol : module <ExperimentalBadge /> sans promesse de score.</li>
          <li>Le système détecte tôt et alerte vite ; il ne prédit pas.</li>
          <li>24/7 : architecture cible, pas une garantie.</li>
        </ul>
      </section>
    </div>
  )
}
