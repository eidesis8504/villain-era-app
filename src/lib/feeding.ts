// 급여 기록 요약: 마지막 급여, 지난 일수, 연속 거부, 주기 초과 여부
import { gap } from './date'

export type FeedResult = 'ate' | 'partial' | 'refused' | 'unknown'
export const FEED_RESULTS: readonly FeedResult[] = ['ate', 'partial', 'refused', 'unknown']
export const FEED_RESULT_LABEL: Record<FeedResult, string> = {
  ate: '먹음',
  partial: '일부',
  refused: '거부',
  unknown: '확인 못함',
}

export type Feeding = {
  id: number
  animal_id: string
  fed_on: string
  result: FeedResult
  food: string
  amount: string
  note: string
}

export type FeedSummary = { last: Feeding | null; daysSince: number | null; refuseStreak: number; overdue: boolean }

// 연속 거부: 가장 최근 '먹음·일부' 이후의 '거부' 수 ('확인 못함'은 끊지도 세지도 않는다)
export function feedSummary(list: Feeding[], everyDays: number | null, today: string): FeedSummary {
  if (!list.length) return { last: null, daysSince: null, refuseStreak: 0, overdue: everyDays != null }
  const sorted = [...list].sort((a, b) => (a.fed_on === b.fed_on ? a.id - b.id : a.fed_on < b.fed_on ? -1 : 1))
  const last = sorted[sorted.length - 1]
  let refuseStreak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i].result
    if (r === 'ate' || r === 'partial') break
    if (r === 'refused') refuseStreak++
  }
  const daysSince = gap(last.fed_on, today)
  return { last, daysSince, refuseStreak, overdue: everyDays != null && daysSince > everyDays }
}

// 거부 알림 기준 (서버 트리거와 같은 값)
export const REFUSE_ALERT = 3
