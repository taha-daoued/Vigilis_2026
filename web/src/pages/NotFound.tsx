import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-muted">Cette adresse n'existe pas dans la démo.</p>
      <Link to="/" className="btn btn-primary mt-6">Retour à l'accueil</Link>
    </main>
  )
}
