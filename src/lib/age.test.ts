import { describe, expect, it } from 'vitest'
import { ageParts } from './age'

describe('ageParts', () => {
  it('한 달이 안 되면 일', () => expect(ageParts('2026-11-20', '2026-11-28')).toEqual([{ n: 8, u: '일' }]))
  it('두 해가 안 되면 개월', () => {
    expect(ageParts('2026-03-12', '2026-11-28')).toEqual([{ n: 8, u: '개월' }])
    expect(ageParts('2025-01-30', '2026-11-28')).toEqual([{ n: 21, u: '개월' }])
  })
  it('두 해부터는 년과 남은 개월', () => {
    expect(ageParts('2024-03-12', '2026-11-28')).toEqual([{ n: 2, u: '년' }, { n: 8, u: '개월' }])
    expect(ageParts('2024-11-28', '2026-11-28')).toEqual([{ n: 2, u: '년' }])
  })
  it('날짜의 일이 아직 안 지났으면 한 달 덜 센다', () => expect(ageParts('2026-03-29', '2026-11-28')).toEqual([{ n: 7, u: '개월' }]))
  it('해칭일이 없거나 앞날이면 빈 목록', () => {
    expect(ageParts(null, '2026-11-28')).toEqual([])
    expect(ageParts('2026-12-01', '2026-11-28')).toEqual([])
  })
})
