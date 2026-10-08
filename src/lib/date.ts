// 날짜는 모두 브라우저 기준 'YYYY-MM-DD' 문자열로 다룬다 (프로토타입과 동일)
export const p2 = (n: number) => String(n).padStart(2, '0')
export const ds = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const today = () => ds(new Date())

export function addD(s: string, n: number) {
  const d = new Date(s + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return ds(d)
}

export const gap = (a: string, b: string) =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 864e5)

// 10.08 형식
export const md = (s?: string | null) => (s ? s.slice(5, 10).replace('-', '.') : '')
// 26.10.08 형식
export const yd = (s?: string | null) => (s ? s.slice(2, 10).replace(/-/g, '.') : '')

export function dateLbl(T: string) {
  const d = new Date(T + 'T00:00:00')
  return T.replace(/-/g, '.') + ' ' + ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]
}

export const dow = (s: string) => new Date(s + 'T00:00:00').getDay()

// timestamptz(ISO) → 로컬 날짜 문자열
export const isoDay = (iso: string) => ds(new Date(iso))

export function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return md(isoDay(iso))
}
