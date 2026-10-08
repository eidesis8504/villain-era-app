import { describe, expect, it } from 'vitest'
import { ruleLbl, todosOn, type TodoLike } from './todo'

const t = (p: Partial<TodoLike>): TodoLike => ({
  id: p.id ?? 'x',
  title: 'x',
  time_of_day: '09:00:00',
  mode: 'days',
  days: [],
  once_date: null,
  alarm_minutes: 10,
  tag: '급여',
  ...p,
})

describe('todo rules', () => {
  const T = '2026-10-08' // 목요일
  it('요일 반복 라벨', () => {
    expect(ruleLbl(t({ days: [0, 1, 2, 3, 4, 5, 6] }), T)).toBe('매일')
    expect(ruleLbl(t({ days: [5, 1, 3, 2, 4] }), T)).toBe('평일')
    expect(ruleLbl(t({ days: [0, 6] }), T)).toBe('주말')
    expect(ruleLbl(t({ days: [6, 2, 4] }), T)).toBe('매주 화·목·토')
  })
  it('한 번 라벨', () => {
    expect(ruleLbl(t({ mode: 'once', once_date: T }), T)).toBe('오늘 한 번')
    expect(ruleLbl(t({ mode: 'once', once_date: '2026-10-09' }), T)).toBe('내일 한 번')
    expect(ruleLbl(t({ mode: 'once', once_date: '2026-11-01' }), T)).toBe('26.11.01 한 번')
  })
  it('해당 날짜의 할 일을 시간순으로', () => {
    const list = todosOn(
      [
        t({ id: 'a', days: [4], time_of_day: '18:00:00' }),
        t({ id: 'b', days: [1], time_of_day: '08:00:00' }),
        t({ id: 'c', mode: 'once', once_date: T, time_of_day: '07:30:00' }),
      ],
      T,
    )
    expect(list.map((x) => x.id)).toEqual(['c', 'a'])
  })
})
