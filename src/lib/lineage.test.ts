import { describe, expect, it } from 'vitest'
import { Lineage, type LAnimal } from './lineage'

// 프로토타입 데모 데이터의 혈통 일부
const A = (id: string, sex: string, sire: string | null = null, dam: string | null = null): LAnimal => ({
  id,
  code: id,
  name: id,
  sex,
  species: '크레스티드게코',
  sire_id: sire,
  dam_id: dam,
})

const animals = [
  A('0101', 'M'),
  A('0102', 'F'),
  A('0103', 'M', '0101', '0102'),
  A('0104', 'F'),
  A('0198', 'F', '0101', '0102'),
  A('0231', 'F', '0103', '0104'),
  A('0245', 'M'),
  A('0412', 'M', '0245', '0231'),
  A('0420', 'F', '0245', '0198'),
]
const L = new Lineage(animals)

describe('lineage', () => {
  it('부모-자식 페어링은 COI 25%로 차단된다 (프로토타입 시나리오 02)', () => {
    const pi = L.pairInfo('0412', '0231', 6.25)!
    expect(pi.txt).toBe('25.00%')
    expect(pi.blocked).toBe(true)
    expect(pi.rel).toBe('부모 – 자식')
  })

  it('친남매는 25%', () => {
    const pi = L.pairInfo('0103', '0198', 6.25)!
    expect(pi.coi).toBeCloseTo(25)
    expect(pi.rel).toBe('친남매')
  })

  it('이복 남매 + 사촌 관계 어미는 15.625%', () => {
    const pi = L.pairInfo('0412', '0420', 6.25)!
    expect(pi.coi).toBeCloseTo(15.625)
    expect(pi.rel).toBe('이복·이부 남매')
  })

  it('혈연이 없으면 0%이고 가능', () => {
    const pi = L.pairInfo('0245', '0104', 6.25)!
    expect(pi.coi).toBe(0)
    expect(pi.verdict).toBe('가능')
    expect(pi.rel).toBe('혈연 없음')
  })

  it('조부모-손주는 12.5%', () => {
    expect(L.kin('0103', '0412') * 100).toBeCloseTo(12.5)
    expect(L.rel('0103', '0412', 12.5)).toBe('조부모 – 손주')
  })

  it('개체 F와 후손·조상 계산', () => {
    expect(L.F('0231')).toBe(0)
    expect([...L.desc('0231')].sort()).toEqual(['0412'])
    expect(L.knownAnc('0412')).toBe(4)
  })

  it('다른 종끼리는 차단', () => {
    const L2 = new Lineage([A('m', 'M'), { ...A('f', 'F'), species: '테구' }])
    const pi = L2.pairInfo('m', 'f', 12.5)!
    expect(pi.blocked).toBe(true)
    expect(pi.msg).toBe('종이 달라 페어링할 수 없어요')
  })

  it('순환 데이터에서도 멈춘다', () => {
    const L3 = new Lineage([A('x', 'M', 'y', null), A('y', 'M', 'x', null)])
    expect(() => L3.F('x')).not.toThrow()
  })
})
