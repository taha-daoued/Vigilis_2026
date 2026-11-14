// Frise des dernières 24 h : un point par incident, forme + couleur par type, pics regroupés.
import { memo, useMemo } from 'react'
import { TYPE_LABEL, STATUS_LABEL, hourMinute } from '../lib/format'
import { useNowMinute } from '../lib/useNow'
import type { Incident } from '../services'
import { TypeShape } from './badges'

const DAY = 24 * 3_600_000
const LANE_H = 26
const MAX_LANES = 3
const MIN_GAP = 0.022 // écart minimal (part de la largeur) entre deux points d'une même ligne
const PEAK = 3 // à partir de 3 incidents dans la même heure : « pic »

export const DayTimeline = memo(function DayTimeline({ incidents, selectedId, onOpen }: { incidents: Incident[]; selectedId: string | null; onOpen: (id: string) => void }) {
  const now = useNowMinute()
  const start = now - DAY

  const { dots, lanes, peaks, ticks } = useMemo(() => {
    const inWindow = incidents.filter((i) => +new Date(i.createdAt) >= start).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    const lastX: number[] = []
    const dots = inWindow.map((i) => {
      const x = (+new Date(i.createdAt) - start) / DAY
      let lane = lastX.findIndex((lx) => x - lx >= MIN_GAP)
      if (lane === -1) lane = Math.min(lastX.length, MAX_LANES - 1) // au-delà, les points se superposent dans la dernière ligne
      lastX[lane] = x
      return { i, x, lane }
    })
    const perHour = new Map<number, number>()
    inWindow.forEach((i) => {
      const h = Math.floor(+new Date(i.createdAt) / 3_600_000)
      perHour.set(h, (perHour.get(h) ?? 0) + 1)
    })
    const peaks = [...perHour.entries()].filter(([, n]) => n >= PEAK).map(([h, n]) => ({ x: (h * 3_600_000 - start) / DAY, n }))
    const firstHour = Math.ceil(start / 3_600_000)
    const ticks = Array.from({ length: 24 }, (_, k) => firstHour + k)
      .filter((h) => h % 3 === 0)
      .map((h) => ({ x: (h * 3_600_000 - start) / DAY, label: `${String(new Date(h * 3_600_000).getHours()).padStart(2, '0')} h` }))
    return { dots, lanes: Math.max(1, lastX.length), peaks, ticks }
  }, [incidents, start])

  return (
    <section aria-label="Frise des dernières 24 heures" className="border-t border-line bg-surface px-4 py-2">
      <div className="mb-1 flex items-baseline justify-between text-xs text-muted">
        <h2 className="font-bold text-ink">Dernières 24 h</h2>
        <span>{dots.length} incident{dots.length > 1 ? 's' : ''} · ▮ pic = au moins {PEAK} incidents dans l'heure</span>
      </div>
      <div className="relative mx-3" style={{ height: lanes * LANE_H + 26 }}>
        {peaks.map((p, k) => (
          <div key={k} className="absolute top-0 border-x border-dashed border-danger bg-danger/10" style={{ left: `${p.x * 100}%`, width: `${(3_600_000 / DAY) * 100}%`, height: lanes * LANE_H }} title={`Pic : ${p.n} incidents dans l'heure`} />
        ))}
        {ticks.map((t) => (
          <span key={t.label + t.x} className="absolute text-[11px] text-muted" style={{ left: `${t.x * 100}%`, top: lanes * LANE_H + 4, transform: 'translateX(-50%)' }}>{t.label}</span>
        ))}
        <div className="absolute left-0 right-0 border-t border-line" style={{ top: lanes * LANE_H }} />
        <span className="absolute right-0 border-l-2 border-brand-300 pl-1 text-[11px] font-bold" style={{ top: 0, height: lanes * LANE_H }} aria-hidden="true">maintenant</span>
        {dots.map(({ i, x, lane }) => (
          <div key={i.id} className="group absolute" style={{ left: `${x * 100}%`, top: lane * LANE_H + 1, transform: 'translateX(-50%)' }}>
            <button
              onClick={() => onOpen(i.id)}
              aria-label={`${TYPE_LABEL[i.type]} à ${hourMinute(i.createdAt)}, ${STATUS_LABEL[i.status]}`}
              className={`grid size-6 place-items-center rounded-full ${i.id === selectedId ? 'ring-2 ring-white' : ''}`}
            >
              <TypeShape type={i.type} size={20} />
            </button>
            <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-[1200] mb-1 hidden w-56 -translate-x-1/2 rounded-lg border border-line bg-surface-2 p-2 text-xs shadow-lg group-hover:block group-focus-within:block">
              <strong>{TYPE_LABEL[i.type]}</strong> · {hourMinute(i.createdAt)} · {STATUS_LABEL[i.status]}
              <br />{i.description}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
})
