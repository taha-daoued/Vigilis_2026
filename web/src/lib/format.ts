import type { IncidentStatus, IncidentType } from '../services/types'

export const TYPE_LABEL: Record<IncidentType, string> = {
  violence: 'Violence',
  chute: 'Chute / malaise',
  sos: 'SOS',
  vol: 'Vol',
}

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  cloture: 'Clôturé',
}

/** Statut vu par l'utilisateur de l'app. */
export const USER_STATUS_LABEL: Record<IncidentStatus, string> = {
  nouveau: 'Envoyée',
  en_cours: 'Prise en charge',
  cloture: 'Clôturée',
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 10) return "à l'instant"
  if (s < 60) return `il y a ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString()
}
