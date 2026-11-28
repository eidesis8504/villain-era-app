// 해칭일로 나이를 적는다: 한 달 미만은 일, 두 해 미만은 개월, 그 뒤로는 년과 남은 개월
import { gap } from './date'

export type AgePart = { n: number; u: '일' | '개월' | '년' }

export function ageParts(hatch: string | null | undefined, T: string): AgePart[] {
  if (!hatch || hatch > T) return []
  const [y1, m1, d1] = hatch.split('-').map(Number)
  const [y2, m2, d2] = T.split('-').map(Number)
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
  if (months < 1) return [{ n: gap(hatch, T), u: '일' }]
  if (months < 24) return [{ n: months, u: '개월' }]
  const rest = months % 12
  return [{ n: Math.floor(months / 12), u: '년' }, ...(rest ? [{ n: rest, u: '개월' } as AgePart] : [])]
}
