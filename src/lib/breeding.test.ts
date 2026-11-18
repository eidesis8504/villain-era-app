import { describe, expect, it } from 'vitest'
import { breedTimeline, hatchDday, incubationRange, layExpected, type EggCheck, type Mating } from './breeding'

describe('incubationRange', () => {
  it('크레스티드게코 23°C는 65~90일', () => {
    expect(incubationRange('크레스티드게코', 23, '2026-11-01')).toEqual({ from: '2027-01-05', to: '2027-01-30' })
  })
  it('26°C는 55~70일', () => {
    expect(incubationRange('크레스티드게코', 26, '2026-11-01')).toEqual({ from: '2026-12-26', to: '2027-01-10' })
  })
  it('구간 경계 21.9°C는 서늘한 구간(90~120일)', () => {
    expect(incubationRange('크레스티드게코', 21.9, '2026-11-01')).toEqual({ from: '2027-01-30', to: '2027-03-01' })
  })
  it('가장 높은 구간을 넘으면 마지막 구간', () => {
    expect(incubationRange('크레스티드게코', 45, '2026-11-01')).toEqual({ from: '2026-12-21', to: '2027-01-05' })
  })
  it('모르는 종은 크레스티드게코 기준', () => {
    expect(incubationRange('없는종', 23, '2026-11-01')).toEqual({ from: '2027-01-05', to: '2027-01-30' })
  })
})

describe('layExpected · hatchDday', () => {
  it('그라비드 확인 후 산란 예정일', () => {
    expect(layExpected('크레스티드게코', '2026-12-25')).toBe('2027-01-08')
  })
  it('부화 예정까지 남은 날', () => {
    expect(hatchDday('2026-11-26', '2026-11-19')).toBe(7)
    expect(hatchDday('2026-11-17', '2026-11-19')).toBe(-2)
    expect(hatchDday(null, '2026-11-19')).toBeNull()
  })
})

describe('breedTimeline', () => {
  it('메이팅·그라비드·산란·알 상태·부화를 최신순으로', () => {
    const matings: Mating[] = [{ id: 'm1', female_id: 'f', male_id: 'm', paired_on: '2026-09-01', locked: true, note: '' }]
    const clutch = { id: 'c1', seq: 1, laid_on: '2026-10-05', eggs: 2, fertile: 2, dead: 0, dam_id: 'f', sire_id: 'm' }
    const eggChecks: EggCheck[] = [{ id: 1, clutch_id: 'c1', checked_on: '2026-11-01', status: 'dented', count: 1, photo_path: null, note: '' }]
    const ev = breedTimeline({
      matings,
      breeder: { gravid_on: '2026-09-20', lay_expected_on: '2026-10-04' },
      clutches: [clutch],
      eggChecks,
      hatched: () => [{ id: 'k1', code: 'VE-K1', hatch_date: '2026-12-20' }],
    })
    expect(ev.map((e) => e.kind)).toEqual(['hatch', 'egg', 'lay', 'gravid', 'mating'])
    expect(ev[0].date).toBe('2026-12-20')
  })
})
