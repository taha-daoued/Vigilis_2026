// Centre de confidentialité : consentement GPS visible et révocable, ce qui est partagé, conservation indicative.
import { Link } from 'react-router-dom'
import { SimulatedBadge } from '../components/badges'
import { Switch } from '../components/Switch'
import { prefsApi } from '../services'
import { selectPrefs, useData } from '../stores/data'
import { useSession } from '../stores/session'

export function UserPrivacy() {
  const user = useSession((s) => s.user)!
  const prefs = useData(selectPrefs(user.id))

  return (
    <section aria-labelledby="priv" className="space-y-4">
      <h1 id="priv" className="text-xl font-bold">Vie privée</h1>

      <div className="card space-y-2 p-4">
        <Switch checked={prefs.gpsConsent === true} onChange={(v) => void prefsApi.update(user.id, { gpsConsent: v })} label="Partager ma position avec Vigilis" description="Consentement révocable à tout moment." />
        {prefs.gpsConsent !== true && <p role="status" className="rounded-lg border border-line p-3 text-sm">Le SOS reste utilisable : il sera envoyé <strong>sans position</strong>. L'équipe sera prévenue, mais ne saura pas où vous êtes.</p>}
      </div>

      <div className="card space-y-2 p-4">
        <h2 className="font-bold">Ce qui est partagé, et avec qui</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><strong>Position GPS</strong> : envoyée uniquement quand vous déclenchez un SOS, visible par l'équipe de supervision (administrateurs).</li>
          <li><strong>Aucune image ni vidéo</strong> n'est collectée depuis votre téléphone.</li>
          <li><strong>Caméras sur la carte</strong> : noms et emplacements seulement, si vous activez l'option.</li>
        </ul>
      </div>

      <div className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 font-bold">Durée de conservation <SimulatedBadge /></h2>
        <p className="text-sm">Indicatif : vos alertes seraient conservées <strong>{prefs.retentionDays} jours</strong>. Valeur simulée en V1, à définir avec le client.</p>
      </div>

      <Link to="/app/alertes" className="btn w-full">Voir mon historique d'alertes</Link>
    </section>
  )
}
