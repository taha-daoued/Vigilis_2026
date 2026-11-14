// Carte Leaflet + OpenStreetMap. Hors ligne : les tuiles manquent, le fond de repli (grille) reste lisible.
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { DEMO_CENTER } from '../lib/geo'
import { TYPE_LABEL } from '../lib/format'
import { cameraIcon, markerIcon } from './mapIcons'
import type { Camera, Incident } from '../services'

function FlyTo({ incident }: { incident?: Incident }) {
  const map = useMap()
  const pos = incident?.position
  useEffect(() => {
    if (pos) map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [incident?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  return null
}

interface Props {
  incidents: Incident[]
  cameras: Camera[]
  /** Incident mis en évidence et vers lequel la carte se centre. */
  focusId: string | null
  freshIds: Set<string>
  onSelect: (id: string) => void
}

export function LiveMap({ incidents, cameras, focusId, freshIds, onSelect }: Props) {
  const [zoom, setZoom] = useState(15)
  const focused = incidents.find((i) => i.id === focusId)
  const placed = useMemo(() => incidents.filter((i) => i.position), [incidents])

  // Au-delà de 20 marqueurs, regroupement simple par cases de grille selon le zoom.
  const { singles, clusters } = useMemo(() => {
    if (placed.length <= 20) return { singles: placed, clusters: [] as { lat: number; lng: number; items: Incident[] }[] }
    const cell = 360 / 2 ** zoom / 3
    const groups = new Map<string, Incident[]>()
    placed.forEach((i) => {
      const key = `${Math.floor(i.position!.lat / cell)}:${Math.floor(i.position!.lng / cell)}`
      groups.set(key, [...(groups.get(key) ?? []), i])
    })
    const singles: Incident[] = []
    const clusters: { lat: number; lng: number; items: Incident[] }[] = []
    groups.forEach((items) => {
      if (items.length === 1 || items.some((i) => i.id === focusId)) singles.push(...items)
      else clusters.push({ lat: items.reduce((s, i) => s + i.position!.lat, 0) / items.length, lng: items.reduce((s, i) => s + i.position!.lng, 0) / items.length, items })
    })
    return { singles, clusters }
  }, [placed, zoom, focusId])

  return (
    <MapContainer center={[DEMO_CENTER.lat, DEMO_CENTER.lng]} zoom={15} className="vg-map h-full w-full" aria-label="Carte des incidents">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomWatcher onZoom={setZoom} />
      <FlyTo incident={focused} />
      {cameras.map((c) => (
        <Marker key={c.id} position={[c.position.lat, c.position.lng]} icon={cameraIcon(c)} title={`Caméra : ${c.name} (${c.online ? 'en ligne' : 'hors ligne'})`} alt={`Caméra ${c.name}`} />
      ))}
      {clusters.map((c, idx) => (
        <Marker
          key={`cl-${idx}`}
          position={[c.lat, c.lng]}
          icon={L.divIcon({ className: '', iconSize: [38, 38], html: `<div class="vg-cluster" style="width:38px;height:38px">${c.items.length}</div>` })}
          title={`${c.items.length} incidents regroupés`}
          eventHandlers={{ click: (e) => e.target._map.flyTo([c.lat, c.lng], zoom + 2) }}
        />
      ))}
      {singles.map((i) => (
        <Marker
          key={i.id}
          position={[i.position!.lat, i.position!.lng]}
          icon={markerIcon(i.type, freshIds.has(i.id), i.id === focusId)}
          title={`${TYPE_LABEL[i.type]} : ouvrir le détail`}
          alt={`Incident ${TYPE_LABEL[i.type]}`}
          eventHandlers={{ click: () => onSelect(i.id) }}
        />
      ))}
    </MapContainer>
  )
}
