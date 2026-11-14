import { useMemo, useState } from 'react'
import { TYPE_LABEL, dateTime } from '../lib/format'
import { useData } from '../stores/data'

export function AdminAudit() {
  const { logs, incidents } = useData()
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('tous')

  const actors = useMemo(() => ['tous', ...Array.from(new Set(logs.map((l) => l.actor)))], [logs])
  const rows = useMemo(() => {
    const byId = new Map(incidents.map((i) => [i.id, i]))
    const needle = q.trim().toLowerCase()
    return logs
      .filter((l) => (actor === 'tous' || l.actor === actor))
      .map((l) => ({ l, inc: byId.get(l.incidentId) }))
      .filter(({ l, inc }) => !needle || `${l.action} ${l.actor} ${l.incidentId} ${inc ? TYPE_LABEL[inc.type] : ''}`.toLowerCase().includes(needle))
      .sort((a, b) => +new Date(b.l.at) - +new Date(a.l.at))
  }, [logs, incidents, q, actor])

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Journal d'audit</h1>
      <p className="mt-1 text-sm text-muted">Qui a vu ou traité quoi. Alimenté par les actions réelles faites dans la démo.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-sm font-semibold">Recherche
          <input value={q} onChange={(e) => setQ(e.target.value)} className="mt-0.5 block min-h-11 rounded-lg border border-line bg-surface px-3" placeholder="action, acteur, incident…" />
        </label>
        <label className="text-sm font-semibold">Acteur
          <select value={actor} onChange={(e) => setActor(e.target.value)} className="mt-0.5 block min-h-11 rounded-lg border border-line bg-surface px-2">
            {actors.map((a) => <option key={a} value={a}>{a === 'tous' ? 'Tous' : a}</option>)}
          </select>
        </label>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Journal d'audit des incidents</caption>
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr><th scope="col" className="p-3">Date</th><th scope="col" className="p-3">Acteur</th><th scope="col" className="p-3">Action</th><th scope="col" className="p-3">Incident</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={4} className="p-4 text-muted">Aucune entrée pour ces filtres.</td></tr>}
            {rows.map(({ l, inc }) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap p-3 font-mono text-xs">{dateTime(l.at)}</td>
                <td className="p-3">{l.actor}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3">{inc ? TYPE_LABEL[inc.type] : '—'} <span className="font-mono text-xs text-muted">{l.incidentId}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
