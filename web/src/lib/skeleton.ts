// Squelette simulé à 17 points (ordre COCO) dessiné au-dessus des vignettes d'incident.
// Coordonnées locales dans la même échelle que les silhouettes de IncidentThumb.
export type Point = [number, number]

const BASE: Point[] = [
  [0, -26], // 0 nez
  [-2, -28], [2, -28], // 1-2 yeux
  [-5, -26], [5, -26], // 3-4 oreilles
  [-7, -16], [7, -16], // 5-6 épaules
  [-12, -6], [12, -6], // 7-8 coudes
  [-17, 1], [17, 1], // 9-10 poignets
  [-4, 7], [4, 7], // 11-12 hanches
  [-5, 17], [5, 17], // 13-14 genoux
  [-6, 26], [6, 26], // 15-16 chevilles
]

export const BONES: [number, number][] = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 5], [0, 6],
]

/** Points du squelette placés en (cx, cy), inclinés de `angleDeg` degrés. */
export function skeletonPoints(cx: number, cy: number, angleDeg = 0): Point[] {
  const a = (angleDeg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return BASE.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos])
}
