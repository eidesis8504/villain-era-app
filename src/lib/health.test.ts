import { describe, expect, it } from 'vitest'
import type { Feeding } from './feeding'
import { buildConsult, type HealthLog, type VetVisit } from './health'

const W = (d: string, g: number) => ({ measured_on: d, grams: g })
const log = (id: number, d: string, area: HealthLog['area'], level: 1 | 2 | 3, note = ''): HealthLog => ({
  id, animal_id: 'a', logged_on: d, area, level, note, photos: [], resolved_on: null,
})
const visit = (id: number, d: string, clinic: string, diagnosis: string): VetVisit => ({
  id, animal_id: 'a', visited_on: d, clinic, diagnosis, treatment: '', cost: null, next_visit: null,
})
const feed = (id: number, d: string, result: Feeding['result']): Feeding => ({ id, animal_id: 'a', fed_on: d, result, food: '', amount: '', note: '' })

describe('buildConsult', () => {
  const base = { label: '라떼 VE-1', weights: [], feeds: [], logs: [], visits: [], today: '2026-11-19' }

  it('체중은 최근 8회만, 마지막이 최신', () => {
    const weights = Array.from({ length: 10 }, (_, i) => W(`2026-11-${String(i + 1).padStart(2, '0')}`, 40 + i))
    const c = buildConsult({ ...base, weights })
    expect(c.weights).toEqual([42, 43, 44, 45, 46, 47, 48, 49])
    expect(c.lastW).toBe('49.0 g')
  })
  it('증상은 최근 30일(오늘 포함)만 최신순', () => {
    const c = buildConsult({
      ...base,
      logs: [log(1, '2026-10-19', '눈', 1), log(2, '2026-10-20', '피부·비늘', 2, '딱지'), log(3, '2026-11-18', '변·요산', 3)],
    })
    expect(c.symptoms).toEqual([
      { d: '2026-11-18', area: '변·요산', level: 3, note: '' },
      { d: '2026-10-20', area: '피부·비늘', level: 2, note: '딱지' },
    ])
  })
  it('진료는 가장 최근 1건', () => {
    const c = buildConsult({ ...base, visits: [visit(1, '2026-10-01', 'A병원', '탈수'), visit(2, '2026-11-02', 'B병원', '기생충')] })
    expect(c.vet).toEqual({ d: '2026-11-02', clinic: 'B병원', diagnosis: '기생충' })
  })
  it('급여 기록이 없으면 비어 있다', () => {
    const c = buildConsult(base)
    expect(c.lastFed).toBeNull()
    expect(c.lastFedResult).toBeNull()
    expect(c.refuseStreak).toBe(0)
    expect(c.vet).toBeNull()
  })
  it('급여 요약을 담는다', () => {
    const c = buildConsult({ ...base, feeds: [feed(1, '2026-11-10', 'ate'), feed(2, '2026-11-15', 'refused'), feed(3, '2026-11-17', 'refused')] })
    expect(c).toMatchObject({ lastFed: '2026-11-17', lastFedResult: '거부', refuseStreak: 2 })
  })
})
