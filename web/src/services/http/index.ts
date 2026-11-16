// Implémentation FastAPI + Firebase des contrats de ../api.ts (activée par VITE_DATA_MODE=http).
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { DEFAULT_PREFS } from '../../lib/seeds'
import type { AuthApi, IncidentsApi, PrefsApi, Services, SosApi } from '../api'
import type { AlertLog, Incident, PrivacyPrefs, Role, SystemHealth, User } from '../types'
import { apiFetch, firebaseAuth } from './client'

const USER_KEY = 'vigilis.http.user'
const PREFS_KEY = 'vigilis.http.prefs'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage indisponible : on continue sans */
  }
}

/** Écrans abonnés. Le serveur n'a pas encore de WebSocket : on interroge l'API toutes les 2,5 s (V2 : WebSocket). */
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
const notify = () => listeners.forEach((l) => l())

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/user-disabled': 'Ce compte est désactivé.',
  'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
  'auth/network-request-failed': 'Réseau indisponible.',
}

const auth: AuthApi = {
  async login(email, password) {
    try {
      await signInWithEmailAndPassword(firebaseAuth(), email, password)
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      throw new Error(FIREBASE_ERRORS[code] ?? 'Connexion impossible.')
    }
    // Le rôle vient du serveur (custom claim vérifié), jamais du navigateur.
    const me = await apiFetch<{ uid: string; email: string | null; role: Role }>('/me')
    const user: User = { id: me.uid, name: me.email ?? me.uid, email: me.email ?? email, role: me.role }
    writeJson(USER_KEY, user)
    return user
  },
  async loginAs() {
    throw new Error('Non disponible en mode connecté : utilisez un vrai compte.')
  },
  logout() {
    try {
      localStorage.removeItem(USER_KEY)
    } catch {
      /* ignoré */
    }
    void signOut(firebaseAuth())
  },
  current: () => readJson<User | null>(USER_KEY, null),
  demoAccounts: () => [],
}

const incidents: IncidentsApi = {
  list: () => apiFetch<Incident[]>('/incidents'),
  async listCameras() {
    return [] // pas de caméra réelle tant que le service IA n'est pas branché
  },
  async listLogs() {
    return auth.current()?.role === 'admin' ? apiFetch<AlertLog[]>('/logs') : []
  },
  async getHealth(): Promise<SystemHealth> {
    const apiUp = await apiFetch<{ status: string }>('/health')
      .then((h) => h.status === 'ok')
      .catch(() => false)
    return { aiService: 'inactif', api: apiUp ? 'actif' : 'inactif', realtime: 'degrade', lastLatencyMs: null }
  },
  async setStatus(id, status, _actor, resolution) {
    if (status === 'cloture' && !resolution) throw new Error('Résolution obligatoire à la clôture (confirmé ou fausse alerte).')
    const inc = await apiFetch<Incident>(`/incidents/${id}`, { method: 'PATCH', body: { status, resolution } })
    notify()
    return inc
  },
  async createDetected() {
    throw new Error('Les détections viennent du service IA, pas du navigateur.')
  },
  async simulateCameraOutage() {
    return null
  },
  async restoreCameras() {
    return 0
  },
  subscribe(listener) {
    listeners.add(listener)
    if (!timer) timer = setInterval(notify, 2500)
    return () => {
      listeners.delete(listener)
      if (!listeners.size && timer) {
        clearInterval(timer)
        timer = undefined
      }
    }
  },
  async reset() {
    /* sans objet : les données sont réelles */
  },
}

const sos: SosApi = {
  async send(user, position, positionSource) {
    const res = await apiFetch<{ id: string }>('/sos', { method: 'POST', body: { position, positionSource: positionSource.slice(0, 40) } })
    notify()
    const now = new Date().toISOString()
    return {
      id: res.id,
      type: 'sos',
      status: 'nouveau',
      createdAt: now,
      receivedAt: now,
      position,
      source: 'app',
      userId: user.id,
      imageUrl: 'svg:sos:0',
      description: '',
      windowsConfirmed: 0,
    }
  },
}

const prefs: PrefsApi = {
  // Préférences gardées dans ce navigateur (pas encore côté serveur).
  async getAll() {
    return readJson<Record<string, PrivacyPrefs>>(PREFS_KEY, {})
  },
  async update(userId, patch) {
    const all = readJson<Record<string, PrivacyPrefs>>(PREFS_KEY, {})
    all[userId] = { ...DEFAULT_PREFS, ...all[userId], ...patch }
    writeJson(PREFS_KEY, all)
    notify()
  },
}

export const httpServices: Services = { incidents, auth, sos, prefs }
