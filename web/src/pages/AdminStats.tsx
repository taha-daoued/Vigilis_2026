// Statistiques opérationnelles sur les incidents passés. Aucune prévision.
// Heatmap : une seule teinte (séquentiel clair → foncé), valeurs écrites dans les cases, tableau alternatif.
import { useMemo } from 'react'
import { TypeShape } from '../components/badges'
import { TYPE_LABEL, formatDuration } from '../lib/format'
import { TYPE_COLOR } from '../lib/typeStyle'
import { WEEKDAYS, countByCamera, countByType, falseAlarmShare, heatmap, meanTakeSeconds } from '../lib/stats'
import type { IncidentType } from '../services'
import { useData } from '../stores/data'

// Niveaux de la heatmap : [seuil minimal, part de la teinte, couleur du texte]
const LEVELS: { min: number; mix: number; text: string; legend: string }[] = [
  { min: 0, mix: 0, text: 'var(--text-muted)', legend: '0' },
  { min: 1, mix: 25, text: 'var(--text)', legend: '1' },
  { min: 2, mix: 45, text: 'var(--text)', legend: '2' },
  { min: 3, mix: 70, text: '#fff', legend: '3 à 4' },
  { min: 5, mix: 95, text: '#fff', legend: '5 et +' },
]
const level = (n: number) => [...LEVELS].reverse().find((l) => n >= l.min)!
const cellBg = (n: number) => `color-mix(in srgb, var(--color-brand-500) ${level(n).mix}%, var(--surface))`

function Bars({ rows }: { rows: { key: string; label: React.ReactNode; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[10rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">{r.label}</span>
          <span className="h-2 rounded-r bg-surface-2"><span className="block h-2 rounded-r" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></span>
          <span className="text-right font-mono">{r.value}</span>
        </li>
      ))}
    </ul>
  )
}

export function AdminStats() {
  const { incidents, cameras, ready } = useData()
  const s = useMemo(() => ({
    grid: heatmap(incidents),
    byType: countByType(incidents),
    byCam: countByCamera(incidents),
    mean: meanTakeSeconds(incidents),
    fa: falseAlarmShare(incidents),
  }), [incidents])
  if (!ready) return <p className="p-6 text-muted">Chargement…</p>

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold">Statistiques</h1>
        <p className="text-sm text-muted">Historique des incidents (données simulées). Statistiques du passé : aucune prévision.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Indicateurs clés">
        <div className="card p-4"><p className="text-3xl font-extrabold">{incidents.length}</p><p className="text-xs text-muted">incidents enregistrés</p></div>
        <div className="card p-4"><p className="text-3xl font-extrabold">{s.mean === null ? '—' : formatDuration(s.mean)}</p><p className="text-xs text-muted">délai moyen de prise en charge</p></div>
        <div className="card p-4">
          <p className="text-3xl font-extrabold">{s.fa.share === null ? '—' : `${Math.round(s.fa.share * 100)} %`}</p>
          <p className="text-xs text-muted">de fausses alertes ({s.fa.falseAlarms} sur {s.fa.closed} incidents clos)</p>
          <p className="mt-1 text-xs font-semibold">Indicateur opérationnel, pas une métrique du modèle.</p>
        </div>
      </section>

      <section aria-labelledby="heat" className="card p-4">
        <h2 id="heat" className="font-bold">Incidents par heure et par jour de la semaine</h2>
        <div className="mt-3 overflow-x-auto">
          <div className="grid min-w-[680px] gap-0.5" style={{ gridTemplateColumns: '2.5rem repeat(24, minmax(0, 1fr))' }} role="img" aria-label="Carte de chaleur : tableau alternatif ci-dessous">
            <span />
            {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center text-[10px] text-muted">{h % 3 === 0 ? `${h}h` : ''}</span>)}
            {WEEKDAYS.map((d, di) => (
              <div key={d} className="contents">
                <span className="self-center text-xs text-muted">{d}</span>
                {s.grid[di].map((n, h) => (
                  <span key={h} title={`${d} ${h} h : ${n} incident${n > 1 ? 's' : ''}`} className="grid h-6 place-items-center rounded-sm text-[11px] font-bold" style={{ background: cellBg(n), color: level(n).text }}>
                    {n > 0 ? n : ''}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" aria-label="Légende">
          <span className="text-muted">Incidents par case :</span>
          {LEVELS.map((l) => (
            <span key={l.legend} className="flex items-center gap-1"><span className="inline-block size-4 rounded-sm border border-line" style={{ background: cellBg(l.min) }} />{l.legend}</span>
          ))}
        </div>
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Afficher le tableau (alternative accessible)</summary>
          <div className="overflow-x-auto">
            <table className="min-w-[680px] text-center text-xs">
              <caption className="sr-only">Nombre d'incidents par jour de la semaine et par heure</caption>
              <thead><tr><th scope="col" className="p-1 text-left">Jour</th>{Array.from({ length: 24 }, (_, h) => <th key={h} scope="col" className="p-1 font-normal text-muted">{h}h</th>)}</tr></thead>
              <tbody>{WEEKDAYS.map((d, di) => <tr key={d}><th scope="row" className="p-1 text-left">{d}</th>{s.grid[di].map((n, h) => <td key={h} className="p-1">{n}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="bytype" className="card p-4">
          <h2 id="bytype" className="mb-3 font-bold">Répartition par type</h2>
          <Bars rows={(Object.keys(TYPE_LABEL) as IncidentType[]).map((t) => ({ key: t, label: <><TypeShape type={t} size={16} />{TYPE_LABEL[t]}</>, value: s.byType[t], color: TYPE_COLOR[t] }))} />
        </section>
        <section aria-labelledby="bycam" className="card p-4">
          <h2 id="bycam" className="mb-3 font-bold">Répartition par caméra</h2>
          <Bars rows={cameras.map((c) => ({ key: c.id, label: c.name, value: s.byCam.get(c.id) ?? 0, color: 'var(--color-brand-500)' }))} />
          <p className="mt-2 text-xs text-muted">Les SOS n'ont pas de caméra : ils ne figurent pas ici.</p>
        </section>
      </div>
    </div>
  )
}
