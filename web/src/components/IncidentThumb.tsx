// Vignettes d'incident générées en SVG : silhouettes stylisées, aucun vrai visage ni vraie image.
// Les zones de visage sont floutées pour illustrer le principe de protection de la vie privée.
import type { IncidentType } from '../services'

function parse(url: string): { type: IncidentType; variant: number } {
  const [, type, variant] = url.split(':')
  return { type: (type as IncidentType) ?? 'violence', variant: Number(variant) || 0 }
}

const Person = ({ x, y, lean = 0, color = '#94a3b8' }: { x: number; y: number; lean?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${lean})`}>
    <circle cx="0" cy="-26" r="7" fill={color} filter="url(#blur)" />
    <rect x="-7" y="-17" width="14" height="24" rx="5" fill={color} />
    <path d="M-7 -14 L-17 0 M7 -14 L17 -2" stroke={color} strokeWidth="5" strokeLinecap="round" />
    <path d="M-4 7 L-6 26 M4 7 L6 26" stroke={color} strokeWidth="5" strokeLinecap="round" />
  </g>
)

export function IncidentThumb({ url, className = '' }: { url: string; className?: string }) {
  const { type, variant } = parse(url)
  const shift = (variant % 4) * 6
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label={`Vignette simulée : ${type} (visages floutés)`} className={`w-full rounded-lg ${className}`}>
      <defs>
        <filter id="blur"><feGaussianBlur stdDeviation="2.6" /></filter>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e293b" /><stop offset="1" stopColor="#0f172a" /></linearGradient>
      </defs>
      <rect width="160" height="100" fill="url(#bg)" />
      <rect y="78" width="160" height="22" fill="#0b1220" />
      {type === 'violence' && (<><Person x={62 + shift} y={62} lean={-12} color="#cbd5e1" /><Person x={92 + shift} y={62} lean={12} color="#94a3b8" /></>)}
      {type === 'chute' && (<><g transform={`translate(${70 + shift} 80) rotate(-84)`}><Person x={0} y={0} color="#cbd5e1" /></g><Person x={128} y={62} color="#64748b" /></>)}
      {type === 'vol' && (<><rect x="14" y="20" width="44" height="4" fill="#475569" /><rect x="14" y="40" width="44" height="4" fill="#475569" /><rect x="14" y="60" width="44" height="4" fill="#475569" /><Person x={92 + shift} y={62} lean={6} color="#cbd5e1" /><rect x="104" y="56" width="12" height="9" fill="#0d9488" /></>)}
      {type === 'sos' && (<><rect x="62" y="14" width="36" height="66" rx="6" fill="none" stroke="#cbd5e1" strokeWidth="3" /><circle cx="80" cy="44" r="12" fill="#7c3aed" /><text x="80" y="49" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">SOS</text></>)}
      <text x="6" y="94" fontSize="7" fill="#a3b0c8">Illustration simulée · visages floutés</text>
    </svg>
  )
}
