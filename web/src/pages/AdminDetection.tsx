// Illustration du pipeline : squelette simulé + moteur de décision (seuil + fenêtres consécutives).
// Aucune analyse réelle : le service IA (pose + vidéo + règles de chute) viendra plus tard.
import { useEffect, useMemo, useState } from 'react'
import { ExperimentalBadge } from '../components/badges'
import { REQUIRED_WINDOWS, THRESHOLDS, evaluateWindows } from '../lib/decision'

type Scenario = 'violence' | 'chute' | 'vol' | 'normal'

// Score simulé par fenêtre d'environ 1 s (cycle de 10 fenêtres).
const SCRIPT: Record<Scenario, number[]> = {
  violence: [0.15, 0.3, 0.74, 0.8, 0.86, 0.9, 0.88, 0.45, 0.2, 0.1],
  chute: [0.1, 0.2, 0.72, 0.78, 0.84, 0.85, 0.86, 0.3, 0.15, 0.1],
  vol: [0.1, 0.35, 0.55, 0.58, 0.6, 0.57, 0.3, 0.2, 0.1, 0.1],
  normal: [0.08, 0.12, 0.2, 0.15, 0.1, 0.25, 0.18, 0.1, 0.22, 0.12],
}

// 17 points (convention COCO) autour d'un centre, animés légèrement.
function skeleton(cx: number, cy: number, t: number, fallen: boolean): [number, number][] {
  const s = Math.sin(t / 3) * 2
  const pts: [number, number][] = [
    [0, -52], [-3, -55], [3, -55], [-6, -52], [6, -52], [-12, -38], [12, -38], [-17, -22 + s], [17, -22 - s],
    [-20, -8 + s], [20, -8 - s], [-8, -8], [8, -8], [-9, 14], [9, 14], [-9, 36], [9, 36],
  ]
  if (fallen) return pts.map(([x, y]) => [cx + y * 0.9, cy + 36 + x * 0.6])
  return pts.map(([x, y]) => [cx + x, cy + y])
}
const BONES: [number, number][] = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 5], [0, 6]]

export function AdminDetection() {
  const [scenario, setScenario] = useState<Scenario>('violence')
  const [tick, setTick] = useState(0)
  const [frame, setFrame] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  // Fenêtre d'analyse ~ 1 s ; animation du squelette ~ 10 images/s.
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { const id = setInterval(() => setFrame((f) => f + 1), 100); return () => clearInterval(id) }, [])
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])

  const threshold = scenario === 'normal' ? THRESHOLDS.violence : THRESHOLDS[scenario]
  const history = useMemo(() => {
    const script = SCRIPT[scenario]
    const n = tick % script.length
    return script.slice(0, n + 1)
  }, [scenario, tick])
  const score = history[history.length - 1]
  const { consecutive, triggered } = evaluateWindows(history, threshold)

  const changeScenario = (s: Scenario) => { setScenario(s); setTick(0) }
  const onFile = (f?: File) => { if (f) setVideoUrl(URL.createObjectURL(f)) }

  const fallen = scenario === 'chute' && history.length > 3
  const people: [number, number][] = scenario === 'violence' ? [[200, 150], [250, 150]] : scenario === 'chute' ? [[240, 150]] : scenario === 'vol' ? [[240, 150]] : [[160, 150], [330, 150]]
  const color = triggered ? '#f87171' : '#4ade80'

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Détection : démo du pipeline</h1>
      <p className="text-sm text-muted">Illustration : l'analyse réelle sera faite par le service IA (YOLO26-pose + MoViNet + règles de chute).</p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Choix du scénario">
        {(['violence', 'chute', 'vol', 'normal'] as Scenario[]).map((s) => (
          <button key={s} className="btn" aria-pressed={scenario === s} onClick={() => changeScenario(s)} style={scenario === s ? { background: '#1d4ed8', color: '#fff' } : undefined}>
            {s === 'normal' ? 'Scène normale' : s === 'vol' ? 'Vol' : s[0].toUpperCase() + s.slice(1)}
            {s === 'vol' && <ExperimentalBadge />}
          </button>
        ))}
        <label className="btn cursor-pointer">
          Vidéo locale (optionnelle)
          <input type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {videoUrl && <button className="btn" onClick={() => setVideoUrl(null)}>Retirer la vidéo</button>}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-line bg-black">
        {videoUrl ? (
          <video src={videoUrl} autoPlay loop muted playsInline className="aspect-video w-full object-contain" aria-label="Vidéo locale choisie (non envoyée)" />
        ) : (
          <svg viewBox="0 0 480 270" className="aspect-video w-full" role="img" aria-label="Flux simulé avec squelettes">
            <rect width="480" height="270" fill="#0f172a" />
            <rect y="210" width="480" height="60" fill="#0b1220" />
            <text x="10" y="260" fontSize="10" fill="#a3b0c8">Flux simulé (aucune vraie image)</text>
          </svg>
        )}
        <svg viewBox="0 0 480 270" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {!videoUrl && people.map(([x, y], idx) => {
            const pts = skeleton(x, y, frame + idx * 7, fallen)
            return (
              <g key={idx} stroke={color} strokeWidth="2" fill={color}>
                {BONES.map(([a, b], k) => <line key={k} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} />)}
                {pts.map(([px, py], k) => <circle key={k} cx={px} cy={py} r="2.4" />)}
              </g>
            )
          })}
        </svg>
        <div className={`absolute left-0 right-0 top-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-bold ${triggered ? 'bg-[#b91c1c] text-white' : 'bg-black/70 text-white'}`} role="status" aria-live="polite">
          <span>Score courant : {score.toFixed(2)} · Seuil : {threshold}</span>
          <span>Fenêtres consécutives : {Math.min(consecutive, REQUIRED_WINDOWS)}/{REQUIRED_WINDOWS}</span>
          <span>{triggered ? '⚠ ALERTE DÉCLENCHÉE' : 'Pas d\'alerte'}</span>
        </div>
      </div>

      <section className="card p-4" aria-labelledby="regle">
        <h2 id="regle" className="font-bold">Règle du moteur de décision</h2>
        <p className="mt-1 text-sm">L'alerte part seulement si le score dépasse le seuil sur {REQUIRED_WINDOWS} fenêtres d'affilée : une pointe isolée est ignorée, ce qui limite les faux positifs.</p>
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Scores des fenêtres">
          {history.map((s, i) => (
            <li key={i} className={`rounded border px-2 py-1 font-mono text-xs ${s >= threshold ? 'border-danger text-danger' : 'border-line text-muted'}`}>
              {s >= threshold ? '▲' : '▽'} {s.toFixed(2)}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">Scores et seuils : valeurs de démonstration, pas des résultats de modèle. Les vraies valeurs seront calibrées sur le jeu de test.</p>
      </section>
    </div>
  )
}
