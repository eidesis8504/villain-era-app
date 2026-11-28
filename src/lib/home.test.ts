import { describe, expect, it } from 'vitest'
import { dayLabel, homeHeadline, namesLine } from './home'

describe('homeHeadline', () => {
  it('할 일이 없으면 안내', () => expect(homeHeadline(0, 0)).toBe('오늘 예정된 할 일이 없어요'))
  it('모두 마치면', () => expect(homeHeadline(3, 3)).toBe('오늘 할 일을 모두 마쳤어요'))
  it('남아 있으면 개수', () => expect(homeHeadline(3, 1)).toBe('오늘 할 일 3개 중 1개를 마쳤어요'))
  it('하나도 안 했으면', () => expect(homeHeadline(3, 0)).toBe('오늘 할 일이 3개 있어요'))
})
describe('namesLine', () => {
  it('세 개까지는 모두', () => expect(namesLine(['릴리', '모카', '보리'])).toBe('릴리 · 모카 · 보리'))
  it('넘으면 외 N마리', () => expect(namesLine(['릴리', '모카', '보리', '콩', '밤'])).toBe('릴리 · 모카 · 보리 외 2마리'))
  it('없으면 빈 글자', () => expect(namesLine([])).toBe(''))
})
describe('dayLabel', () => {
  it('월·일·요일로 적는다', () => {
    expect(dayLabel('2026-11-28')).toBe('11월 28일 토요일')
    expect(dayLabel('2026-01-05')).toBe('1월 5일 월요일')
  })
})
