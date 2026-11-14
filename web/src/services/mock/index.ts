// Implémentation V1 des services : tout se passe dans le navigateur (aucune requête réseau).
import { DEFAULT_PREFS, DEMO_ADMIN, DEMO_PASSWORD, DEMO_USER, SYSTEM_ACTOR } from '../../lib/seeds'
import { isToday, RESOLUTION_LABEL } from '../../lib/format'
import type { AuthApi, IncidentsApi, PrefsApi, Services, SosApi } from '../api'
import type { AlertKind, AlertLog, Incident, Role, SystemHealth, User } from '../types'
import { db } from './db'

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const log = (incidentId: string | null, kind: AlertKind, action: string, actor: string, at = new Date().toISOString()): AlertLog => ({
  id: uid('log'),
  incidentId,
  kind,
  action,
  actor,
  at,
})

const incidents: IncidentsApi = {
  async list() {
    return db.get().incidents
  },
  async listCameras() {
    const d = db.get()
    const now = Date.now()
    return d.cameras.map((c) => ({
      ...c,
      // Caméra en ligne : image reçue à l'instant (simulé) ; hors ligne : la dernière image connue.
      lastFrameAt: c.online ? new Date(now - 2000).toISOString() : c.lastFrameAt,
      incidentsToday: d.incidents.filter((i) => i.cameraId === c.id && isToday(i.createdAt)).length,
    }))
  },
  async listLogs() {
    return db.get().logs
  },
  async getHealth(): Promise<SystemHealth> {
    const d = db.get()
    return { ...d.health, aiService: d.cameras.some((c) => c.online) ? d.health.aiService : 'degrade' }
  },
  async setStatus(id, status, actor, resolution) {
    if (status === 'cloture' && !resolution) throw new Error('Résolution obligatoire à la clôture (confirmé ou fausse alerte).')
    let result: Incident | undefined
    db.update((d) => {
      const inc = d.incidents.find((i) => i.id === id)
      if (!inc) return
      const now = new Date().toISOString()
      inc.status = status
      if (status === 'nouveau') {
        inc.assignedTo = undefined
        inc.takenAt = undefined
        inc.closedAt = undefined
        inc.resolution = undefined
        d.logs.push(log(id, 'reouverture', 'Rouvert (remis à nouveau)', actor.name, now))
      } else if (status === 'en_cours') {
        inc.assignedTo = actor.name
        inc.takenAt = inc.takenAt ?? now
        inc.closedAt = undefined
        inc.resolution = undefined
        d.logs.push(log(id, 'prise_en_charge', 'Passé en cours (assigné)', actor.name, now))
      } else {
        inc.assignedTo = inc.assignedTo ?? actor.name
        inc.takenAt = inc.takenAt ?? now
        inc.closedAt = now
        inc.resolution = resolution
        d.logs.push(log(id, 'cloture', 'Clôturé', actor.name, now))
        d.logs.push(log(id, 'resolution', `Résolution : ${RESOLUTION_LABEL[resolution!]}`, actor.name, now))
      }
      result = inc
    })
    if (!result) throw new Error(`Incident introuvable : ${id}`)
    return result
  },
  async createDetected(input) {
    const latencyMs = Math.round(rand(900, 2600)) // latence simulée : de l'événement filmé à l'alerte reçue
    const received = Date.now()
    const inc: Incident = {
      id: uid('inc'),
      type: input.type,
      score: input.score,
      status: 'nouveau',
      createdAt: new Date(received - latencyMs).toISOString(),
      receivedAt: new Date(received).toISOString(),
      position: input.position,
      source: 'camera',
      cameraId: input.cameraId,
      imageUrl: `svg:${input.type}:${Math.floor(Math.random() * 4)}`,
      description: input.description,
      windowsConfirmed: input.windowsConfirmed,
      experimental: input.type === 'vol' ? true : undefined,
    }
    db.update((d) => {
      d.incidents.push(inc)
      d.logs.push(log(inc.id, 'detection', 'Incident détecté', SYSTEM_ACTOR, inc.receivedAt))
      d.health.lastLatencyMs = latencyMs
    })
    return inc
  },
  async simulateCameraOutage(actor) {
    let hit: string | null = null
    db.update((d) => {
      const candidates = d.cameras.filter((c) => c.online)
      if (!candidates.length) return
      const cam = candidates[Math.floor(Math.random() * candidates.length)]
      cam.online = false
      cam.simulatedOutage = true
      cam.lastFrameAt = new Date().toISOString()
      hit = cam.id
      d.logs.push(log(null, 'panne_camera', `Panne simulée : ${cam.name}`, actor.name))
    })
    return hit ? (db.get().cameras.find((c) => c.id === hit) ?? null) : null
  },
  async restoreCameras(actor) {
    let count = 0
    db.update((d) => {
      d.cameras.forEach((c) => {
        if (!c.simulatedOutage) return
        c.online = true
        c.simulatedOutage = undefined
        c.lastFrameAt = new Date().toISOString()
        count++
        d.logs.push(log(null, 'retablissement', `Caméra rétablie : ${c.name}`, actor.name))
      })
    })
    return count
  },
  subscribe: (l) => db.subscribe(l),
  async reset(actor) {
    db.reset(actor?.name)
  },
}

const SESSION_KEY = 'vigilis.session.v1'
const ACCOUNTS: Record<Role, User> = { user: DEMO_USER, admin: DEMO_ADMIN }

const auth: AuthApi = {
  demoAccounts: () => (['user', 'admin'] as Role[]).map((role) => ({ role, email: ACCOUNTS[role].email, password: DEMO_PASSWORD })),
  async login(email, password) {
    const found = Object.values(ACCOUNTS).find((u) => u.email === email.trim().toLowerCase())
    if (!found || password !== DEMO_PASSWORD) throw new Error('Identifiants inconnus (compte démo uniquement).')
    localStorage.setItem(SESSION_KEY, JSON.stringify(found))
    return found
  },
  async loginAs(role) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(ACCOUNTS[role]))
    return ACCOUNTS[role]
  },
  logout() {
    localStorage.removeItem(SESSION_KEY)
  },
  current() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  },
}

const sos: SosApi = {
  async send(user, position, positionSource) {
    const latencyMs = Math.round(rand(300, 900)) // temps simulé entre l'envoi et la réception
    const received = Date.now()
    const inc: Incident = {
      id: uid('inc'),
      type: 'sos',
      status: 'nouveau',
      createdAt: new Date(received - latencyMs).toISOString(),
      receivedAt: new Date(received).toISOString(),
      position,
      source: 'app',
      userId: user.id,
      imageUrl: 'svg:sos:0',
      description: position
        ? `Alerte SOS envoyée depuis l'application (position : ${positionSource}).`
        : "Alerte SOS envoyée sans position (l'utilisateur a désactivé le partage GPS).",
      windowsConfirmed: 0,
    }
    db.update((d) => {
      d.incidents.push(inc)
      d.logs.push(log(inc.id, 'sos', 'SOS reçu', user.name, inc.receivedAt))
      d.health.lastLatencyMs = latencyMs
    })
    return inc
  },
}

const prefs: PrefsApi = {
  async getAll() {
    return db.get().prefs
  },
  async update(userId, patch) {
    db.update((d) => {
      d.prefs[userId] = { ...(d.prefs[userId] ?? DEFAULT_PREFS), ...patch }
    })
  },
}

export const mockServices: Services = { incidents, auth, sos, prefs }
