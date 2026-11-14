import type { Incident, LatLng } from '../services/types'

/** Distance en mètres entre deux positions (formule de haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Incidents proches dans le temps (± windowMin) OU dans l'espace (≤ radiusM), hors l'incident lui-même. */
export function nearbyIncidents(target: Incident, all: Incident[], windowMin = 10, radiusM = 300): Incident[] {
  return all
    .filter((o) => o.id !== target.id)
    .filter((o) => {
      const closeInTime = Math.abs(+new Date(o.createdAt) - +new Date(target.createdAt)) <= windowMin * 60_000
      const closeInSpace = !!o.position && !!target.position && distanceMeters(o.position, target.position) <= radiusM
      return closeInTime || closeInSpace
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}
