// Bande d'état : que se passe-t-il, qu'est-ce qui attend, le système fonctionne-t-il ?
import { memo } from 'react'
import { formatDuration } from '../lib/format'
import { meanTakeSeconds } from '../lib/stats'
import type { Camera, Incident, SystemHealth } from '../services'
import { SimulatedBadge } from './badges'

const AI_LABEL = { actif: '● Actif', degrade: '⚠ Dégradé (aucune caméra en ligne)', inactif: '✕ Inactif' } as const

function Stat({ label, value, extra }: { label: string; value: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="card min-w-32 px-4 py-2">
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">{label}{extra}</p>
    </div>
  )
}

export const StatusBar = memo(function StatusBar({ incidents, cameras, health }: { incidents: Incident[]; cameras: Camera[]; health: SystemHealth | null }) {
  const mean = meanTakeSeconds(incidents)
  return (
    <section aria-label="État du système" className="flex flex-wrap items-stretch gap-3 border-b border-line p-3">
      <Stat label="Incidents nouveaux" value={incidents.filter((i) => i.status === 'nouveau').length} />
      <Stat label="En cours" value={incidents.filter((i) => i.status === 'en_cours').length} />
      <Stat label="Temps moyen de prise en charge" value={mean === null ? '—' : formatDuration(mean)} />
      <Stat label="Caméras en ligne" value={`${cameras.filter((c) => c.online).length}/${cameras.length}`} />
      <Stat label="Service IA" value={<span className="text-lg">{health ? AI_LABEL[health.aiService] : '…'}</span>} extra={<SimulatedBadge />} />
    </section>
  )
})
