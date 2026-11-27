// 분양·홍보 글의 규칙: 분양 카드 모양, 판매자 정보 확인, 새 계정 제한
// 서버(supabase/migrations/20261127000001_adopt_board.sql)가 같은 규칙을 강제한다. 화면은 미리 안내만 한다.

export const ADOPT_CAT = '분양·홍보'
// 새 계정 제한 (서버의 private.can_trade와 같은 값)
export const TRADE_MIN_HOURS = 24

// 고지와 법 안내 (분양·홍보 목록, 글, 글쓰기, 분양 이력서가 함께 쓴다)
// 출처: 원주시 공지(2026-03-06), 고양시 보도자료(2026-01-07). 기준이 바뀌면 여기만 고친다.
export const NOT_A_PARTY = 'VILLAIN ERA는 분양 거래의 당사자가 아니에요. 거래와 신고는 당사자가 직접 해요.'
export const WIMS_URL = 'https://wims.mcee.go.kr'
export const LAW_NOTES: readonly string[] = [
  '백색목록에 없는 종은 분양할 수 없어요.',
  '분양한 사람은 양도 신고, 분양받은 사람은 양수 신고를 해야 해요. 한 달 동안의 양도·양수를 다음 달 10일까지 야생동물종합관리시스템(wims.mcee.go.kr)이나 관할 시·군·구청에 신고해요.',
  '파충류·양서류만 다루는 경우, 50마리 이상 보유하면서 1년에 100마리 이상 또는 월 평균 20마리 이상 판매하면 영업허가가 필요해요.',
  '신고하지 않으면 과태료(최대 100만 원)가 부과될 수 있어요.',
]

export type AdoptMode = 'sale' | 'show'
export type AdoptStatus = 'open' | 'hold' | 'done'
export const ADOPT_MODE_LABEL: Record<AdoptMode, string> = { sale: '분양', show: '홍보' }
export const ADOPT_STATUS_LABEL: Record<AdoptStatus, string> = { open: '분양 중', hold: '예약 중', done: '분양 완료' }
export const ADOPT_STATUSES: readonly AdoptStatus[] = ['open', 'hold', 'done']

export type Seller = { type: 'person' } | { type: 'biz'; name: string; rep: string; brn: string; tel: string; permit: string }
export type AdoptAnimal = {
  code: string
  name: string
  species: string
  sex: string
  morph: string
  hatch_date: string | null
  photo_path: string | null
}
// 글에 저장된 분양 카드 (status·animal은 서버가 채운다. 홍보 글은 status가 null)
export type AdoptAttach = {
  kind: 'adopt'
  mode: AdoptMode
  status: AdoptStatus | null
  price: string
  region: string
  seller: Seller
  resume: string | null
  animal: AdoptAnimal | null
}

export type AdoptForm = {
  mode: AdoptMode
  animalId: string
  price: string
  region: string
  biz: boolean
  name: string
  rep: string
  brn: string
  tel: string
  permit: string
  agreed: boolean
}
export const EMPTY_ADOPT_FORM: AdoptForm = {
  mode: 'sale',
  animalId: '',
  price: '',
  region: '',
  biz: false,
  name: '',
  rep: '',
  brn: '',
  tel: '',
  permit: '',
  agreed: false,
}

// 사업자등록번호: 숫자 10자리면 NNN-NN-NNNNN, 아니면 숫자만
export function formatBrn(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 10)
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d
}

// 사업자등록번호 검증식 (가중치 1,3,7,1,3,7,1,3,5 · 아홉째 자리×5의 십의 자리를 더함)
export function isValidBrn(input: string): boolean {
  const d = input.replace(/\D/g, '')
  if (d.length !== 10) return false
  const n = Array.from(d, Number)
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  const sum = w.reduce((s, x, i) => s + x * n[i], 0) + Math.floor((n[8] * 5) / 10)
  return (10 - (sum % 10)) % 10 === n[9]
}

export type AdoptErrors = Partial<Record<'name' | 'rep' | 'brn' | 'tel' | 'agreed', string>>

export function adoptErrors(f: AdoptForm): AdoptErrors {
  const e: AdoptErrors = {}
  if (f.biz) {
    if (!f.name.trim()) e.name = '상호를 적어 주세요'
    if (!f.rep.trim()) e.rep = '대표자 이름을 적어 주세요'
    if (!isValidBrn(f.brn)) e.brn = '사업자등록번호 10자리를 확인해 주세요'
    if (!f.tel.trim()) e.tel = '연락처를 적어 주세요'
  }
  if (!f.agreed) e.agreed = '안내를 읽고 확인해 주세요'
  return e
}

// 서버로 보내는 분양 카드 (status·animal은 서버가 채운다)
export function adoptPayload(f: AdoptForm, resume: string | null) {
  const seller: Seller = f.biz
    ? { type: 'biz', name: f.name.trim(), rep: f.rep.trim(), brn: formatBrn(f.brn), tel: f.tel.trim(), permit: f.permit.trim() }
    : { type: 'person' }
  return {
    kind: 'adopt' as const,
    mode: f.mode,
    price: f.mode === 'sale' ? f.price.trim() : '',
    region: f.region.trim(),
    seller,
    resume,
  }
}

export type TradeGate = { ok: boolean; hoursLeft: number; needAnimal: boolean }

// 분양·홍보 글을 쓸 수 있는 계정인지: 시작한 지 24시간이 지났고 개체가 1마리 이상 (운영자는 예외)
export function tradeGate(createdAt: string, animalCount: number, isAdmin: boolean, now: number): TradeGate {
  if (isAdmin) return { ok: true, hoursLeft: 0, needAnimal: false }
  const ageMs = now - Date.parse(createdAt)
  const hoursLeft = Math.max(0, Math.ceil((TRADE_MIN_HOURS * 3_600_000 - ageMs) / 3_600_000))
  const needAnimal = animalCount < 1
  return { ok: hoursLeft === 0 && !needAnimal, hoursLeft, needAnimal }
}

export function tradeGateText(g: TradeGate): string {
  if (g.ok) return ''
  const parts = [`분양·홍보 글은 앱을 시작한 지 ${TRADE_MIN_HOURS}시간이 지나고 개체를 1마리 이상 등록한 뒤에 쓸 수 있어요`]
  if (g.hoursLeft > 0) parts.push(`약 ${g.hoursLeft}시간 뒤부터 쓸 수 있어요`)
  if (g.needAnimal) parts.push('개체를 먼저 등록해 주세요')
  return parts.join(' · ')
}
