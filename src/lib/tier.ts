// 등급(Hz) 규칙: 등급 이름과 기준 점수, 서버가 준 점수 내역 읽기
// 무엇을 몇 점으로 세는지는 서버에 있다 (supabase/migrations/20261128000001_tier.sql의 private.tier_parts).
// 여기에는 등급 이름·기준 점수와 화면에 쓰는 항목 이름만 둔다.

export type TierKey = 'rookie' | 'crew' | 'core' | 'boss' | 'villain'
export type Tier = { key: TierKey; name: string; min: number }

// 낮은 등급부터. min 이상이면 그 등급이다
export const TIERS: readonly Tier[] = [
  { key: 'rookie', name: '루키', min: 0 },
  { key: 'crew', name: '크루', min: 50 },
  { key: 'core', name: '코어', min: 200 },
  { key: 'boss', name: '보스', min: 450 },
  { key: 'villain', name: '빌런', min: 750 },
]
export const HZ_MAX = 1000
export const TIER_NOTE = '등급은 앱 안 활동을 바탕으로 한 참고 표시예요. 거래의 안전을 보증하지 않아요.'

// 0~1000 사이의 정수로 맞춘다 (값이 없거나 숫자가 아니면 0)
const clean = (hz: unknown) => (typeof hz === 'number' && Number.isFinite(hz) ? Math.min(HZ_MAX, Math.max(0, Math.floor(hz))) : 0)

export function tierOf(hz: number | null | undefined): Tier {
  const v = clean(hz)
  return TIERS.findLast((t) => v >= t.min) ?? TIERS[0]
}

// 다음 등급과 거기까지 남은 점수. 가장 높은 등급이면 null
export function nextTier(hz: number | null | undefined): { tier: Tier; left: number } | null {
  const v = clean(hz)
  const t = TIERS.find((x) => x.min > v)
  return t ? { tier: t, left: t.min - v } : null
}

// 지금 등급 구간에서 다음 등급까지 얼마나 왔는지 0~1 (가장 높은 등급은 1)
export function tierProgress(hz: number | null | undefined): number {
  const v = clean(hz)
  const next = nextTier(v)
  if (!next) return 1
  const cur = tierOf(v)
  return (v - cur.min) / (next.tier.min - cur.min)
}

// 서버가 내려 주는 점수 내역 한 줄: 개수 n, 1개당 unit, 상한 cap(감점은 null), 점수 hz
export type TierPart = { k: string; n: number; unit: number; cap: number | null; hz: number }
export type TierGroup = '홍보·인지도' | '활동 기간' | '신뢰도'

const GROUPS: readonly TierGroup[] = ['홍보·인지도', '활동 기간', '신뢰도']

// 항목 이름과 세는 방법 (세는 규칙 자체는 서버에 있다 — 문구를 고칠 때 함께 본다)
export const PART_INFO: Record<string, { group: TierGroup; label: string; counter: string; hint: string }> = {
  posts: { group: '홍보·인지도', label: '쓴 글', counter: '개', hint: '숨겨진 글은 빼요' },
  likes: { group: '홍보·인지도', label: '받은 좋아요', counter: '개', hint: '내가 누른 것과 시작한 지 하루가 안 된 회원의 것은 빼요' },
  adopted: { group: '홍보·인지도', label: '채택된 답변', counter: '개', hint: 'Q&A에서 질문한 회원이 채택한 내 답변' },
  days: { group: '활동 기간', label: '앱을 연 날', counter: '일', hint: '하루에 한 번만 세요' },
  months: { group: '활동 기간', label: '앱을 연 달', counter: '달', hint: '그 달에 한 번이라도 열었으면 세요' },
  transfers: { group: '신뢰도', label: '분양 이전을 받은 회원', counter: '명', hint: '받는 사람이 실제로 받아야 세고, 같은 회원은 한 번만 세요' },
  animals: { group: '신뢰도', label: '기록이 있는 개체', counter: '마리', hint: '체중·급여 기록이 합쳐 3건 이상인 개체' },
  penalty: { group: '신뢰도', label: '운영자가 조치한 신고', counter: '건', hint: '같은 글·댓글·대화에 대한 신고는 1건으로 세요' },
}

const isPart = (p: unknown): p is TierPart => {
  if (!p || typeof p !== 'object') return false
  const x = p as Record<string, unknown>
  return (
    typeof x.k === 'string' &&
    typeof x.n === 'number' &&
    typeof x.unit === 'number' &&
    (x.cap === null || typeof x.cap === 'number') &&
    typeof x.hz === 'number'
  )
}

// my_tier()의 결과를 읽는다. 모양이 틀리면 0과 빈 내역 (화면이 깨지지 않게)
export function parseTier(v: unknown): { hz: number; parts: TierPart[] } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { hz: 0, parts: [] }
  const x = v as { hz?: unknown; parts?: unknown }
  return { hz: clean(x.hz), parts: Array.isArray(x.parts) ? x.parts.filter(isPart) : [] }
}

const hzText = (n: number) => `${n < 0 ? `−${Math.abs(n)}` : n} Hz`

// '2개 × 5 Hz = 10 Hz · 최대 100 Hz' (감점은 상한이 없다)
export function partLine(p: TierPart): string {
  const counter = PART_INFO[p.k]?.counter ?? '개'
  return `${p.n}${counter} × ${hzText(p.unit)} = ${hzText(p.hz)}${p.cap === null ? '' : ` · 최대 ${hzText(p.cap)}`}`
}

// 기준별로 묶는다. 모르는 항목은 빼고, 항목이 없는 기준은 만들지 않는다
export function groupParts(parts: TierPart[]): { group: TierGroup; hz: number; items: TierPart[] }[] {
  return GROUPS.map((group) => {
    const items = parts.filter((p) => PART_INFO[p.k]?.group === group)
    return { group, hz: items.reduce((s, p) => s + p.hz, 0), items }
  }).filter((g) => g.items.length > 0)
}
