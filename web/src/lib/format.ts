import type { AlertKind, IncidentStatus, IncidentType, Resolution } from '../services/types'

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

export const RESOLUTION_LABEL: Record<Resolution, string> = {
  confirme: 'Confirmé',
  fausse_alerte: 'Fausse alerte',
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

/** Durée lisible : « 45 s », « 2 min 10 s », « 1 h 05 min ». */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function hourMinute(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString()
}

/** Âge simulé de la dernière image d'une caméra en ligne (1 à 6 s), pour la page Santé. */
export function simulatedFrameAge(cameraId: string, nowMs: number): number {
  let h = 0
  for (const ch of cameraId) h = (h * 31 + ch.charCodeAt(0)) % 997
  return ((h + Math.floor(nowMs / 1000)) % 6) + 1
}

export const KIND_LABEL: Record<AlertKind, string> = {
  detection: 'Détection',
  sos: 'SOS reçu',
  prise_en_charge: 'Prise en charge',
  cloture: 'Clôture',
  resolution: 'Résolution',
  reouverture: 'Réouverture',
  panne_camera: 'Panne caméra simulée',
  retablissement: 'Rétablissement caméra',
  reinitialisation: 'Réinitialisation',
}
