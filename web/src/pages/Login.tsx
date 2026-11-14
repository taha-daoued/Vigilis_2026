import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../services'
import type { Role } from '../services'
import { DemoBanner } from '../components/DemoBanner'
import { useSession } from '../stores/session'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as { message?: string; from?: string; role?: Role }
  const { login, loginAs } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const go = (role: Role) => navigate(role === 'admin' ? '/admin' : '/app', { replace: true })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      go((await login(email, password)).role)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.')
    }
  }
  const prefill = (role: Role) => {
    const acc = authApi.demoAccounts().find((a) => a.role === role)!
    setEmail(acc.email)
    setPassword(acc.password)
  }

  return (
    <div className="min-h-full bg-bg text-ink">
      <DemoBanner />
      <main className="mx-auto max-w-md px-4 py-10">
        <Link to="/" className="text-sm text-brand-600 underline">← Accueil</Link>
        <h1 className="mt-4 text-2xl font-bold">Connexion</h1>
        <p className="mt-1 text-sm text-muted">Authentification simulée en V1 : seuls les deux comptes démo fonctionnent.</p>
        {state.message && <p role="alert" className="mt-4 rounded-lg border border-danger p-3 text-sm font-semibold text-danger">{state.message}</p>}

        <form onSubmit={submit} className="card mt-4 space-y-4 p-4">
          <label className="block text-sm font-semibold">
            E-mail
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3" />
          </label>
          <label className="block text-sm font-semibold">
            Mot de passe
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3" />
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <button type="submit" className="btn btn-primary w-full">Se connecter</button>
        </form>

        <section className="card mt-4 space-y-3 p-4" aria-labelledby="demo">
          <h2 id="demo" className="font-bold">Comptes démo</h2>
          <div className="flex flex-col gap-2">
            <button className="btn" onClick={() => void loginAs('user').then(() => go('user'))}>Se connecter en tant qu'utilisateur</button>
            <button className="btn" onClick={() => void loginAs('admin').then(() => go('admin'))}>Se connecter en tant qu'admin</button>
          </div>
          <p className="text-xs text-muted">Ou pré-remplir le formulaire :
            {' '}<button className="underline" onClick={() => prefill('user')}>utilisateur</button>
            {' · '}<button className="underline" onClick={() => prefill('admin')}>admin</button>
          </p>
        </section>
      </main>
    </div>
  )
}
