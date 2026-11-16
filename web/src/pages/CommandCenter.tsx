// Centre de commande : que se passe-t-il, qu'est-ce qui attend, le système fonctionne-t-il ?
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DayTimeline } from '../components/DayTimeline'
import { IncidentDetail } from '../components/IncidentDetail'
import { LiveMap } from '../components/LiveMap'
import { PriorityQueue } from '../components/PriorityQueue'
import { ResolutionDialog } from '../components/ResolutionDialog'
import { StatusBar } from '../components/StatusBar'
import { useNowMinute } from '../lib/useNow'
import { triggerScenario, type Scenario } from '../lib/simulator'
import { incidentsApi, isMock } from '../services'
import type { Incident, Resolution } from '../services'
import { onIncidentArrival, useData } from '../stores/data'
import { useSession } from '../stores/session'
import { useToasts } from '../stores/toasts'
import { useUi } from '../stores/ui'

const SCENARIOS: { type: Scenario; label: string }[] = [
  { type: 'violence', label: 'Violence' },
  { type: 'chute', label: 'Chute' },
  { type: 'vol', label: 'Vol (expérimental)' },
]

export function CommandCenter() {
  const { incidents, cameras, logs, health, ready } = useData()
  const user = useSession((s) => s.user)!
  const { supervision, simRunning, setSimRunning, waitThresholdS, setWaitThreshold } = useUi()
  const pushToast = useToasts((s) => s.push)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [closing, setClosing] = useState<Incident | null>(null)
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

  // Carte : incidents des dernières 24 h seulement (l'historique plus ancien sert aux statistiques)
  const nowMinute = useNowMinute()
  const live = useMemo(() => {
    const since = nowMinute - 24 * 3_600_000
    return incidents.filter((i) => +new Date(i.createdAt) >= since)
  }, [incidents, nowMinute])
  const detail = incidents.find((i) => i.id === detailId)

  const open = useCallback((id: string) => { setDetailId(id); setFocusId(id) }, [])
  const showOnMap = useCallback((id: string) => setFocusId(id), [])
  const take = useCallback((i: Incident) => void incidentsApi.setStatus(i.id, 'en_cours', user), [user])
  const requestClose = useCallback((i: Incident) => setClosing(i), [])
  const confirmClose = (resolution: Resolution) => {
    if (!closing) return
    void incidentsApi.setStatus(closing.id, 'cloture', user, resolution)
    pushToast('Incident clôturé', resolution === 'fausse_alerte' ? 'Marqué comme fausse alerte.' : 'Marqué comme confirmé.')
    setClosing(null)
  }

  if (!ready) return <p className="p-6 text-muted">Chargement des incidents…</p>

  return (
    <div className="flex h-full min-h-[640px] flex-col">
      {!supervision && <StatusBar incidents={incidents} cameras={cameras} health={health} />}
      {!supervision && isMock && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2" role="group" aria-label="Simulateur d'incidents">
          <span className="text-xs text-muted">Simulateur : {simRunning ? 'en marche (1 incident / 20-40 s)' : 'en pause'}</span>
          <button className="btn !min-h-11" onClick={() => setSimRunning(!simRunning)} aria-pressed={!simRunning}>{simRunning ? 'Pause' : 'Reprendre'}</button>
          {SCENARIOS.map((s) => (
            <button key={s.type} className="btn" onClick={() => void triggerScenario(s.type, cameras)}>Scénario : {s.label}</button>
          ))}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="h-[40vh] min-h-64 flex-1 lg:h-auto"><LiveMap incidents={live} cameras={cameras} focusId={focusId} freshIds={freshIds} onSelect={open} /></div>
        <aside className={`h-[50vh] w-full overflow-hidden border-t border-line bg-surface lg:h-auto lg:border-l lg:border-t-0 ${supervision ? 'lg:w-[34rem]' : 'lg:w-[26rem]'}`}>
          <PriorityQueue incidents={incidents} selectedId={detailId} freshIds={freshIds} waitThresholdS={waitThresholdS} onThresholdChange={setWaitThreshold}
            onOpen={open} onShowOnMap={showOnMap} onTake={take} onRequestClose={requestClose} />
        </aside>
        {detail && (
          <div className="absolute inset-y-0 right-0 z-[1100] w-full border-l border-line shadow-2xl lg:w-[46rem]">
            <IncidentDetail incident={detail} incidents={incidents} cameras={cameras} logs={logs} onClose={() => setDetailId(null)} onOpen={open} onRequestClose={requestClose} />
          </div>
        )}
      </div>

      {!supervision && <DayTimeline incidents={incidents} selectedId={detailId} onOpen={open} />}
      <ResolutionDialog incident={closing} onCancel={() => setClosing(null)} onConfirm={confirmClose} />
    </div>
  )
}
