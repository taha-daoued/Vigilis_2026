import { useMemo, useState } from 'react'
import { STATUS_LABEL, TYPE_LABEL, relativeTime } from '../lib/format'
import type { Incident, IncidentStatus, IncidentType } from '../services'
import { StatusBadge, TypeBadge } from './badges'

interface Props {
  incidents: Incident[]
  selectedId: string | null
  freshIds: Set<string>
  onSelect: (id: string) => void
}

export function IncidentList({ incidents, selectedId, freshIds, onSelect }: Props) {
  const [type, setType] = useState<IncidentType | 'tous'>('tous')
  const [status, setStatus] = useState<IncidentStatus | 'tous'>('tous')
  const [sort, setSort] = useState<'recent' | 'score'>('recent')

  const rows = useMemo(() => {
    const filtered = incidents.filter((i) => (type === 'tous' || i.type === type) && (status === 'tous' || i.status === status))
    return filtered.sort((a, b) => (sort === 'score' ? (b.score ?? -1) - (a.score ?? -1) : +new Date(b.createdAt) - +new Date(a.createdAt)))
  }, [incidents, type, status, sort])

  const sel = 'min-h-11 rounded-lg border border-line bg-surface px-2 text-sm'
  return (
    <section aria-label="Incidents en direct" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <label className="text-xs font-semibold text-muted">Type
          <select className={`${sel} mt-0.5 block`} value={type} onChange={(e) => setType(e.target.value as IncidentType | 'tous')}>
            <option value="tous">Tous</option>
            {(Object.keys(TYPE_LABEL) as IncidentType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">Statut
          <select className={`${sel} mt-0.5 block`} value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | 'tous')}>
            <option value="tous">Tous</option>
            {(Object.keys(STATUS_LABEL) as IncidentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">Tri
          <select className={`${sel} mt-0.5 block`} value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'score')}>
            <option value="recent">Plus récent</option>
            <option value="score">Score décroissant</option>
          </select>
        </label>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-auto">
        {rows.length === 0 && <li className="p-4 text-sm text-muted">Aucun incident pour ces filtres.</li>}
        {rows.map((i) => (
          <li key={i.id}>
            <button
              onClick={() => onSelect(i.id)}
              aria-current={i.id === selectedId}
              className={`flex min-h-11 w-full flex-col gap-1 px-3 py-2 text-left hover:bg-surface-2 ${i.id === selectedId ? 'bg-surface-2' : ''}`}
            >
              <span className="flex items-center justify-between gap-2">
                <TypeBadge type={i.type} experimental={i.experimental} />
                <StatusBadge status={i.status} />
              </span>
              <span className="flex items-center justify-between text-xs text-muted">
                <span>{relativeTime(i.createdAt)}{freshIds.has(i.id) && <strong className="ml-2 text-danger">NOUVEAU</strong>}</span>
                <span>{i.score !== undefined ? `score ${i.score.toFixed(2)}` : 'sans IA'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
