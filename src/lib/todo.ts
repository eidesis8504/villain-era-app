// 할 일 반복 규칙 (프로토타입 todosOn / ruleLbl / alarmLbl)
import { addD, dow, yd } from './date'

export type TodoLike = {
  id: string
  title: string
  time_of_day: string
  mode: string
  days: number[]
  once_date: string | null
  alarm_minutes: number
  tag: string
}

export const hhmm = (t: string) => t.slice(0, 5)

export function todosOn<T extends TodoLike>(todos: T[], day: string): T[] {
  const d = dow(day)
  return todos
    .filter((t) => (t.mode === 'once' ? t.once_date === day : t.days.includes(d)))
    .sort((a, b) => (a.time_of_day < b.time_of_day ? -1 : a.time_of_day > b.time_of_day ? 1 : 0))
}

export function ruleLbl(t: TodoLike, T: string) {
  if (t.mode === 'once') {
    return t.once_date === T ? '오늘 한 번' : t.once_date === addD(T, 1) ? '내일 한 번' : yd(t.once_date) + ' 한 번'
  }
  const d = [...t.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  if (d.length === 7) return '매일'
  const k = d.join()
  if (k === '1,2,3,4,5') return '평일'
  if (k === '6,0') return '주말'
  return '매주 ' + d.map((x) => '일월화수목금토'[x]).join('·')
}

export function alarmLbl(a: number) {
  return a === 10 ? '10분 전 알림' : a === 30 ? '30분 전 알림' : a === 1440 ? '1일 전 알림' : '알림 없음'
}

export const TODO_TAGS = ['급여', '분무', '청소', '체중', '점검', '기타'] as const
