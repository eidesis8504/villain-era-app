// 체중·성별·이름 표기 (프로토타입 규칙 그대로)
export function fd(d: number | null | undefined) {
  if (d === null || d === undefined) return '—'
  const a = Math.abs(d)
  return (d > 0 ? '+' : d < 0 ? '−' : '±') + (a >= 1000 ? (a / 1000).toFixed(2) + ' kg' : a.toFixed(1) + ' g')
}

export function fw(g: number | null | undefined) {
  if (g === null || g === undefined || isNaN(g)) return '—'
  return Math.abs(g) >= 1000 ? (g / 1000).toFixed(2) + ' kg' : (+g).toFixed(1) + ' g'
}

export const sexLbl = (s: string) => (s === 'F' ? '암컷' : s === 'M' ? '수컷' : '미구분')
export const sexMark = (s: string) => (s === 'F' ? '♀' : s === 'M' ? '♂' : '–')

export const nm = (a?: { name: string } | null) => (a ? a.name || '이름 없음' : '미등록')

export type AnimalStatus = 'keeping' | 'sold' | 'dead' | 'external'
export const STATUS_LABEL: Record<AnimalStatus, string> = {
  keeping: '사육',
  sold: '분양',
  dead: '폐사',
  external: '외부',
}

export const round1 = (n: number) => Math.round(n * 10) / 10
