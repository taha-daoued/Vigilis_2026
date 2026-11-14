// Badges de type et de statut : l'information n'est JAMAIS portée par la couleur seule (forme + texte).
import type { IncidentStatus, IncidentType } from '../services'
import { STATUS_LABEL, TYPE_LABEL } from '../lib/format'
import { TYPE_COLOR, TYPE_GLYPH, TYPE_SHAPE } from '../lib/typeStyle'

export function TypeShape({ type, size = 18 }: { type: IncidentType; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {type === 'sos' ? (
        <circle cx="50" cy="50" r="46" fill={TYPE_COLOR[type]} />
      ) : (
        <polygon points={TYPE_SHAPE[type]} fill={TYPE_COLOR[type]} strokeLinejoin="round" />
      )}
      <text x="50" y="68" textAnchor="middle" fontSize="54" fontWeight="800" fill="#fff">
        {TYPE_GLYPH[type]}
      </text>
    </svg>
  )
}

export function ExperimentalBadge() {
  return (
    <span className="inline-flex items-center rounded border border-dashed border-line px-1.5 py-0.5 text-xs font-semibold text-muted">
      Expérimental
    </span>
  )
}

export function TypeBadge({ type, experimental }: { type: IncidentType; experimental?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <TypeShape type={type} />
      {TYPE_LABEL[type]}
      {experimental && <ExperimentalBadge />}
    </span>
  )
}

const STATUS_STYLE: Record<IncidentStatus, { icon: string; cls: string }> = {
  nouveau: { icon: '●', cls: 'border-danger text-danger' },
  en_cours: { icon: '◐', cls: 'border-warn text-warn' },
  cloture: { icon: '✓', cls: 'border-ok text-ok' },
}

export function StatusBadge({ status, label }: { status: IncidentStatus; label?: string }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span>
      {label ?? STATUS_LABEL[status]}
    </span>
  )
}
