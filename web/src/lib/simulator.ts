// Simulateur d'incidents (V1) : génère un incident toutes les 20 à 40 s, sans bloquer l'interface.
import { incidentsApi } from '../services'
import type { Camera, IncidentType } from '../services'
import { THRESHOLDS } from './decision'
import { DEMO_CENTER, offsetMeters } from './geo'

export type Scenario = Exclude<IncidentType, 'sos'>

const DESCRIPTIONS: Record<Scenario, string[]> = {
  violence: [
    "Deux personnes semblent se battre près de l'entrée.",
    'Altercation physique détectée dans le couloir.',
    'Bousculade violente observée devant le guichet.',
  ],
  chute: [
    'Une personne est tombée et reste immobile au sol.',
    'Malaise possible : personne au sol depuis plus de 10 secondes.',
    "Chute détectée dans l'escalier, aucune réaction visible.",
  ],
  vol: [
    'Geste suspect près des rayonnages (module expérimental, à vérifier).',
    'Objet possiblement dissimulé (module expérimental, non confirmé).',
  ],
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

export async function triggerScenario(type: Scenario, cameras: Camera[]): Promise<void> {
  const online = cameras.filter((c) => c.online)
  const camera = pick(online.length ? online : cameras)
  const threshold = THRESHOLDS[type]
  // Score simulé : juste au-dessus du seuil (plus bas pour le vol expérimental).
  const score = Math.min(0.97, threshold + 0.03 + Math.random() * (type === 'vol' ? 0.12 : 0.22))
  await incidentsApi.createDetected({
    type,
    score: Number(score.toFixed(2)),
    position: camera ? offsetMeters(camera.position, Math.random() * 16 - 8, Math.random() * 16 - 8) : DEMO_CENTER,
    cameraId: camera?.id,
    description: pick(DESCRIPTIONS[type]),
    windowsConfirmed: 3 + Math.floor(Math.random() * 3),
  })
}

export function randomScenario(): Scenario {
  const r = Math.random()
  return r < 0.4 ? 'violence' : r < 0.8 ? 'chute' : 'vol'
}

/** Lance le simulateur ; renvoie la fonction d'arrêt. */
export function startSimulator(getCameras: () => Camera[]): () => void {
  let timer: ReturnType<typeof setTimeout>
  const schedule = () => {
    timer = setTimeout(async () => {
      await triggerScenario(randomScenario(), getCameras())
      schedule()
    }, 20_000 + Math.random() * 20_000)
  }
  schedule()
  return () => clearTimeout(timer)
}
