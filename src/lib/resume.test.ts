import { describe, expect, it } from 'vitest'
import { cleanToken, resumeFeeding, resumePath, resumeWeight, type Resume } from './resume'

describe('cleanToken', () => {
  it('영문·숫자 16자를 대문자로 돌려준다', () => {
    expect(cleanToken('abcd2345efgh6789')).toBe('ABCD2345EFGH6789')
  })
  it('길이가 다르거나 다른 글자가 있으면 null', () => {
    expect(cleanToken('ABCD2345EFGH678')).toBeNull()
    expect(cleanToken('ABCD2345EFGH678!')).toBeNull()
    expect(cleanToken('ABCD2345EFGH67890')).toBeNull()
    expect(cleanToken('')).toBeNull()
    expect(cleanToken(undefined)).toBeNull()
  })
})

describe('resumePath', () => {
  it('/r/<토큰>', () => {
    expect(resumePath('ABCD2345EFGH6789')).toBe('/r/ABCD2345EFGH6789')
  })
})

describe('resumeWeight', () => {
  it('기록이 없으면 빈 요약', () => {
    expect(resumeWeight([])).toEqual({ count: 0, last: null, lastDay: null, gain: null, pts: [] })
  })
  it('최근 값, 첫 측정 대비 변화, 그래프 점', () => {
    expect(
      resumeWeight([
        { d: '2026-10-01', g: 10 },
        { d: '2026-10-15', g: 12.5 },
        { d: '2026-11-01', g: 15 },
      ]),
    ).toEqual({ count: 3, last: 15, lastDay: '2026-11-01', gain: 5, pts: [10, 12.5, 15] })
  })
  it('한 번만 쟀으면 변화는 없다(null)', () => {
    expect(resumeWeight([{ d: '2026-11-01', g: 15 }])).toMatchObject({ count: 1, last: 15, gain: null })
  })
  it('그래프 점은 최근 12개', () => {
    const ws = Array.from({ length: 20 }, (_, i) => ({ d: `2026-10-${String(i + 1).padStart(2, '0')}`, g: i + 1 }))
    const r = resumeWeight(ws)
    expect(r.count).toBe(20)
    expect(r.pts).toHaveLength(12)
    expect(r.pts[0]).toBe(9)
    expect(r.pts[11]).toBe(20)
  })
  it('변화는 소수 첫째 자리까지', () => {
    expect(resumeWeight([{ d: '2026-10-01', g: 10.1 }, { d: '2026-11-01', g: 10.4 }]).gain).toBe(0.3)
  })
})

describe('resumeFeeding', () => {
  const T = '2026-11-27'
  const f = (d: string, r: Resume['feedings'][number]['r'], food = '') => ({ d, r, f: food })
  it('기록이 없으면 빈 요약', () => {
    expect(resumeFeeding([], T)).toEqual({ days: 0, ate: 0, refused: 0, foods: [], lastDay: null })
  })
  it('최근 30일만 세고, 일부 먹음은 먹음으로 센다', () => {
    const fs = [
      f('2026-10-01', 'ate', '귀뚜라미'),
      f('2026-11-10', 'ate', '와구와구 Signature'),
      f('2026-11-12', 'partial', '와구와구 Signature'),
      f('2026-11-12', 'refused', '귀뚜라미'),
      f('2026-11-20', 'unknown'),
    ]
    expect(resumeFeeding(fs, T)).toEqual({
      days: 3,
      ate: 2,
      refused: 1,
      foods: ['와구와구 Signature', '귀뚜라미'],
      lastDay: '2026-11-20',
    })
  })
  it('30일 경계: 29일 전은 넣고 30일 전은 뺀다', () => {
    expect(resumeFeeding([f('2026-10-29', 'ate', 'a')], T).ate).toBe(1)
    expect(resumeFeeding([f('2026-10-28', 'ate', 'a')], T).ate).toBe(0)
  })
  it('30일 안에 기록이 없어도 마지막 기록일은 알려 준다', () => {
    expect(resumeFeeding([f('2026-09-01', 'ate', 'a')], T)).toEqual({ days: 0, ate: 0, refused: 0, foods: [], lastDay: '2026-09-01' })
  })
  it('먹이는 많이 기록된 순으로 3개까지', () => {
    const fs = [
      f('2026-11-20', 'ate', 'a'),
      f('2026-11-21', 'ate', 'b'),
      f('2026-11-22', 'ate', 'b'),
      f('2026-11-23', 'ate', 'c'),
      f('2026-11-24', 'ate', 'c'),
      f('2026-11-25', 'ate', 'c'),
      f('2026-11-26', 'ate', 'd'),
      f('2026-11-27', 'ate', 'd'),
    ]
    expect(resumeFeeding(fs, T).foods).toEqual(['c', 'b', 'd'])
  })
})
