import { useEffect, useMemo, useState } from 'react'
import { IncidentDetail } from '../components/IncidentDetail'
import { IncidentList } from '../components/IncidentList'
import { MapView } from '../components/MapView'
import { isToday } from '../lib/format'
import { startSimulator, triggerScenario, type Scenario } from '../lib/simulator'
import { onIncidentArrival, useData } from '../stores/data'

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-2">
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  )
}

export function AdminDashboard() {
  const { incidents, cameras, logs, ready } = useData()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [running, setRunning] = useState(true)
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())

  // Nouveaux incidents : marqueur qui pulse pendant 30 s
  useEffect(
    () =>
      onIncidentArrival((inc) => {
        setFreshIds((s) => new Set(s).add(inc.id))
        setTimeout(() => setFreshIds((s) => { const n = new Set(s); n.delete(inc.id); return n }), 30_000)
      }),
    [],
  )

  // Simulateur : un incident toutes les 20 à 40 s tant que « en marche »
  useEffect(() => (running ? startSimulator(() => useData.getState().cameras) : undefined), [running])

  const counts = useMemo(
    () => ({
      nouveaux: incidents.filter((i) => i.status === 'nouveau').length,
      enCours: incidents.filter((i) => i.status === 'en_cours').length,
      closAujourdhui: incidents.filter((i) => i.status === 'cloture' && isToday(i.createdAt)).length,
      camerasEnLigne: cameras.filter((c) => c.online).length,
    }),
    [incidents, cameras],
  )
  const selected = incidents.find((i) => i.id === selectedId)

  if (!ready) return <p className="p-6 text-muted">Chargement des incidents…</p>

  const scenarios: { type: Scenario; label: string }[] = [
    { type: 'violence', label: 'Violence' },
    { type: 'chute', label: 'Chute' },
    { type: 'vol', label: 'Vol (expérimental)' },
  ]

  return (
    <div className="flex h-full min-h-[640px] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <Counter label="Incidents nouveaux" value={counts.nouveaux} />
        <Counter label="En cours" value={counts.enCours} />
        <Counter label="Clos aujourd'hui" value={counts.closAujourdhui} />
        <Counter label="Caméras en ligne" value={counts.camerasEnLigne} />
        <div className="ml-auto flex flex-wrap items-center gap-2" role="group" aria-label="Simulateur d'incidents">
          <span className="text-xs text-muted">Simulateur : {running ? 'en marche (1 incident / 20-40 s)' : 'en pause'}</span>
          <button className="btn" onClick={() => setRunning((r) => !r)} aria-pressed={!running}>{running ? 'Pause' : 'Reprendre'}</button>
          {scenarios.map((s) => (
            <button key={s.type} className="btn" onClick={() => void triggerScenario(s.type, cameras)}>Scénario : {s.label}</button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="h-[45vh] min-h-72 flex-1 lg:h-auto"><MapView incidents={incidents} cameras={cameras} selectedId={selectedId} freshIds={freshIds} onSelect={setSelectedId} /></div>
        <aside className="h-[50vh] w-full overflow-hidden border-t border-line bg-surface lg:h-auto lg:w-96 lg:border-l lg:border-t-0">
          {selected ? (
            <IncidentDetail incident={selected} cameras={cameras} logs={logs} onClose={() => setSelectedId(null)} />
          ) : (
            <IncidentList incidents={incidents} selectedId={selectedId} freshIds={freshIds} onSelect={setSelectedId} />
          )}
        </aside>
      </div>
    </div>
  )
}
