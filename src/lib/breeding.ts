// 번식 사이클: 인큐 온도별 부화 예정 범위, 그라비드 후 산란 예정일, 번식 타임라인 (종별 값은 감수 전 기본값)
import { addD, gap, yd } from './date'
import { DEFAULT_SPECIES, SPECIES } from './species'

export type Mating = { id: string; female_id: string; male_id: string | null; paired_on: string; locked: boolean; note: string }
export type EggStatus = 'normal' | 'dented' | 'moldy' | 'sweating' | 'infertile' | 'pipping'
export const EGG_STATUSES: readonly EggStatus[] = ['normal', 'dented', 'moldy', 'sweating', 'infertile', 'pipping']
export const EGG_STATUS_LABEL: Record<EggStatus, string> = {
  normal: '정상',
  dented: '함몰',
  moldy: '곰팡이',
  sweating: '땀',
  infertile: '무정',
  pipping: '핍',
}
export type EggCheck = {
  id: number
  clutch_id: string
  checked_on: string
  status: EggStatus
  count: number
  photo_path: string | null
  note: string
}

const breedOf = (species: string) => (SPECIES[species] ?? SPECIES[DEFAULT_SPECIES]).breed

export function incubationRange(species: string, temp: number, laidOn: string): { from: string; to: string } {
  const bands = breedOf(species).incubation
  const band = bands.find((b) => temp <= b.maxTemp) ?? bands[bands.length - 1]
  return { from: addD(laidOn, band.days[0]), to: addD(laidOn, band.days[1]) }
}

export const layExpected = (species: string, gravidOn: string) => addD(gravidOn, breedOf(species).gravidToLay)

export const hatchDday = (expectedFrom: string | null, today: string) => (expectedFrom ? gap(today, expectedFrom) : null)

type ClutchLike = { id: string; seq: number; laid_on: string; eggs: number; fertile: number; dead: number }
type Kid = { id: string; code: string; hatch_date: string | null }
export type BreedEvent = { date: string; kind: 'mating' | 'gravid' | 'lay' | 'egg' | 'hatch'; title: string; sub: string }

const ORDER: Record<BreedEvent['kind'], number> = { hatch: 5, egg: 4, lay: 3, gravid: 2, mating: 1 }

export function breedTimeline(args: {
  matings: Mating[]
  breeder: { gravid_on: string | null; lay_expected_on: string | null } | null
  clutches: ClutchLike[]
  eggChecks: EggCheck[]
  hatched: (c: ClutchLike) => Kid[]
}): BreedEvent[] {
  const ev: BreedEvent[] = []
  for (const m of args.matings) {
    ev.push({ date: m.paired_on, kind: 'mating', title: '메이팅' + (m.locked ? ' · 락 확인' : ''), sub: m.note })
  }
  if (args.breeder?.gravid_on) {
    const lay = args.breeder.lay_expected_on
    ev.push({ date: args.breeder.gravid_on, kind: 'gravid', title: '그라비드 확인', sub: lay ? `산란 예정 ${yd(lay)}` : '' })
  }
  const seqOf = new Map(args.clutches.map((c) => [c.id, c.seq]))
  for (const c of args.clutches) {
    ev.push({ date: c.laid_on, kind: 'lay', title: `${c.seq}차 산란 · 알 ${c.eggs} (유정 ${c.fertile})`, sub: '' })
    const by = new Map<string, number>()
    for (const k of args.hatched(c)) {
      const d = k.hatch_date ?? c.laid_on
      by.set(d, (by.get(d) ?? 0) + 1)
    }
    for (const [d, n] of by) ev.push({ date: d, kind: 'hatch', title: `${c.seq}차 부화 ${n}마리`, sub: '자동 등록·부모 연결' })
  }
  for (const e of args.eggChecks) {
    const seq = seqOf.get(e.clutch_id)
    if (seq === undefined) continue
    ev.push({ date: e.checked_on, kind: 'egg', title: `${seq}차 알 ${EGG_STATUS_LABEL[e.status]} ${e.count}개`, sub: e.note })
  }
  return ev.sort((x, y) => (x.date === y.date ? ORDER[y.kind] - ORDER[x.kind] : x.date < y.date ? 1 : -1))
}
