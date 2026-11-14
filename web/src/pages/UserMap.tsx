// Carte simple : ma position, et (si je l'active) les caméras autour de moi. Aucune image, aucune donnée sensible.
import L from 'leaflet'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { cameraIcon } from '../components/mapIcons'
import { Switch } from '../components/Switch'
import { usePosition } from '../lib/usePosition'
import { prefsApi } from '../services'
import { selectPrefs, useData } from '../stores/data'
import { useSession } from '../stores/session'

const meIcon = L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: '<div class="vg-cluster" style="width:30px;height:30px;background:#1d4ed8">Moi</div>' })

export function UserMap() {
  const user = useSession((s) => s.user)!
  const prefs = useData(selectPrefs(user.id))
  const cameras = useData((s) => s.cameras)
  const pos = usePosition(prefs.gpsConsent)

  return (
    <section aria-labelledby="carte" className="space-y-3">
      <h1 id="carte" className="text-xl font-bold">Carte</h1>
      <div className="h-[50vh] overflow-hidden rounded-xl border border-line">
        <MapContainer center={[pos.displayPosition.lat, pos.displayPosition.lng]} zoom={16} className="vg-map h-full w-full" aria-label="Carte autour de moi">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[pos.displayPosition.lat, pos.displayPosition.lng]} icon={meIcon} title="Ma position" alt="Ma position" />
          {prefs.shareCamerasOnMap && cameras.map((c) => <Marker key={c.id} position={[c.position.lat, c.position.lng]} icon={cameraIcon(c)} title={`Caméra : ${c.name}`} alt={`Caméra ${c.name}`} />)}
        </MapContainer>
      </div>
      <p className="text-xs text-muted">Position : {pos.source}. {pos.position === null ? 'Le partage GPS est désactivé : le point affiché est le centre simulé de la démo, pas votre position.' : ''}</p>
      <div className="card p-4">
        <Switch checked={prefs.shareCamerasOnMap} onChange={(v) => void prefsApi.update(user.id, { shareCamerasOnMap: v })} label="Afficher les caméras autour de moi" description="Seuls le nom et l'emplacement des caméras sont affichés, jamais d'image." />
      </div>
    </section>
  )
}
