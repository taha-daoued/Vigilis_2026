import type { IncidentType } from '../services/types'

export const TYPE_COLOR: Record<IncidentType, string> = {
  violence: '#dc2626',
  chute: '#d97706',
  sos: '#7c3aed',
  vol: '#0d9488',
}

/** Forme propre à chaque type : triangle, carré, cercle, losange. */
export const TYPE_SHAPE: Record<IncidentType, string> = {
  violence: '50,6 94,90 6,90',
  chute: '10,10 90,10 90,90 10,90',
  sos: '',
  vol: '50,4 96,50 50,96 4,50',
}
export const TYPE_GLYPH: Record<IncidentType, string> = { violence: '!', chute: '↓', sos: 'S', vol: '?' }

