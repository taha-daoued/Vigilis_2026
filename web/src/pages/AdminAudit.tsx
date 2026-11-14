import { useMemo, useState } from 'react'
import { KIND_LABEL, TYPE_LABEL, dateTime } from '../lib/format'
import { downloadCsv, toCsv } from '../lib/csv'
import { useNowMinute } from '../lib/useNow'
import type { AlertKind, IncidentType } from '../services'
import { useData } from '../stores/data'

type Period = 'heure' | 'jour' | 'semaine' | 'tout'
const PERIOD_MS: Record<Period, number> = { heure: 3_600_000, jour: 86_400_000, semaine: 7 * 86_400_000, tout: Infinity }
const sel = 'mt-0.5 block min-h-11 rounded-lg border border-line bg-surface px-2'

export function AdminAudit() {
  const { logs, incidents } = useData()
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('tous')
  const [kind, setKind] = useState<AlertKind | 'tous'>('tous')
  const [type, setType] = useState<IncidentType | 'tous'>('tous')
  const [period, setPeriod] = useState<Period>('tout')
  const [desc, setDesc] = useState(true)
  const nowMinute = useNowMinute()

  const actors = useMemo(() => ['tous', ...Array.from(new Set(logs.map((l) => l.actor)))], [logs])
  const rows = useMemo(() => {
    const byId = new Map(incidents.map((i) => [i.id, i]))
    const needle = q.trim().toLowerCase()
    const since = nowMinute - PERIOD_MS[period]
    return logs
      .map((l) => ({ l, inc: l.incidentId ? byId.get(l.incidentId) : undefined }))
      .filter(({ l, inc }) =>
        (actor === 'tous' || l.actor === actor) &&
        (kind === 'tous' || l.kind === kind) &&
        (type === 'tous' || inc?.type === type) &&
        +new Date(l.at) >= since &&
        (!needle || `${l.action} ${l.actor} ${l.incidentId ?? ''} ${KIND_LABEL[l.kind]} ${inc ? TYPE_LABEL[inc.type] : ''}`.toLowerCase().includes(needle)),
      )
      .sort((a, b) => (desc ? 1 : -1) * (+new Date(b.l.at) - +new Date(a.l.at)))
  }, [logs, incidents, q, actor, kind, type, period, desc, nowMinute])

  const exportCsv = () =>
    downloadCsv(
      `vigilis-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(['Date', 'Acteur', "Type d'action", 'Action', "Type d'incident", 'Incident'], rows.map(({ l, inc }) => [l.at, l.actor, KIND_LABEL[l.kind], l.action, inc ? TYPE_LABEL[inc.type] : '', l.incidentId ?? ''])),
    )

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Journal d'activité</h1>
      <p className="mt-1 text-sm text-muted">Qui a fait quoi : prise en charge, clôture, résolution, panne simulée, réinitialisation. Alimenté par les actions réelles de la démo.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Recherche
          <input value={q} onChange={(e) => setQ(e.target.value)} className={`${sel} w-52`} placeholder="action, acteur, incident…" />
        </label>
        <label className="text-sm font-semibold">Acteur
          <select value={actor} onChange={(e) => setActor(e.target.value)} className={sel}>{actors.map((a) => <option key={a} value={a}>{a === 'tous' ? 'Tous' : a}</option>)}</select>
        </label>
        <label className="text-sm font-semibold">Type d'action
          <select value={kind} onChange={(e) => setKind(e.target.value as AlertKind | 'tous')} className={sel}>
            <option value="tous">Tous</option>
            {(Object.keys(KIND_LABEL) as AlertKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Type d'incident
          <select value={type} onChange={(e) => setType(e.target.value as IncidentType | 'tous')} className={sel}>
            <option value="tous">Tous</option>
            {(Object.keys(TYPE_LABEL) as IncidentType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Période
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={sel}>
            <option value="heure">Dernière heure</option>
            <option value="jour">24 dernières heures</option>
            <option value="semaine">7 derniers jours</option>
            <option value="tout">Tout</option>
          </select>
        </label>
        <button className="btn ml-auto" onClick={exportCsv} disabled={rows.length === 0}>Exporter en CSV ({rows.length})</button>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Journal d'activité global</caption>
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th scope="col" className="p-3" aria-sort={desc ? 'descending' : 'ascending'}>
                <button className="font-bold uppercase" onClick={() => setDesc((d) => !d)}>Date {desc ? '▼' : '▲'}</button>
              </th>
              <th scope="col" className="p-3">Acteur</th><th scope="col" className="p-3">Type d'action</th><th scope="col" className="p-3">Action</th><th scope="col" className="p-3">Incident</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-muted">Aucune entrée pour ces filtres.</td></tr>}
            {rows.map(({ l, inc }) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap p-3 font-mono text-xs">{dateTime(l.at)}</td>
                <td className="p-3">{l.actor}</td>
                <td className="p-3">{KIND_LABEL[l.kind]}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3">{inc ? TYPE_LABEL[inc.type] : '—'} {l.incidentId && <span className="font-mono text-xs text-muted">{l.incidentId}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
