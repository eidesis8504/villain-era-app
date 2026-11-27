import { describe, expect, it } from 'vitest'
import {
  bulkFoodChoices,
  defaultFood,
  firstFeedPath,
  foodChoices,
  getFoodPreset,
  PRODUCT_FOODS,
  PRODUCTS,
  productOf,
  productSlugFromPath,
  setFoodPreset,
} from './products'
import { SPECIES } from './species'

const SIG = '와구와구 Signature'
const STD = '와구와구 Standard'

describe('productOf', () => {
  it('주소의 제품 이름으로 찾는다', () => {
    expect(productOf('signature')?.food).toBe(SIG)
  })
  it('대소문자를 가리지 않는다', () => {
    expect(productOf('SIGNATURE')?.slug).toBe('signature')
  })
  it('없는 제품과 빈 값은 null', () => {
    expect(productOf('nope')).toBeNull()
    expect(productOf(undefined)).toBeNull()
    expect(productOf(null)).toBeNull()
    expect(productOf('')).toBeNull()
  })
  it('객체의 기본 속성 이름은 제품이 아니다', () => {
    expect(productOf('constructor')).toBeNull()
    expect(productOf('toString')).toBeNull()
  })
})

describe('productSlugFromPath', () => {
  it('/p/<제품> 주소에서 제품 이름을 꺼낸다', () => {
    expect(productSlugFromPath('/p/signature')).toBe('signature')
    expect(productSlugFromPath('/p/signature/')).toBe('signature')
  })
  it('다른 주소는 null', () => {
    expect(productSlugFromPath('/p/')).toBeNull()
    expect(productSlugFromPath('/animals/p/x')).toBeNull()
    expect(productSlugFromPath('/')).toBeNull()
    expect(productSlugFromPath('/p/a/b')).toBeNull()
  })
})

describe('PRODUCTS', () => {
  it('먹이 이름은 급여 기록 칸(30자)에 들어간다', () => {
    for (const p of Object.values(PRODUCTS)) expect(p.food.length).toBeLessThanOrEqual(30)
  })
  it('키와 slug가 같고 주소에 쓸 수 있는 글자다', () => {
    for (const [key, p] of Object.entries(PRODUCTS)) {
      expect(p.slug).toBe(key)
      expect(p.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })
  it('먹이 칩을 넣을 종은 앱에 있는 종이다', () => {
    for (const p of Object.values(PRODUCTS)) for (const s of p.forSpecies) expect(SPECIES[s]).toBeDefined()
  })
  it('PRODUCT_FOODS는 모든 제품의 먹이 이름', () => {
    expect(PRODUCT_FOODS).toEqual([SIG, STD])
  })
})

describe('내 사료 기억', () => {
  const fake = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }
  it('기억한 값을 돌려준다', () => {
    const s = fake()
    setFoodPreset(SIG, s)
    expect(getFoodPreset(s)).toBe(SIG)
  })
  it('기억한 적이 없으면 빈 값', () => {
    expect(getFoodPreset(fake())).toBe('')
  })
  it('30자로 자른다', () => {
    const s = fake()
    setFoodPreset('가'.repeat(40), s)
    expect(getFoodPreset(s)).toBe('가'.repeat(30))
  })
  it('저장소가 오류를 내도 멈추지 않는다', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(getFoodPreset(broken)).toBe('')
    expect(() => setFoodPreset(SIG, broken)).not.toThrow()
  })
  it('저장소가 없어도 멈추지 않는다', () => {
    expect(getFoodPreset(null)).toBe('')
    expect(() => setFoodPreset(SIG, null)).not.toThrow()
  })
})

describe('defaultFood', () => {
  it('그 개체가 먹던 먹이가 먼저다', () => {
    expect(defaultFood('귀뚜라미', SIG)).toBe('귀뚜라미')
  })
  it('먹던 먹이가 없으면 내 사료', () => {
    expect(defaultFood('', SIG)).toBe(SIG)
  })
  it('둘 다 없으면 빈 값', () => {
    expect(defaultFood('', '')).toBe('')
  })
})

describe('foodChoices', () => {
  it('내 사료 → 종 기본 먹이 → 그 종에 맞는 제품 → 먹던 먹이 순서, 중복 없이', () => {
    expect(foodChoices('크레스티드게코', ['슈퍼푸드(CGD)', '귀뚜라미'], SIG, '귀뚜라미')).toEqual([
      SIG,
      '슈퍼푸드(CGD)',
      '귀뚜라미',
      STD,
    ])
  })
  it('내 사료가 없어도 그 종에 맞는 제품은 고를 수 있다', () => {
    expect(foodChoices('리키에너스', ['과일'], '', '')).toEqual(['과일', SIG, STD])
  })
  it('제품 대상이 아닌 종에는 제품을 넣지 않는다', () => {
    expect(foodChoices('테구', ['육류'], '', '')).toEqual(['육류'])
  })
  it('직접 입력했던 먹이는 맨 뒤에 남는다', () => {
    expect(foodChoices('테구', ['육류'], '', '닭가슴살')).toEqual(['육류', '닭가슴살'])
  })
})

describe('bulkFoodChoices (한꺼번에 기록)', () => {
  it('내 사료 → 기본 먹이 → 모든 제품 순서, 중복 없이', () => {
    expect(bulkFoodChoices(['슈퍼푸드(CGD)', '육류'], SIG)).toEqual([SIG, '슈퍼푸드(CGD)', '육류', STD])
  })
  it('내 사료가 없으면 기본 먹이 뒤에 제품', () => {
    expect(bulkFoodChoices(['육류'], '')).toEqual(['육류', SIG, STD])
  })
})

describe('firstFeedPath (새 개체를 등록한 뒤 갈 곳)', () => {
  it('첫 개체이고 내 사료가 있으면 급여 기록을 바로 연다', () => {
    expect(firstFeedPath('abc', 0, SIG)).toBe('/animals/abc?feed=1')
  })
  it('이미 개체가 있었으면 개체 상세만', () => {
    expect(firstFeedPath('abc', 2, SIG)).toBe('/animals/abc')
  })
  it('내 사료가 없으면 개체 상세만', () => {
    expect(firstFeedPath('abc', 0, '')).toBe('/animals/abc')
  })
})
