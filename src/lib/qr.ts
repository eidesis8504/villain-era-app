// QR 라벨: 개체 라벨은 앱 주소(/a/<ID>)를 담아 휴대폰 기본 카메라로도 바로 열린다.
import qrcode from 'qrcode-generator'
import { nm, sexLbl } from './format'

export function qrMatrix(text: string) {
  const q = qrcode(0, 'M')
  q.addData(text)
  q.make()
  const n = q.getModuleCount()
  const cells: boolean[] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push(q.isDark(r, c))
  return { n, cells, q }
}

export const animalQrText = (code: string) => `${location.origin}/a/${encodeURIComponent(code)}`
export const transferUrl = (code: string) => `${location.origin}/transfer?code=${code}`

// 스캔한 문자열 → 개체 ID 또는 분양 코드
export function parseScan(text: string): { kind: 'animal'; code: string } | { kind: 'transfer'; code: string } | null {
  const t = text.trim()
  const tr = /[?&]code=([A-Z0-9]{8})/i.exec(t)
  if (tr && /\/transfer/.test(t)) return { kind: 'transfer', code: tr[1].toUpperCase() }
  const path = /\/a\/([A-Z0-9-]+)/i.exec(t)
  if (path) return { kind: 'animal', code: decodeURIComponent(path[1]).toUpperCase() }
  const m = /VE-[A-Z0-9]+/i.exec(t)
  if (m) return { kind: 'animal', code: m[0].toUpperCase() }
  return null
}

type LabelAnimal = { code: string; name: string; sex: string; morph: string; hatch_date: string | null }

export function labelCanvas(a: LabelAnimal, parents: { sire: string; dam: string }) {
  const { n, q } = qrMatrix(animalQrText(a.code))
  const W = 640
  const H = 360
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')!
  const m = Math.floor(280 / (n + 4))
  const o = 40
  x.fillStyle = '#fff'
  x.fillRect(0, 0, W, H)
  x.fillStyle = '#16181D'
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(o + (k + 2) * m, o + (r + 2) * m, m, m)
  const tx = o + (n + 4) * m + 24
  x.fillStyle = '#0148AB'
  x.font = '600 20px "IBM Plex Mono", monospace'
  x.fillText('VILLAIN ERA', tx, 80)
  x.fillStyle = '#16181D'
  x.font = `700 ${a.code.length > 8 ? 26 : 38}px "IBM Plex Mono", monospace`
  x.fillText(a.code, tx, 130)
  x.font = '700 30px "IBM Plex Sans KR", sans-serif'
  x.fillText(nm(a), tx, 178)
  x.font = '22px "IBM Plex Sans KR", sans-serif'
  x.fillText(`${sexLbl(a.sex)} · ${a.morph || ''}`, tx, 220)
  x.fillStyle = '#6B6F76'
  x.font = '20px "IBM Plex Mono", monospace'
  x.fillText('HATCH ' + (a.hatch_date || '미상'), tx, 260)
  x.fillText('부 ' + parents.sire, tx, 294)
  x.fillText('모 ' + parents.dam, tx, 324)
  return c
}

export function downloadBlob(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 5000)
}
