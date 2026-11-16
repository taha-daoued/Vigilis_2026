// Accès à FastAPI : ajoute l'ID token Firebase à chaque appel. Aucun jeton n'est affiché ni stocké par nous.
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Initialisation paresseuse : en mode démo (mock), Firebase n'est jamais initialisé. */
export function firebaseAuth() {
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      })
  return getAuth(app)
}

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const auth = firebaseAuth()
  await auth.authStateReady() // Firebase restaure la session de façon asynchrone au chargement
  const token = await auth.currentUser?.getIdToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError('Serveur injoignable. Le backend est-il lancé ?', 0)
  }
  if (!res.ok) {
    const detail = await res
      .json()
      .then((d: { detail?: unknown }) => (typeof d.detail === 'string' ? d.detail : null))
      .catch(() => null)
    throw new ApiError(detail ?? `Erreur ${res.status}`, res.status)
  }
  return (await res.json()) as T
}
