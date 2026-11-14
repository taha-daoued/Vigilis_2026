import type { LatLng } from '../services/types'

/** Centre de la démo : VITE_DEMO_CENTER="lat,lng" (par défaut Lagos, Nigeria). */
function parseCenter(raw: string | undefined): LatLng {
  const [lat, lng] = (raw ?? '').split(',').map((v) => Number(v.trim()))
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return { lat: 6.5244, lng: 3.3792 }
}

export const DEMO_CENTER: LatLng = parseCenter(import.meta.env.VITE_DEMO_CENTER)

/** Décale une position de (dx, dy) mètres vers l'est / le nord. */
export function offsetMeters(origin: LatLng, dx: number, dy: number): LatLng {
  const dLat = dy / 111_320
  const dLng = dx / (111_320 * Math.cos((origin.lat * Math.PI) / 180))
  return { lat: origin.lat + dLat, lng: origin.lng + dLng }
}

export function formatPosition(p: LatLng): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
}
