import { describe, expect, it } from 'vitest'
import { surveyDue } from './survey'

const CREATED = '2026-11-01T00:00:00Z'

describe('surveyDue', () => {
  it('계정을 만든 지 14일이 지나면 설문을 보여 준다', () => {
    expect(surveyDue(CREATED, new Date('2026-11-15T00:00:01Z'), false, null)).toBe(true)
  })
  it('14일이 안 됐으면 보여 주지 않는다', () => {
    expect(surveyDue(CREATED, new Date('2026-11-14T23:59:00Z'), false, null)).toBe(false)
  })
  it('이미 답했으면 보여 주지 않는다', () => {
    expect(surveyDue(CREATED, new Date('2026-11-20T00:00:00Z'), true, null)).toBe(false)
  })
  it('나중에로 미룬 기간에는 보여 주지 않고, 지나면 다시 보여 준다', () => {
    const snooze = Date.parse('2026-11-21T00:00:00Z')
    expect(surveyDue(CREATED, new Date('2026-11-20T00:00:00Z'), false, snooze)).toBe(false)
    expect(surveyDue(CREATED, new Date('2026-11-21T00:00:01Z'), false, snooze)).toBe(true)
  })
})
