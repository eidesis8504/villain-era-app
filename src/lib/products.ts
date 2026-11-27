// 와구와구 제품 표: 제품 QR 시작 화면(/p/<slug>)과 급여 기록의 먹이 칩이 함께 쓴다.
// 문구는 표기사항(후면 표기사항 v2 · 시제품)을 그대로 옮긴 것이다. 판매용 표기사항이 확정되면 여기만 고친다.
// 새 제품을 더하면 scripts/make-product-qr.mjs의 목록에도 더한다.

export type Product = {
  slug: string
  name: string
  // 급여 기록의 먹이 이름 (feedings.food, 30자 이하)
  food: string
  // 표기사항: 사료의 명칭 및 형태 · 용도 (없으면 '')
  form: string
  // 표기사항: 급여 가능 종 (없으면 '')
  species: string
  // 먹이 칩에 이 제품을 넣을 종 (species.ts의 이름)
  forSpecies: string[]
  // 급여 방법. 문구가 확정되기 전에는 비워 둔다 (화면에서 칸을 숨긴다)
  guide: string[]
  // 표기사항: 주의사항 및 보관방법
  cautions: string[]
}

const GECKOS = ['크레스티드게코', '리키에너스']

export const PRODUCTS: Record<string, Product> = {
  signature: {
    slug: 'signature',
    name: '와구와구 Signature',
    food: '와구와구 Signature',
    form: '애완파충류/분말 · 전 연령',
    species: '크레스티드게코/가고일게코/리키에너스 등 도마뱀붙이류',
    forSpecies: GECKOS,
    guide: [],
    cautions: [
      '본 제품은 지정된 종에게만 급여하시길 바랍니다.',
      '개봉 전 제품은 직사광선을 피해 서늘하고 건조한 곳에 보관하시길 바랍니다.',
      '개봉된 제품은 냉장 보관하시길 바라며, 소비기한이 지난 제품은 폐기하시길 바랍니다.',
      '제품 개봉 후 가급적 빠른 시일 내 소비하시길 바랍니다.',
      '급여 중인 사료는 이물질 혼입/변질 방지를 위해 밀폐하여 보관하시길 바랍니다.',
      '어린이나 반려동물의 손이 닿지 않는 장소에 보관하시길 바랍니다.',
      '본 제품을 급여 후 구토, 설사 등 이상 증상이 나타날 경우 급여를 중단하시길 바랍니다.',
    ],
  },
  // 표기사항 자료가 아직 없어 이름만 둔다
  standard: {
    slug: 'standard',
    name: '와구와구 Standard',
    food: '와구와구 Standard',
    form: '',
    species: '',
    forSpecies: GECKOS,
    guide: [],
    cautions: [],
  },
}

export const PRODUCT_FOODS = Object.values(PRODUCTS).map((p) => p.food)

export function productOf(slug: string | null | undefined): Product | null {
  const key = (slug ?? '').toLowerCase()
  return Object.prototype.hasOwnProperty.call(PRODUCTS, key) ? PRODUCTS[key] : null
}

export function productSlugFromPath(pathname: string): string | null {
  return /^\/p\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null
}

// '내 사료': 제품 QR로 시작한 기기가 기억하는 먹이 이름 (이 기기에만 저장)
const KEY = 've-food'
const MAX = 30

function local(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function getFoodPreset(store: Pick<Storage, 'getItem'> | null = local()): string {
  try {
    return (store?.getItem(KEY) ?? '').slice(0, MAX)
  } catch {
    return ''
  }
}

export function setFoodPreset(food: string, store: Pick<Storage, 'setItem'> | null = local()): void {
  try {
    store?.setItem(KEY, food.slice(0, MAX))
  } catch {
    /* 저장소를 쓸 수 없는 브라우저 */
  }
}

// 급여 기록의 기본 먹이: 그 개체가 먹던 먹이가 먼저, 없으면 내 사료
export const defaultFood = (last: string, preset: string) => last || preset

// 먹이 칩: 내 사료 → 종 기본 먹이 → 그 종에 맞는 제품 → 먹던 먹이
export function foodChoices(species: string, base: string[], preset: string, last: string): string[] {
  const fits = Object.values(PRODUCTS)
    .filter((p) => p.forSpecies.includes(species))
    .map((p) => p.food)
  return Array.from(new Set([preset, ...base, ...fits, last].filter(Boolean)))
}
