// Mini-carte non interactive : position d'un incident ou de l'utilisateur.
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import type { LatLng } from '../services'
import { markerIcon } from './mapIcons'
import type { IncidentType } from '../services'

export function MiniMap({ position, type, label }: { position: LatLng; type: IncidentType; label: string }) {
  return (
    <MapContainer
      center={[position.lat, position.lng]}
      zoom={16}
      className="vg-map h-40 w-full rounded-lg"
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      keyboard={false}
      aria-label={label}
    >
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[position.lat, position.lng]} icon={markerIcon(type, false, false)} interactive={false} />
    </MapContainer>
  )
}
