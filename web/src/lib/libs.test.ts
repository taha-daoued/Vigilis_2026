import { describe, expect, it } from 'vitest'
import type { Incident } from '../services/types'
import { toCsv } from './csv'
import { formatDuration } from './format'
import { comparePriority, isOverdue, sortByPriority, waitSeconds } from './priority'
import { distanceMeters, nearbyIncidents } from './proximity'
import { falseAlarmShare, heatmap, meanTakeSeconds, weekdayIndex } from './stats'

const base = (o: Partial<Incident>): Incident => ({
  id: 'x', type: 'violence', score: 0.8, status: 'nouveau', createdAt: '2026-11-14T10:00:00.000Z', receivedAt: '2026-11-14T10:00:00.000Z',
  position: { lat: 6.5244, lng: 3.3792 }, source: 'camera', imageUrl: 'svg:violence:0', description: '', windowsConfirmed: 3, ...o,
})

describe('file de priorité', () => {
  it('place le SOS avant une détection, même avec un score plus bas', () => {
    const sos = base({ id: 'sos', type: 'sos', score: undefined })
    const det = base({ id: 'det', score: 0.99 })
    expect(sortByPriority([det, sos]).map((i) => i.id)).toEqual(['sos', 'det'])
  })
  it('puis le score décroissant, puis le plus ancien', () => {
    const a = base({ id: 'a', score: 0.7 })
    const b = base({ id: 'b', score: 0.9 })
    const c = base({ id: 'c', score: 0.9, receivedAt: '2026-11-14T09:00:00.000Z' })
    expect(sortByPriority([a, b, c]).map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })
  it('met les incidents nouveaux avant ceux en cours, et les clos en dernier', () => {
    const closed = base({ id: 'closed', status: 'cloture', type: 'sos', score: undefined })
    const inProgress = base({ id: 'prog', status: 'en_cours', type: 'sos', score: undefined })
    const fresh = base({ id: 'fresh', score: 0.5 })
    expect([closed, inProgress, fresh].sort(comparePriority).map((i) => i.id)).toEqual(['fresh', 'prog', 'closed'])
  })
  it("calcule l'attente et le dépassement du seuil", () => {
    const i = base({})
    const now = new Date('2026-11-14T10:02:10.000Z').getTime()
    expect(waitSeconds(i, now)).toBe(130)
    expect(isOverdue(130, 120)).toBe(true)
    expect(isOverdue(119, 120)).toBe(false)
  })
  it('formate les durées', () => {
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(130)).toBe('2 min 10 s')
    expect(formatDuration(3900)).toBe('1 h 05 min')
  })
})

describe('proximité', () => {
  it('mesure une distance plausible (≈ 111 m pour 0,001° de latitude)', () => {
    const d = distanceMeters({ lat: 6.5, lng: 3.4 }, { lat: 6.501, lng: 3.4 })
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(117)
  })
  it('retient les incidents proches dans le temps OU l\'espace, jamais lui-même', () => {
    const target = base({ id: 't' })
    const closeTime = base({ id: 'ct', createdAt: '2026-11-14T10:05:00.000Z', position: { lat: 7.5, lng: 3.4 } })
    const closeSpace = base({ id: 'cs', createdAt: '2026-11-13T10:00:00.000Z' })
    const far = base({ id: 'far', createdAt: '2026-11-13T10:00:00.000Z', position: { lat: 7.5, lng: 3.4 } })
    const ids = nearbyIncidents(target, [target, closeTime, closeSpace, far]).map((i) => i.id)
    expect(ids).toContain('ct')
    expect(ids).toContain('cs')
    expect(ids).not.toContain('far')
    expect(ids).not.toContain('t')
  })
  it('ignore la proximité spatiale quand une position manque', () => {
    const target = base({ id: 't', position: null })
    const o = base({ id: 'o', createdAt: '2026-11-13T10:00:00.000Z' })
    expect(nearbyIncidents(target, [o])).toEqual([])
  })
})

describe('statistiques', () => {
  it('compte la part de fausses alertes sur les incidents clos avec résolution', () => {
    const list = [
      base({ id: '1', status: 'cloture', resolution: 'confirme' }),
      base({ id: '2', status: 'cloture', resolution: 'fausse_alerte' }),
      base({ id: '3', status: 'cloture', resolution: 'fausse_alerte' }),
      base({ id: '4', status: 'cloture', resolution: 'confirme' }),
      base({ id: '5', status: 'nouveau' }),
    ]
    expect(falseAlarmShare(list)).toEqual({ closed: 4, falseAlarms: 2, share: 0.5 })
  })
  it('renvoie null sans incident clos (pas de faux 0 %)', () => {
    expect(falseAlarmShare([base({})]).share).toBeNull()
  })
  it('calcule le délai moyen de prise en charge', () => {
    const list = [
      base({ id: '1', takenAt: '2026-11-14T10:01:00.000Z' }),
      base({ id: '2', takenAt: '2026-11-14T10:03:00.000Z' }),
      base({ id: '3' }),
    ]
    expect(meanTakeSeconds(list)).toBe(120)
    expect(meanTakeSeconds([base({})])).toBeNull()
  })
  it('place les incidents dans la bonne case jour × heure (lundi = 0)', () => {
    const d = new Date(2026, 10, 16, 14, 30) // lundi 16/11/2026, 14 h 30 (heure locale)
    expect(weekdayIndex(d)).toBe(0)
    const grid = heatmap([base({ createdAt: d.toISOString() }), base({ id: 'y', createdAt: d.toISOString() })])
    expect(grid[0][14]).toBe(2)
    expect(grid.flat().reduce((a, b) => a + b, 0)).toBe(2)
  })
})

describe('export CSV', () => {
  it('échappe guillemets, points-virgules et retours à la ligne', () => {
    expect(toCsv(['a', 'b'], [['x;y', 'dit "ok"'], ['l1\nl2', null]])).toBe('a;b\r\n"x;y";"dit ""ok"""\r\n"l1\nl2";')
  })
})
