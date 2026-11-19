import { describe, expect, it } from 'vitest'
import { SPLASH_ART } from '../app/splashArt'
import { pickIndex, sizesOf, srcSetOf } from './splash'

describe('pickIndex: 앱을 켤 때마다 무작위 1장', () => {
  it('0 이상 1 미만의 난수를 6장에 고르게 나눈다', () => {
    const counts = Array<number>(6).fill(0)
    for (let i = 0; i < 600; i++) counts[pickIndex(i / 600, 6)]++
    expect(counts).toEqual([100, 100, 100, 100, 100, 100])
  })
  it('경계값·이상한 값에서도 범위를 벗어나지 않는다', () => {
    expect(pickIndex(0, 6)).toBe(0)
    expect(pickIndex(0.9999999, 6)).toBe(5)
    expect(pickIndex(1, 6)).toBe(5)
    expect(pickIndex(-0.2, 6)).toBe(0)
    expect(pickIndex(Number.NaN, 6)).toBe(0)
  })
})

describe('화면에 맞는 크기 파일 하나만 받기', () => {
  it('srcset 문자열', () => {
    expect(
      srcSetOf([
        { url: '/a.webp', w: 720 },
        { url: '/b.webp', w: 1080 },
      ]),
    ).toBe('/a.webp 720w, /b.webp 1080w')
  })
  it('화면이 그림보다 길쭉하면 화면 너비, 아니면 화면 높이 × 그림 비율 (올림)', () => {
    expect(sizesOf(0.7105)).toBe('(max-aspect-ratio: 711/1000) 100vw, 72vh')
    expect(sizesOf(0.8)).toBe('(max-aspect-ratio: 800/1000) 100vw, 80vh')
  })
})

describe('SPLASH_ART (scripts/make-splash.py가 만든 목록)', () => {
  it('카드엽서 6장, 각각 크기별 파일(작은 것부터)과 흐린 배경이 있다', () => {
    expect(SPLASH_ART.map((a) => a.slug)).toEqual([
      'go-space',
      'spooky-forest',
      'nightmare',
      'new-caledonia',
      'incursion',
      'breaking-bad',
    ])
    for (const a of SPLASH_ART) {
      const widths = a.sources.map((s) => s.w)
      expect(widths.length).toBeGreaterThan(0)
      expect(widths).toEqual([...widths].sort((x, y) => x - y))
      expect(a.backdrop.startsWith('data:image/webp;base64,')).toBe(true)
      expect(a.ratio).toBeGreaterThan(0.6)
      expect(a.ratio).toBeLessThan(0.85)
    }
  })
})
