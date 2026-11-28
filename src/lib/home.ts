// 홈 화면의 글귀 규칙
import { dow } from './date'

// 맨 위 큰 제목: 오늘 할 일이 얼마나 남았는지 한 줄로
export function homeHeadline(total: number, done: number): string {
  if (total <= 0) return '오늘 예정된 할 일이 없어요'
  if (done >= total) return '오늘 할 일을 모두 마쳤어요'
  if (done <= 0) return `오늘 할 일이 ${total}개 있어요`
  return `오늘 할 일 ${total}개 중 ${done}개를 마쳤어요`
}

// 이름 여러 개를 한 줄로: max개까지 보여 주고 나머지는 '외 N마리'
export function namesLine(names: string[], max = 3): string {
  if (!names.length) return ''
  const head = names.slice(0, max).join(' · ')
  return names.length > max ? `${head} 외 ${names.length - max}마리` : head
}

// '2026-11-28' → '11월 28일 토요일'
export function dayLabel(T: string): string {
  const [, m, d] = T.split('-').map(Number)
  return `${m}월 ${d}일 ${'일월화수목금토'[dow(T)]}요일`
}
