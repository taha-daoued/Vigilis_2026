import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_ADMIN, DEMO_USER } from '../../lib/seeds'
import { mockServices } from './index'

const { incidents, sos } = mockServices

describe('services mock : SOS et workflow de statut', () => {
  beforeEach(async () => {
    await incidents.reset()
  })

  it('les données de départ couvrent 4 types et 3 statuts', async () => {
    const list = await incidents.list()
    expect(list.length).toBeGreaterThanOrEqual(12)
    expect(new Set(list.map((i) => i.type))).toEqual(new Set(['violence', 'chute', 'sos', 'vol']))
    expect(new Set(list.map((i) => i.status))).toEqual(new Set(['nouveau', 'en_cours', 'cloture']))
    expect(list.filter((i) => i.type === 'vol').every((i) => i.experimental)).toBe(true)
  })

  it("un SOS crée un incident sans score, de source « app », avec un journal", async () => {
    const before = (await incidents.list()).length
    const inc = await sos.send(DEMO_USER, { lat: 6.5, lng: 3.4 }, 'test')
    expect(inc).toMatchObject({ type: 'sos', source: 'app', status: 'nouveau', userId: DEMO_USER.id })
    expect(inc.score).toBeUndefined()
    expect((await incidents.list()).length).toBe(before + 1)
    expect((await incidents.listLogs()).some((l) => l.incidentId === inc.id && l.action === 'SOS reçu')).toBe(true)
  })

  it("le changement de statut assigne l'admin et écrit dans le journal", async () => {
    const inc = await sos.send(DEMO_USER, { lat: 6.5, lng: 3.4 }, 'test')
    const updated = await incidents.setStatus(inc.id, 'en_cours', DEMO_ADMIN)
    expect(updated.status).toBe('en_cours')
    expect(updated.assignedTo).toBe(DEMO_ADMIN.name)
    await incidents.setStatus(inc.id, 'cloture', DEMO_ADMIN)
    const actions = (await incidents.listLogs()).filter((l) => l.incidentId === inc.id).map((l) => l.action)
    expect(actions).toEqual(['SOS reçu', 'Passé en cours (assigné)', 'Clôturé'])
  })

  it('refuse un incident inconnu', async () => {
    await expect(incidents.setStatus('inexistant', 'cloture', DEMO_ADMIN)).rejects.toThrow()
  })

  it('les abonnés sont prévenus à chaque changement', async () => {
    let calls = 0
    const off = incidents.subscribe(() => calls++)
    await sos.send(DEMO_USER, { lat: 6.5, lng: 3.4 }, 'test')
    off()
    expect(calls).toBeGreaterThan(0)
  })
})
