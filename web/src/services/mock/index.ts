// Implémentation V1 des services : tout se passe dans le navigateur (aucune requête réseau).
import { DEMO_ADMIN, DEMO_PASSWORD, DEMO_USER, SYSTEM_ACTOR } from '../../lib/seeds'
import type { AuthApi, IncidentsApi, Services, SosApi } from '../api'
import type { AlertLog, Incident, IncidentStatus, Role, User } from '../types'
import { db } from './db'

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
const STATUS_ACTION: Record<IncidentStatus, string> = {
  nouveau: 'Remis à nouveau',
  en_cours: 'Passé en cours (assigné)',
  cloture: 'Clôturé',
}

const incidents: IncidentsApi = {
  async list() {
    return db.get().incidents
  },
  async listCameras() {
    return db.get().cameras
  },
  async listLogs() {
    return db.get().logs
  },
  async setStatus(id, status, actor) {
    let result: Incident | undefined
    db.update((d) => {
      const inc = d.incidents.find((i) => i.id === id)
      if (!inc) return
      inc.status = status
      inc.assignedTo = status === 'nouveau' ? undefined : actor.name
      d.logs.push({ id: uid('log'), incidentId: id, action: STATUS_ACTION[status], actor: actor.name, at: new Date().toISOString() })
      result = inc
    })
    if (!result) throw new Error(`Incident introuvable : ${id}`)
    return result
  },
  async createDetected(input) {
    const inc: Incident = {
      id: uid('inc'),
      type: input.type,
      score: input.score,
      status: 'nouveau',
      createdAt: new Date().toISOString(),
      position: input.position,
      source: 'camera',
      cameraId: input.cameraId,
      imageUrl: `svg:${input.type}:${Math.floor(Math.random() * 4)}`,
      description: input.description,
      windowsConfirmed: input.windowsConfirmed,
      experimental: input.type === 'vol' ? true : undefined,
    }
    const log: AlertLog = { id: uid('log'), incidentId: inc.id, action: 'Incident détecté', actor: SYSTEM_ACTOR, at: inc.createdAt }
    db.update((d) => {
      d.incidents.push(inc)
      d.logs.push(log)
    })
    return inc
  },
  subscribe: (l) => db.subscribe(l),
  async reset() {
    db.reset()
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
    const inc: Incident = {
      id: uid('inc'),
      type: 'sos',
      status: 'nouveau',
      createdAt: new Date().toISOString(),
      position,
      source: 'app',
      userId: user.id,
      imageUrl: 'svg:sos:0',
      description: `Alerte SOS envoyée depuis l'application (position : ${positionSource}).`,
      windowsConfirmed: 0,
    }
    db.update((d) => {
      d.incidents.push(inc)
      d.logs.push({ id: uid('log'), incidentId: inc.id, action: 'SOS reçu', actor: user.name, at: inc.createdAt })
    })
    return inc
  },
}

export const mockServices: Services = { incidents, auth, sos }
