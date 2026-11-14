import { useToasts } from '../stores/toasts'

/** Notifications éphémères. `aria-live` pour que les lecteurs d'écran annoncent les nouvelles alertes. */
export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[2000] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="card pointer-events-auto flex items-start gap-3 p-3 shadow-lg">
          <div className="flex-1">
            <p className="font-bold">{t.title}</p>
            {t.detail && <p className="text-sm text-muted">{t.detail}</p>}
          </div>
          <button className="btn !min-h-8 !min-w-8 !p-1" onClick={() => dismiss(t.id)} aria-label="Fermer la notification">✕</button>
        </div>
      ))}
    </div>
  )
}
