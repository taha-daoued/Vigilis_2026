// Position de l'utilisateur : GPS réel si le consentement est donné, sinon position simulée de la démo.
import { useEffect, useState } from 'react'
import type { LatLng } from '../services'
import { DEMO_CENTER } from './geo'

export const SIM_SOURCE = 'simulée (centre de la démo)'

export interface PositionState {
  /** Position utilisable pour un SOS ; null si le partage GPS est révoqué (SOS « sans position »). */
  position: LatLng | null
  /** Position affichable (réelle ou simulée), pour la carte. */
  displayPosition: LatLng
  source: string
  message: string | null
}

export function usePosition(consent: boolean | null): PositionState {
  const [real, setReal] = useState<LatLng | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (consent !== true || !('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setReal({ lat: p.coords.latitude, lng: p.coords.longitude })
        setMessage(null)
      },
      () => setMessage('Position refusée ou indisponible (HTTPS requis) : la position simulée de la démo est utilisée.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [consent])

  if (consent === false) {
    return { position: null, displayPosition: DEMO_CENTER, source: 'non partagée', message: 'Partage GPS désactivé : le SOS sera envoyé sans position.' }
  }
  const noApi = typeof navigator !== 'undefined' && !('geolocation' in navigator)
  return {
    position: real ?? DEMO_CENTER,
    displayPosition: real ?? DEMO_CENTER,
    source: real ? 'GPS réel (appareil)' : SIM_SOURCE,
    message: message ?? (noApi ? 'Géolocalisation indisponible sur cet appareil : position simulée utilisée.' : null),
  }
}
