import { describe, expect, it } from 'vitest'
import { REQUIRED_WINDOWS, THRESHOLDS, evaluateWindows } from './decision'

describe('moteur de décision (seuil + fenêtres consécutives)', () => {
  it("ne déclenche pas sur une pointe isolée", () => {
    expect(evaluateWindows([0.1, 0.9, 0.1], THRESHOLDS.violence).triggered).toBe(false)
  })
  it('ne déclenche pas avec moins de fenêtres que requis', () => {
    expect(evaluateWindows([0.8, 0.8], THRESHOLDS.violence).triggered).toBe(false)
  })
  it(`déclenche après ${REQUIRED_WINDOWS} fenêtres consécutives au-dessus du seuil`, () => {
    const r = evaluateWindows([0.2, 0.8, 0.8, 0.8], THRESHOLDS.violence)
    expect(r).toEqual({ consecutive: 3, triggered: true })
  })
  it('compte à partir de la fenêtre la plus récente', () => {
    expect(evaluateWindows([0.9, 0.9, 0.9, 0.2], THRESHOLDS.violence).consecutive).toBe(0)
  })
  it('le seuil est inclusif', () => {
    expect(evaluateWindows([0.7, 0.7, 0.7], 0.7).triggered).toBe(true)
  })
})
