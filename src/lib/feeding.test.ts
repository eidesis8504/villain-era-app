import { describe, expect, it } from 'vitest'
import { feedSummary, type Feeding, type FeedResult } from './feeding'

let seq = 0
const f = (fed_on: string, result: FeedResult): Feeding => ({ id: ++seq, animal_id: 'a', fed_on, result, food: '', amount: '', note: '' })

describe('feedSummary', () => {
  it('기록이 없으면 주기가 있을 때만 확인 필요', () => {
    expect(feedSummary([], 2, '2026-11-19')).toEqual({ last: null, daysSince: null, refuseStreak: 0, overdue: true })
    expect(feedSummary([], null, '2026-11-19').overdue).toBe(false)
  })
  it('마지막 먹음·일부 이후의 거부만 센다 (확인 못함은 끊지도 세지도 않음)', () => {
    const list = [f('2026-11-18', 'refused'), f('2026-11-10', 'ate'), f('2026-11-14', 'unknown'), f('2026-11-12', 'refused'), f('2026-11-16', 'refused')]
    const s = feedSummary(list, 2, '2026-11-19')
    expect(s.refuseStreak).toBe(3)
    expect(s.daysSince).toBe(1)
    expect(s.overdue).toBe(false)
    expect(s.last?.fed_on).toBe('2026-11-18')
  })
  it('일부 먹음도 연속 거부를 끊는다', () => {
    expect(feedSummary([f('2026-11-01', 'refused'), f('2026-11-02', 'partial'), f('2026-11-03', 'refused')], null, '2026-11-04').refuseStreak).toBe(1)
  })
  it('월말·윤년 경계에서 날짜를 정확히 센다', () => {
    expect(feedSummary([f('2026-10-31', 'ate')], 2, '2026-11-01').daysSince).toBe(1)
    expect(feedSummary([f('2028-02-28', 'ate')], 2, '2028-03-01').daysSince).toBe(2)
  })
  it('주기를 넘기면 확인 필요', () => {
    expect(feedSummary([f('2026-11-15', 'ate')], 2, '2026-11-19').overdue).toBe(true)
    expect(feedSummary([f('2026-11-17', 'ate')], 2, '2026-11-19').overdue).toBe(false)
  })
})
