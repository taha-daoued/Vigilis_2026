/** Export CSV côté client : échappe les guillemets, virgules et retours à la ligne. */
const cell = (v: string | number | null | undefined): string => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

/** Déclenche le téléchargement dans le navigateur (BOM UTF-8 pour Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
