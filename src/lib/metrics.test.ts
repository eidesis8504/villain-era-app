import { describe, expect, it } from 'vitest'
import { judge, MIN_SAMPLE } from './metrics'

describe('judge', () => {
  it('표본이 20명 미만이면 판정하지 않는다', () => {
    expect(MIN_SAMPLE).toBe(20)
    expect(judge(80, 40, 19)).toBe('small')
  })
  it('기준 이상이면 통과, 미만이면 미달', () => {
    expect(judge(40, 40, 20)).toBe('pass')
    expect(judge(39.9, 40, 100)).toBe('fail')
  })
  it('값이 없으면 표본 부족으로 본다', () => {
    expect(judge(null, 40, 50)).toBe('small')
  })
})
