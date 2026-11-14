import L from 'leaflet'
import { TYPE_COLOR, TYPE_GLYPH, TYPE_SHAPE } from '../lib/typeStyle'
import type { Camera, Incident } from '../services'

export function markerIcon(type: Incident['type'], pulse: boolean, selected: boolean): L.DivIcon {
  const color = TYPE_COLOR[type]
  const shape =
    type === 'sos'
      ? `<circle cx="50" cy="50" r="46" fill="${color}" stroke="#fff" stroke-width="6"/>`
      : `<polygon points="${TYPE_SHAPE[type]}" fill="${color}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`
  const ring = selected ? 'outline:3px solid #fff;outline-offset:2px;border-radius:50%;' : ''
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="vg-marker ${pulse ? 'pulse' : ''}" style="background:none;border:none;box-shadow:none;width:34px;height:34px;${ring}">
      <svg viewBox="0 0 100 100" width="34" height="34" aria-hidden="true">${shape}
      <text x="50" y="68" text-anchor="middle" font-size="54" font-weight="800" fill="#fff">${TYPE_GLYPH[type]}</text></svg></div>`,
  })
}

export function cameraIcon(cam: Camera): L.DivIcon {
  return L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="vg-cam ${cam.online ? '' : 'off'}" aria-hidden="true">${cam.online ? '▣' : '⊘'}</div>` })
}

