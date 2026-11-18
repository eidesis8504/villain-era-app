// 건강 일지·진료 기록 상수와 상담 카드 데이터 (진단 기능이 아니라 기록을 정리해 보여 준다)
import { addD } from './date'
import { FEED_RESULT_LABEL, feedSummary, type Feeding } from './feeding'
import { fw } from './format'

export const HEALTH_AREAS = ['변·요산', '호흡', '피부·비늘', '눈', '꼬리', '탈피', '행동', '기타'] as const
export type HealthArea = (typeof HEALTH_AREAS)[number]
export const LEVEL_LABEL: Record<1 | 2 | 3, string> = { 1: '가벼움', 2: '보통', 3: '심함' }
export const HEALTH_NOTICE = '진단 기능이 아니에요. 이상이 계속되면 파충류 진료 병원을 방문하세요.'
export const MAX_HEALTH_PHOTOS = 3

export type HealthLog = {
  id: number
  animal_id: string
  logged_on: string
  area: HealthArea
  level: 1 | 2 | 3
  note: string
  photos: string[]
  resolved_on: string | null
}

export type VetVisit = {
  id: number
  animal_id: string
  visited_on: string
  clinic: string
  diagnosis: string
  treatment: string
  cost: number | null
  next_visit: string | null
}

export type HealthAttach = {
  kind: 'health'
  label: string
  weights: number[]
  lastW: string
  lastFed: string | null
  lastFedResult: string | null
  refuseStreak: number
  symptoms: { d: string; area: string; level: number; note: string }[]
  vet: { d: string; clinic: string; diagnosis: string } | null
  photos: string[]
}

export function buildConsult(args: {
  label: string
  weights: { measured_on: string; grams: number }[]
  feeds: Feeding[]
  logs: HealthLog[]
  visits: VetVisit[]
  today: string
}): Omit<HealthAttach, 'photos'> {
  const ws = [...args.weights].sort((a, b) => (a.measured_on < b.measured_on ? -1 : 1)).slice(-8)
  const fsum = feedSummary(args.feeds, null, args.today)
  const from = addD(args.today, -30)
  const symptoms = args.logs
    .filter((l) => l.logged_on >= from && l.logged_on <= args.today)
    .sort((a, b) => (a.logged_on === b.logged_on ? b.id - a.id : a.logged_on < b.logged_on ? 1 : -1))
    .map((l) => ({ d: l.logged_on, area: l.area, level: l.level, note: l.note }))
  const last = [...args.visits].sort((a, b) => (a.visited_on === b.visited_on ? b.id - a.id : a.visited_on < b.visited_on ? 1 : -1))[0]
  return {
    kind: 'health',
    label: args.label,
    weights: ws.map((w) => w.grams),
    lastW: ws.length ? fw(ws[ws.length - 1].grams) : '—',
    lastFed: fsum.last?.fed_on ?? null,
    lastFedResult: fsum.last ? FEED_RESULT_LABEL[fsum.last.result] : null,
    refuseStreak: fsum.refuseStreak,
    symptoms,
    vet: last ? { d: last.visited_on, clinic: last.clinic, diagnosis: last.diagnosis } : null,
  }
}
