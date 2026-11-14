// Frise verticale de suivi d'une alerte : Envoyée → Reçue → Prise en charge → Clôturée.
import { clockTime } from '../lib/format'
import type { Incident } from '../services'

function resultText(i: Incident): string {
  if (i.resolution === 'fausse_alerte') return "Un opérateur a vérifié votre alerte : aucune situation d'urgence n'a été constatée."
  return 'Un opérateur a vérifié votre alerte : la situation a été confirmée et traitée.'
}

export function AlertTimeline({ incident: i }: { incident: Incident }) {
  const steps: { label: string; at?: string; text: string }[] = [
    { label: 'Envoyée', at: i.createdAt, text: i.position ? 'Votre alerte est partie avec votre position.' : 'Votre alerte est partie sans position (partage GPS désactivé).' },
    { label: 'Reçue', at: i.receivedAt, text: "L'équipe de supervision a bien reçu votre alerte." },
    { label: 'Prise en charge', at: i.takenAt, text: i.takenAt ? `Un opérateur s'occupe de votre alerte${i.assignedTo ? ` (${i.assignedTo})` : ''}.` : 'En attente d\'un opérateur.' },
    { label: 'Clôturée', at: i.closedAt, text: i.closedAt ? resultText(i) : 'Pas encore clôturée.' },
  ]
  const current = steps.reduce((acc, s, idx) => (s.at ? idx : acc), 0)
  return (
    <ol aria-label="Suivi de l'alerte" className="space-y-0">
      {steps.map((s, idx) => {
        const done = !!s.at
        return (
          <li key={s.label} aria-current={idx === current ? 'step' : undefined} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span aria-hidden="true" className={`grid size-7 place-items-center rounded-full border-2 text-sm font-bold ${done ? 'border-ok text-ok' : 'border-line text-muted'}`}>{done ? '✓' : '○'}</span>
              {idx < steps.length - 1 && <span aria-hidden="true" className={`w-0.5 flex-1 ${done ? 'bg-ok' : 'bg-line'}`} style={{ minHeight: '1.25rem' }} />}
            </div>
            <div className="pb-3">
              <p className={`font-bold ${done ? '' : 'text-muted'}`}>{s.label} {s.at && <span className="font-mono text-xs font-normal text-muted">{clockTime(s.at)}</span>}</p>
              <p className="text-sm text-muted">{s.text}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
