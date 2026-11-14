// Carte Leaflet + OpenStreetMap. Hors ligne : les tuiles manquent, le fond de repli (grille) reste lisible.
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { DEMO_CENTER } from '../lib/geo'
import { TYPE_LABEL } from '../lib/format'
import type { Camera, Incident } from '../services'
import { TYPE_COLOR, TYPE_GLYPH, TYPE_SHAPE } from '../lib/typeStyle'

function markerIcon(inc: Incident, pulse: boolean, selected: boolean): L.DivIcon {
  const color = TYPE_COLOR[inc.type]
  const shape =
    inc.type === 'sos'
      ? `<circle cx="50" cy="50" r="46" fill="${color}" stroke="#fff" stroke-width="6"/>`
      : `<polygon points="${TYPE_SHAPE[inc.type]}" fill="${color}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`
  const ring = selected ? 'outline:3px solid #fff;outline-offset:2px;border-radius:50%;' : ''
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="vg-marker ${pulse ? 'pulse' : ''}" style="background:none;border:none;box-shadow:none;width:34px;height:34px;${ring}">
      <svg viewBox="0 0 100 100" width="34" height="34" aria-hidden="true">${shape}
      <text x="50" y="68" text-anchor="middle" font-size="54" font-weight="800" fill="#fff">${TYPE_GLYPH[inc.type]}</text></svg></div>`,
  })
}

function cameraIcon(cam: Camera): L.DivIcon {
  return L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="vg-cam ${cam.online ? '' : 'off'}" aria-hidden="true">▣</div>` })
}

function FlyTo({ incident }: { incident?: Incident }) {
  const map = useMap()
  useEffect(() => {
    if (incident) map.flyTo([incident.position.lat, incident.position.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
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
  selectedId: string | null
  freshIds: Set<string>
  onSelect: (id: string) => void
}

export function MapView({ incidents, cameras, selectedId, freshIds, onSelect }: Props) {
  const [zoom, setZoom] = useState(15)
  const selected = incidents.find((i) => i.id === selectedId)

  // Au-delà de 20 marqueurs, regroupement simple par cases de grille selon le zoom.
  const { singles, clusters } = useMemo(() => {
    if (incidents.length <= 20) return { singles: incidents, clusters: [] as { lat: number; lng: number; items: Incident[] }[] }
    const cell = 360 / 2 ** zoom / 3
    const groups = new Map<string, Incident[]>()
    incidents.forEach((i) => {
      const key = `${Math.floor(i.position.lat / cell)}:${Math.floor(i.position.lng / cell)}`
      groups.set(key, [...(groups.get(key) ?? []), i])
    })
    const singles: Incident[] = []
    const clusters: { lat: number; lng: number; items: Incident[] }[] = []
    groups.forEach((items) => {
      if (items.length === 1 || items.some((i) => i.id === selectedId)) singles.push(...items)
      else clusters.push({ lat: items.reduce((s, i) => s + i.position.lat, 0) / items.length, lng: items.reduce((s, i) => s + i.position.lng, 0) / items.length, items })
    })
    return { singles, clusters }
  }, [incidents, zoom, selectedId])

  return (
    <MapContainer center={[DEMO_CENTER.lat, DEMO_CENTER.lng]} zoom={15} className="vg-map h-full w-full" aria-label="Carte des incidents">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomWatcher onZoom={setZoom} />
      <FlyTo incident={selected} />
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
          position={[i.position.lat, i.position.lng]}
          icon={markerIcon(i, freshIds.has(i.id), i.id === selectedId)}
          title={`${TYPE_LABEL[i.type]} : ouvrir le détail`}
          alt={`Incident ${TYPE_LABEL[i.type]}`}
          eventHandlers={{ click: () => onSelect(i.id) }}
        />
      ))}
    </MapContainer>
  )
}
