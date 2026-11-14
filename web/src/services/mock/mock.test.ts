import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_ADMIN, DEMO_USER } from '../../lib/seeds'
import { falseAlarmShare } from '../../lib/stats'
import { mockServices } from './index'

const { incidents, sos, prefs } = mockServices

describe('services mock : données de départ', () => {
  beforeEach(async () => {
    await incidents.reset()
  })

  it('couvrent 4 types et 3 statuts, vol expérimental', async () => {
    const list = await incidents.list()
    expect(list.length).toBeGreaterThanOrEqual(12)
    expect(new Set(list.map((i) => i.type))).toEqual(new Set(['violence', 'chute', 'sos', 'vol']))
    expect(new Set(list.map((i) => i.status))).toEqual(new Set(['nouveau', 'en_cours', 'cloture']))
    expect(list.filter((i) => i.type === 'vol').every((i) => i.experimental)).toBe(true)
  })

  it('donnent une résolution à tous les incidents clos, avec des fausses alertes', async () => {
    const closed = (await incidents.list()).filter((i) => i.status === 'cloture')
    expect(closed.every((i) => i.resolution)).toBe(true)
    const { share } = falseAlarmShare(closed)
    expect(share).toBeGreaterThan(0)
    expect(share).toBeLessThan(0.5)
  })

  it('ont 5 caméras dont une hors ligne', async () => {
    const cams = await incidents.listCameras()
    expect(cams).toHaveLength(5)
    expect(cams.filter((c) => !c.online)).toHaveLength(1)
  })
})

describe('services mock : SOS et workflow', () => {
  beforeEach(async () => {
    await incidents.reset()
  })

  it('un SOS crée un incident sans score, avec réception après envoi', async () => {
    const before = (await incidents.list()).length
    const inc = await sos.send(DEMO_USER, { lat: 6.5, lng: 3.4 }, 'test')
    expect(inc).toMatchObject({ type: 'sos', source: 'app', status: 'nouveau', userId: DEMO_USER.id })
    expect(inc.score).toBeUndefined()
    expect(+new Date(inc.receivedAt)).toBeGreaterThanOrEqual(+new Date(inc.createdAt))
    expect((await incidents.list()).length).toBe(before + 1)
  })

  it('un SOS sans position est accepté (GPS révoqué)', async () => {
    const inc = await sos.send(DEMO_USER, null, 'non partagée')
    expect(inc.position).toBeNull()
    expect(inc.description).toContain('sans position')
  })

  it('la clôture exige une résolution', async () => {
    const inc = await sos.send(DEMO_USER, null, 'x')
    await expect(incidents.setStatus(inc.id, 'cloture', DEMO_ADMIN)).rejects.toThrow(/Résolution obligatoire/)
  })

  it("le workflow assigne l'admin, horodate et journalise la résolution", async () => {
    const inc = await sos.send(DEMO_USER, { lat: 6.5, lng: 3.4 }, 'test')
    const taken = await incidents.setStatus(inc.id, 'en_cours', DEMO_ADMIN)
    expect(taken.assignedTo).toBe(DEMO_ADMIN.name)
    expect(taken.takenAt).toBeDefined()
    const closed = await incidents.setStatus(inc.id, 'cloture', DEMO_ADMIN, 'fausse_alerte')
    expect(closed).toMatchObject({ status: 'cloture', resolution: 'fausse_alerte' })
    expect(closed.closedAt).toBeDefined()
    const actions = (await incidents.listLogs()).filter((l) => l.incidentId === inc.id).map((l) => l.action)
    expect(actions).toEqual(['SOS reçu', 'Passé en cours (assigné)', 'Clôturé', 'Résolution : Fausse alerte'])
  })

  it('rouvrir efface la prise en charge et la résolution', async () => {
    const inc = await sos.send(DEMO_USER, null, 'x')
    await incidents.setStatus(inc.id, 'cloture', DEMO_ADMIN, 'confirme')
    const reopened = await incidents.setStatus(inc.id, 'nouveau', DEMO_ADMIN)
    expect(reopened).toMatchObject({ status: 'nouveau', takenAt: undefined, closedAt: undefined, resolution: undefined })
  })

  it('refuse un incident inconnu', async () => {
    await expect(incidents.setStatus('inexistant', 'en_cours', DEMO_ADMIN)).rejects.toThrow()
  })

  it('les abonnés sont prévenus à chaque changement', async () => {
    let calls = 0
    const off = incidents.subscribe(() => calls++)
    await sos.send(DEMO_USER, null, 'x')
    off()
    expect(calls).toBeGreaterThan(0)
  })
})

describe('services mock : panne caméra, santé, préférences, réinitialisation', () => {
  beforeEach(async () => {
    await incidents.reset()
  })

  it('une panne simulée met une caméra hors ligne, se journalise et se rétablit', async () => {
    const onlineBefore = (await incidents.listCameras()).filter((c) => c.online).length
    const cam = await incidents.simulateCameraOutage(DEMO_ADMIN)
    expect(cam).not.toBeNull()
    expect((await incidents.listCameras()).filter((c) => c.online)).toHaveLength(onlineBefore - 1)
    expect((await incidents.listLogs()).some((l) => l.kind === 'panne_camera' && l.incidentId === null)).toBe(true)
    expect(await incidents.restoreCameras(DEMO_ADMIN)).toBe(1)
    expect((await incidents.listCameras()).filter((c) => c.online)).toHaveLength(onlineBefore)
    expect((await incidents.listLogs()).some((l) => l.kind === 'retablissement')).toBe(true)
  })

  it('« Rétablir » ne touche pas la caméra hors ligne de départ', async () => {
    expect(await incidents.restoreCameras(DEMO_ADMIN)).toBe(0)
    expect((await incidents.listCameras()).filter((c) => !c.online)).toHaveLength(1)
  })

  it('la santé devient dégradée si plus aucune caméra n\'est en ligne', async () => {
    while (await incidents.simulateCameraOutage(DEMO_ADMIN)) { /* toutes les caméras en ligne tombent */ }
    expect((await incidents.getHealth()).aiService).toBe('degrade')
  })

  it("un incident détecté enregistre une latence simulée", async () => {
    await incidents.createDetected({ type: 'violence', score: 0.8, position: { lat: 6.5, lng: 3.4 }, description: 'test', windowsConfirmed: 3 })
    const h = await incidents.getHealth()
    expect(h.lastLatencyMs).toBeGreaterThan(0)
  })

  it('les préférences sont mises à jour puis remises à zéro par la réinitialisation', async () => {
    await prefs.update(DEMO_USER.id, { gpsConsent: true, shareCamerasOnMap: true })
    expect((await prefs.getAll())[DEMO_USER.id]).toMatchObject({ gpsConsent: true, shareCamerasOnMap: true })
    await incidents.reset(DEMO_ADMIN)
    expect((await prefs.getAll())[DEMO_USER.id]).toMatchObject({ gpsConsent: null, shareCamerasOnMap: false })
  })

  it('la réinitialisation trace une entrée d\'audit et efface les résolutions ajoutées', async () => {
    const inc = await sos.send(DEMO_USER, null, 'x')
    await incidents.setStatus(inc.id, 'cloture', DEMO_ADMIN, 'confirme')
    await incidents.reset(DEMO_ADMIN)
    const logs = await incidents.listLogs()
    expect(logs.filter((l) => l.kind === 'reinitialisation')).toHaveLength(1)
    expect((await incidents.list()).some((i) => i.id === inc.id)).toBe(false)
  })
})
