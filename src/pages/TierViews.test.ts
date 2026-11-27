import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TierPart } from '../lib/tier'
import { TierBadge, TierParts, TierTable } from './TierViews'

const count = (h: string, re: RegExp) => (h.match(re) ?? []).length
const part = (k: string, n: number, unit: number, cap: number | null, hz: number): TierPart => ({ k, n, unit, cap, hz })
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

describe('TierBadge', () => {
  const badge = (hz: number | null | undefined) => renderToStaticMarkup(createElement(TierBadge, { hz }))
  it('점수에 맞는 등급 이름과 색 이름을 붙인다', () => {
    expect(badge(0)).toContain('루키')
    expect(badge(0)).toContain('tier-rookie')
    expect(badge(50)).toContain('크루')
    expect(badge(50)).toContain('tier-crew')
    expect(badge(200)).toContain('tier-core')
    expect(badge(450)).toContain('tier-boss')
    expect(badge(750)).toContain('빌런')
    expect(badge(750)).toContain('tier-villain')
  })
  it('점수가 없으면 가장 낮은 등급', () => {
    expect(badge(null)).toContain('루키')
    expect(badge(undefined)).toContain('루키')
  })
})

describe('TierTable', () => {
  const table = (hz: number) => renderToStaticMarkup(createElement(TierTable, { hz }))
  it('등급 다섯 개와 기준 점수를 보여 준다', () => {
    const h = table(0)
    expect(count(h, /data-test="tier-row"/g)).toBe(5)
    for (const t of ['루키', '크루', '코어', '보스', '빌런', '0 ~ 49 Hz', '50 ~ 199 Hz', '200 ~ 449 Hz', '450 ~ 749 Hz', '750 Hz 이상']) expect(h).toContain(t)
  })
  it('내 등급 한 줄에만 표시가 붙는다', () => {
    const h = table(52)
    expect(count(h, /data-on="1"/g)).toBe(1)
    expect(count(h, /내 등급/g)).toBe(1)
    expect(h.indexOf('data-on="1"')).toBeGreaterThan(h.indexOf('루키'))
    expect(h.indexOf('data-on="1"')).toBeLessThan(h.indexOf('크루'))
  })
})

describe('TierParts', () => {
  const view = (parts: TierPart[]) => renderToStaticMarkup(createElement(TierParts, { parts }))
  it('기준 세 개로 묶고 묶음마다 점수를 보여 준다', () => {
    const h = view(PARTS)
    for (const t of ['홍보·인지도', '활동 기간', '신뢰도', '32 Hz', '25 Hz', '−5 Hz']) expect(h).toContain(t)
    expect(count(h, /data-test="tier-part"/g)).toBe(8)
  })
  it('항목 이름·계산 줄·세는 방법을 보여 준다', () => {
    const h = view(PARTS)
    for (const t of ['쓴 글', '2개 × 5 Hz = 10 Hz · 최대 100 Hz', '숨겨진 글은 빼요', '운영자가 조치한 신고', '1건 × −50 Hz = −50 Hz']) expect(h).toContain(t)
  })
  it('감점 항목에만 감점 표시가 붙는다', () => {
    expect(count(view(PARTS), /class="tier-part minus"/g)).toBe(1)
    expect(count(view(PARTS.slice(0, 7)), /class="tier-part minus"/g)).toBe(0)
  })
  it('내역이 없으면 안내 문구', () => {
    expect(view([])).toContain('아직 점수 내역이 없어요')
  })
  it('모르는 항목은 보여 주지 않는다', () => {
    const h = view([part('new', 1, 1, 1, 1), PARTS[0]])
    expect(count(h, /data-test="tier-part"/g)).toBe(1)
  })
})
