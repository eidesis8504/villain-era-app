// 분양·홍보 글의 규칙: 분양 카드 모양, 판매자 정보 확인, 새 계정 제한
// 서버(supabase/migrations/20261127000001_adopt_board.sql)가 같은 규칙을 강제한다. 화면은 미리 안내만 한다.

export const ADOPT_CAT = '분양·홍보'
// 새 계정 제한 (서버의 private.can_trade와 같은 값)
export const TRADE_MIN_HOURS = 24

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
