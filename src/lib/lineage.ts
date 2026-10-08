// 혈통 계산: 근친계수(Wright의 F), 관계 판정, 페어링 검사 — 프로토타입 로직을 그대로 옮기고
// 해칭일이 비어 있는 외부 개체도 안전하도록 "조상 여부"로 재귀 방향을 정한다.
import { nm } from './format'
import { spOf } from './species'

export type LAnimal = {
  id: string
  code: string
  name: string
  sex: string
  species: string
  sire_id: string | null
  dam_id: string | null
}

export type PairInfo = {
  coi: number
  txt: string
  blocked: boolean
  verdict: '차단' | '주의' | '가능'
  vBg: string
  vInk: string
  rel: string
  common: string
  msg: string
  msgInk: string
  cardBg: string
  cardBd: string
}

export class Lineage {
  private map: Map<string, LAnimal>
  private ancAll = new Map<string, Set<string>>()

  constructor(animals: LAnimal[]) {
    this.map = new Map(animals.map((a) => [a.id, a]))
  }

  A(id?: string | null): LAnimal | null {
    return id ? (this.map.get(id) ?? null) : null
  }

  // 본인 포함 조상 집합 (6대까지) — 공통 조상 표시용
  anc(id: string): Set<string> {
    const s = new Set<string>()
    const walk = (x: string | null, d: number) => {
      if (!x || d > 6) return
      s.add(x)
      const a = this.A(x)
      if (a) {
        walk(a.sire_id, d + 1)
        walk(a.dam_id, d + 1)
      }
    }
    walk(id, 0)
    return s
  }

  // 모든 조상 (본인 제외, 순환 방지)
  private ancestors(id: string): Set<string> {
    const hit = this.ancAll.get(id)
    if (hit) return hit
    const out = new Set<string>()
    const stack = [id]
    while (stack.length) {
      const a = this.A(stack.pop())
      if (!a) continue
      for (const p of [a.sire_id, a.dam_id]) {
        if (p && !out.has(p) && p !== id) {
          out.add(p)
          stack.push(p)
        }
      }
    }
    this.ancAll.set(id, out)
    return out
  }

  isAncestor(x: string, y: string) {
    return this.ancestors(y).has(x)
  }

  // 혈연계수(kinship) φ(a,b)
  kin(a: string | null, b: string | null, memo: Map<string, number> = new Map()): number {
    if (!a || !b) return 0
    const k = a < b ? a + '|' + b : b + '|' + a
    const hit = memo.get(k)
    if (hit !== undefined) return hit
    memo.set(k, 0)
    let r: number
    if (a === b) {
      const x = this.A(a)
      r = 0.5 * (1 + (x ? this.kin(x.sire_id, x.dam_id, memo) : 0))
    } else {
      // 상대의 조상이 아닌 쪽의 부모로 내려간다
      let y = a
      let o = b
      if (this.isAncestor(a, b)) {
        y = b
        o = a
      }
      const Y = this.A(y)
      r = Y ? 0.5 * (this.kin(Y.sire_id, o, memo) + this.kin(Y.dam_id, o, memo)) : 0
    }
    memo.set(k, r)
    return r
  }

  // 근친계수 F = 부모 사이의 혈연계수
  F(id: string) {
    const x = this.A(id)
    return x ? this.kin(x.sire_id, x.dam_id) : 0
  }

  // 후손 전체 (본인 제외)
  desc(id: string): Set<string> {
    const out = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const a of this.map.values()) {
        if (!out.has(a.id) && ((a.sire_id && out.has(a.sire_id)) || (a.dam_id && out.has(a.dam_id)))) {
          out.add(a.id)
          changed = true
        }
      }
    }
    out.delete(id)
    return out
  }

  // 부모·조부모 6칸 중 등록된 수
  knownAnc(id: string) {
    const a = this.A(id)
    if (!a) return 0
    const s = this.A(a.sire_id)
    const d = this.A(a.dam_id)
    return [a.sire_id, a.dam_id, s?.sire_id, s?.dam_id, d?.sire_id, d?.dam_id].filter(Boolean).length
  }

  rel(a: string, b: string, c: number): string {
    const x = this.A(a)
    const y = this.A(b)
    if (!x || !y) return '—'
    if (x.sire_id === b || x.dam_id === b || y.sire_id === a || y.dam_id === a) return '부모 – 자식'
    const ps = (z: LAnimal | null) => (z ? [z.sire_id, z.dam_id].filter((v): v is string => !!v) : [])
    const sib = (p: string, q: string) => {
      const P = this.A(p)
      const Q = this.A(q)
      if (!P || !Q || p === q) return 0
      const s = !!P.sire_id && P.sire_id === Q.sire_id
      const d = !!P.dam_id && P.dam_id === Q.dam_id
      return s && d ? 2 : s || d ? 1 : 0
    }
    const sb = sib(a, b)
    if (sb === 2) return '친남매'
    if (sb === 1) return '이복·이부 남매'
    const gp = (z: LAnimal | null) => ps(z).flatMap((p) => ps(this.A(p)))
    if (gp(x).includes(b) || gp(y).includes(a)) return '조부모 – 손주'
    if (ps(y).some((p) => sib(a, p)) || ps(x).some((p) => sib(b, p))) return '삼촌·이모 – 조카'
    return c > 0 ? '먼 친척' : '혈연 없음'
  }

  label(id: string) {
    const a = this.A(id)
    return a ? `${nm(a)} ${a.code}` : ''
  }

  // 수컷 m × 암컷 f 페어링 검사 (limit: 차단 기준 COI %)
  pairInfo(m: string | null | undefined, f: string | null | undefined, limit: number): PairInfo | null {
    if (!m || !f) return null
    const c = this.kin(m, f) * 100
    const ca = this.anc(m)
    const cb = this.anc(f)
    const com = [...ca].filter((x) => cb.has(x))
    const near = com.filter((x) => !com.some((o) => o !== x && this.anc(o).has(x)))
    const sm = spOf(this.A(m))
    const sf = spOf(this.A(f))
    const xs = sm !== sf
    const bl = xs || c > limit + 1e-9
    return {
      coi: c,
      txt: c.toFixed(2) + '%',
      blocked: bl,
      verdict: bl ? '차단' : c > 0 ? '주의' : '가능',
      vBg: bl ? '#B4540A' : c > 0 ? '#FBEADB' : '#E6EDF7',
      vInk: bl ? '#fff' : c > 0 ? '#B4540A' : '#0148AB',
      rel: xs ? `다른 종 (${sm} × ${sf})` : this.rel(m, f, c),
      common: near.length ? near.map((x) => this.label(x)).join(', ') : '없음',
      msg: xs
        ? '종이 달라 페어링할 수 없어요'
        : bl
          ? `기준 ${limit}% 초과 — 페어링이 차단돼요`
          : c > 0
            ? `기준 ${limit}% 이하 — 가능하지만 기록을 확인하세요`
            : '공통 조상이 없어요 — 페어링 가능',
      msgInk: bl ? '#B4540A' : c > 0 ? '#7A4513' : '#0148AB',
      cardBg: bl ? '#FBEADB' : '#fff',
      cardBd: bl ? '#F0C9A6' : '#E6E3DC',
    }
  }
}
