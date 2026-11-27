import { describe, expect, it } from 'vitest'
import { groupParts, HZ_MAX, hzText, nextTier, parseTier, PART_INFO, partLine, tierOf, tierProgress, TIERS, type TierPart } from './tier'

describe('tierOf', () => {
  const name = (hz: number) => tierOf(hz).name
  it('기준 점수 바로 앞뒤에서 등급이 바뀐다', () => {
    expect([0, 49].map(name)).toEqual(['루키', '루키'])
    expect([50, 199].map(name)).toEqual(['크루', '크루'])
    expect([200, 449].map(name)).toEqual(['코어', '코어'])
    expect([450, 749].map(name)).toEqual(['보스', '보스'])
    expect([750, 1000].map(name)).toEqual(['빌런', '빌런'])
  })
  it('값이 없거나 이상하면 가장 낮은 등급', () => {
    for (const v of [null, undefined, -5, NaN]) expect(tierOf(v).key).toBe('rookie')
  })
  it('소수는 버리고 본다', () => {
    expect(tierOf(49.9).key).toBe('rookie')
  })
  it('상한을 넘는 값도 가장 높은 등급', () => {
    expect(tierOf(5000).key).toBe('villain')
  })
})

describe('nextTier', () => {
  it('다음 등급과 남은 점수', () => {
    expect(nextTier(0)).toEqual({ tier: TIERS[1], left: 50 })
    expect(nextTier(52)).toEqual({ tier: TIERS[2], left: 148 })
    expect(nextTier(749)).toEqual({ tier: TIERS[4], left: 1 })
  })
  it('가장 높은 등급이면 없다', () => {
    expect(nextTier(750)).toBeNull()
    expect(nextTier(1000)).toBeNull()
  })
  it('값이 없으면 루키에서 시작한다', () => {
    expect(nextTier(null)).toEqual({ tier: TIERS[1], left: 50 })
  })
})

describe('tierProgress', () => {
  it('지금 등급 구간에서 다음 등급까지 얼마나 왔는지 0~1', () => {
    expect(tierProgress(0)).toBe(0)
    expect(tierProgress(25)).toBe(0.5)
    expect(tierProgress(50)).toBe(0)
    expect(tierProgress(125)).toBe(0.5)
    expect(tierProgress(null)).toBe(0)
  })
  it('가장 높은 등급은 1', () => {
    expect(tierProgress(750)).toBe(1)
    expect(tierProgress(1000)).toBe(1)
  })
})

describe('TIERS', () => {
  it('낮은 등급부터 기준 점수가 커지고 상한 안에 있다', () => {
    expect(TIERS.map((t) => t.name)).toEqual(['루키', '크루', '코어', '보스', '빌런'])
    expect(TIERS[0].min).toBe(0)
    for (let i = 1; i < TIERS.length; i++) expect(TIERS[i].min).toBeGreaterThan(TIERS[i - 1].min)
    expect(TIERS[TIERS.length - 1].min).toBeLessThan(HZ_MAX)
  })
})

const part = (k: string, n: number, unit: number, cap: number | null, hz: number): TierPart => ({ k, n, unit, cap, hz })
// 서버 시험(supabase/tests/tier.sql)의 철수와 같은 내역: 합계 52
const PARTS = [
  part('posts', 2, 5, 100, 10),
  part('likes', 1, 2, 200, 2),
  part('adopted', 1, 20, 100, 20),
  part('days', 5, 1, 180, 5),
  part('months', 2, 10, 120, 20),
  part('transfers', 1, 30, 150, 30),
  part('animals', 1, 15, 150, 15),
  part('penalty', 1, -50, null, -50),
]

describe('parseTier', () => {
  it('서버가 준 합계와 내역을 읽는다', () => {
    expect(parseTier({ hz: 52, parts: PARTS })).toEqual({ hz: 52, parts: PARTS })
  })
  it('모양이 틀리면 0과 빈 내역', () => {
    for (const v of [null, undefined, 'x', 3, [], { hz: 'a' }, { parts: 'x' }]) expect(parseTier(v)).toEqual({ hz: 0, parts: [] })
  })
  it('틀린 항목은 버린다', () => {
    const mixed = [PARTS[0], { k: 'likes' }, null, 'x', { k: 1, n: 1, unit: 1, cap: 1, hz: 1 }, { k: 'days', n: 1, unit: 1, cap: 'x', hz: 1 }]
    expect(parseTier({ hz: 10, parts: mixed })).toEqual({ hz: 10, parts: [PARTS[0]] })
  })
  it('합계는 0~1000 사이의 정수로 맞춘다', () => {
    expect(parseTier({ hz: -3, parts: [] }).hz).toBe(0)
    expect(parseTier({ hz: 5000, parts: [] }).hz).toBe(1000)
    expect(parseTier({ hz: 12.7, parts: [] }).hz).toBe(12)
  })
})

describe('PART_INFO', () => {
  it('서버가 내려 주는 항목 8개를 모두 안다', () => {
    expect(Object.keys(PART_INFO)).toEqual(['posts', 'likes', 'adopted', 'days', 'months', 'transfers', 'animals', 'penalty'])
  })
})

describe('hzText', () => {
  it('점수에 단위를 붙이고 음수는 빼기 표시로 쓴다', () => {
    expect(hzText(15)).toBe('15 Hz')
    expect(hzText(0)).toBe('0 Hz')
    expect(hzText(-5)).toBe('−5 Hz')
  })
})

describe('partLine', () => {
  it('개수 × 1개당 점수 = 점수 · 상한', () => {
    expect(partLine(PARTS[0])).toBe('2개 × 5 Hz = 10 Hz · 최대 100 Hz')
    expect(partLine(part('days', 200, 1, 180, 180))).toBe('200일 × 1 Hz = 180 Hz · 최대 180 Hz')
    expect(partLine(PARTS[6])).toBe('1마리 × 15 Hz = 15 Hz · 최대 150 Hz')
  })
  it('감점은 상한 없이 빼기 표시로', () => {
    expect(partLine(PARTS[7])).toBe('1건 × −50 Hz = −50 Hz')
    expect(partLine(part('penalty', 0, -50, null, 0))).toBe('0건 × −50 Hz = 0 Hz')
  })
  it('모르는 항목은 개로 센다', () => {
    expect(partLine(part('new', 3, 4, 20, 12))).toBe('3개 × 4 Hz = 12 Hz · 최대 20 Hz')
  })
})

describe('groupParts', () => {
  it('기준별로 묶고 묶음의 점수를 더한다', () => {
    const g = groupParts(PARTS)
    expect(g.map((x) => x.group)).toEqual(['홍보·인지도', '활동 기간', '신뢰도'])
    expect(g.map((x) => x.hz)).toEqual([32, 25, -5])
    expect(g[2].items.map((p) => p.k)).toEqual(['transfers', 'animals', 'penalty'])
  })
  it('모르는 항목은 빼고, 항목이 없는 기준은 만들지 않는다', () => {
    expect(groupParts([part('new', 1, 1, 1, 1), PARTS[3]])).toEqual([{ group: '활동 기간', hz: 5, items: [PARTS[3]] }])
    expect(groupParts([])).toEqual([])
  })
})
