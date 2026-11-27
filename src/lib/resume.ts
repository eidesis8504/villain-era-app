// 분양 이력서(/r/<토큰>): 서버 함수 get_resume의 결과와 화면에 보여 줄 요약 계산
import type { AdoptAnimal } from './adopt'
import { gap } from './date'
import type { FeedResult } from './feeding'

export type ResumeNode = { code: string; name: string; morph: string; species: string }
export type Resume = {
  animal: AdoptAnimal & { status: string }
  owner: { nickname: string | null; badge: string | null; since: string }
  // 날짜순. 건강 기록·급여량·메모는 서버가 넣지 않는다
  weights: { d: string; g: number }[]
  feedings: { d: string; r: FeedResult; f: string }[]
  sire: ResumeNode | null
  dam: ResumeNode | null
  shared_at: string
}

// 주소의 토큰: 영문 대문자·숫자 16자만 (소문자는 대문자로)
export function cleanToken(input: string | undefined): string | null {
  const t = (input ?? '').toUpperCase()
  return /^[A-Z0-9]{16}$/.test(t) ? t : null
}

export const resumePath = (token: string) => `/r/${token}`

const round1 = (n: number) => Math.round(n * 10) / 10

// 체중 요약: 최근 값, 첫 측정 대비 변화, 그래프 점(최근 12개)
export function resumeWeight(ws: Resume['weights']) {
  if (!ws.length) return { count: 0, last: null, lastDay: null, gain: null, pts: [] as number[] }
  const last = ws[ws.length - 1]
  return {
    count: ws.length,
    last: last.g,
    lastDay: last.d,
    gain: ws.length > 1 ? round1(last.g - ws[0].g) : null,
    pts: ws.slice(-12).map((w) => w.g),
  }
}

// 급여 요약(오늘 포함 최근 30일): 기록한 날 수, 먹음(일부 포함)·거부 횟수, 많이 기록된 먹이 3개
export function resumeFeeding(fs: Resume['feedings'], today: string) {
  const recent = fs.filter((x) => gap(x.d, today) <= 29)
  const count = new Map<string, number>()
  for (const x of recent) if (x.f) count.set(x.f, (count.get(x.f) ?? 0) + 1)
  return {
    days: new Set(recent.map((x) => x.d)).size,
    ate: recent.filter((x) => x.r === 'ate' || x.r === 'partial').length,
    refused: recent.filter((x) => x.r === 'refused').length,
    foods: [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name),
    lastDay: fs.length ? fs[fs.length - 1].d : null,
  }
}
