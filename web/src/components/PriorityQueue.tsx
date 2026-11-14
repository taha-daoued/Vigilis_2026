// File de priorité : SOS d'abord, puis score décroissant, puis ancienneté. Actions rapides sur chaque ligne.
import { memo, useMemo, useState } from 'react'
import { STATUS_LABEL, TYPE_LABEL, relativeTime } from '../lib/format'
import { comparePriority } from '../lib/priority'
import type { Incident, IncidentStatus, IncidentType } from '../services'
import { ResolutionBadge, StatusBadge, TypeBadge } from './badges'
import { WaitCounter } from './WaitCounter'

type StatusFilter = IncidentStatus | 'actifs' | 'tous'
type Sort = 'priorite' | 'recent' | 'score'

interface Props {
  incidents: Incident[]
  selectedId: string | null
  freshIds: Set<string>
  waitThresholdS: number
  onThresholdChange: (s: number) => void
  onOpen: (id: string) => void
  onShowOnMap: (id: string) => void
  onTake: (incident: Incident) => void
  onRequestClose: (incident: Incident) => void
}

const sel = 'min-h-11 rounded-lg border border-line bg-surface px-2 text-sm'

const Row = memo(function Row({ i, selected, fresh, thresholdS, onOpen, onShowOnMap, onTake, onRequestClose }: {
  i: Incident
  selected: boolean
  fresh: boolean
  thresholdS: number
} & Pick<Props, 'onOpen' | 'onShowOnMap' | 'onTake' | 'onRequestClose'>) {
  return (
    <li className={selected ? 'bg-surface-2' : ''}>
      <button onClick={() => onOpen(i.id)} aria-current={selected} className="flex min-h-11 w-full flex-col gap-1 px-3 pt-2 text-left hover:bg-surface-2">
        <span className="flex items-center justify-between gap-2">
          <TypeBadge type={i.type} experimental={i.experimental} />
          <StatusBadge status={i.status} />
        </span>
        <span className="flex flex-wrap items-center justify-between gap-x-2 text-xs text-muted">
          <span>{relativeTime(i.createdAt)}{fresh && <strong className="ml-2 text-danger">NOUVEAU</strong>}</span>
          <span>{i.type === 'sos' ? 'sans IA' : `score ${i.score!.toFixed(2)}`}{!i.position && ' · sans position'}</span>
        </span>
        {i.status === 'nouveau' && <WaitCounter receivedAt={i.receivedAt} thresholdS={thresholdS} />}
        {i.status === 'cloture' && i.resolution && <ResolutionBadge resolution={i.resolution} />}
      </button>
      <div className="flex flex-wrap gap-1.5 px-3 pb-2 pt-1">
        {i.status === 'nouveau' && <button className="btn !px-2 text-sm" onClick={() => onTake(i)}>Prendre en charge</button>}
        <button className="btn !px-2 text-sm" disabled={!i.position} title={i.position ? undefined : 'Position non transmise'} onClick={() => onShowOnMap(i.id)}>Voir sur la carte</button>
        {i.status !== 'cloture' && <button className="btn !px-2 text-sm" onClick={() => onRequestClose(i)}>Clôturer…</button>}
      </div>
    </li>
  )
})

export function PriorityQueue({ incidents, selectedId, freshIds, waitThresholdS, onThresholdChange, onOpen, onShowOnMap, onTake, onRequestClose }: Props) {
  const [type, setType] = useState<IncidentType | 'tous'>('tous')
  const [status, setStatus] = useState<StatusFilter>('actifs')
  const [sort, setSort] = useState<Sort>('priorite')

  const rows = useMemo(() => {
    const filtered = incidents.filter(
      (i) => (type === 'tous' || i.type === type) && (status === 'tous' ? true : status === 'actifs' ? i.status !== 'cloture' : i.status === status),
    )
    const cmp: Record<Sort, (a: Incident, b: Incident) => number> = {
      priorite: comparePriority,
      recent: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
    }
    return [...filtered].sort(cmp[sort])
  }, [incidents, type, status, sort])

  return (
    <section aria-label="File de priorité" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <label className="text-xs font-semibold text-muted">Type
          <select className={`${sel} mt-0.5 block`} value={type} onChange={(e) => setType(e.target.value as IncidentType | 'tous')}>
            <option value="tous">Tous</option>
            {(Object.keys(TYPE_LABEL) as IncidentType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">Statut
          <select className={`${sel} mt-0.5 block`} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="actifs">À traiter (nouveau + en cours)</option>
            <option value="tous">Tous</option>
            {(Object.keys(STATUS_LABEL) as IncidentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">Tri
          <select className={`${sel} mt-0.5 block`} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="priorite">Priorité (SOS, score, ancienneté)</option>
            <option value="recent">Plus récent</option>
            <option value="score">Score décroissant</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">Seuil d'attente
          <select className={`${sel} mt-0.5 block`} value={waitThresholdS} onChange={(e) => onThresholdChange(Number(e.target.value))}>
            <option value={60}>1 min</option>
            <option value={120}>2 min (défaut)</option>
            <option value={300}>5 min</option>
          </select>
        </label>
      </div>
      <ul aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 divide-y divide-line overflow-auto">
        {rows.length === 0 && <li className="p-4 text-sm text-muted">Aucun incident pour ces filtres.</li>}
        {rows.map((i) => (
          <Row key={i.id} i={i} selected={i.id === selectedId} fresh={freshIds.has(i.id)} thresholdS={waitThresholdS}
            onOpen={onOpen} onShowOnMap={onShowOnMap} onTake={onTake} onRequestClose={onRequestClose} />
        ))}
      </ul>
    </section>
  )
}
