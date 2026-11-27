import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PRODUCTS, type Product } from '../lib/products'
import { ProductInfo } from './ProductInfo'

const html = (p: Product, compact = false) => renderToStaticMarkup(createElement(ProductInfo, { p, compact }))

describe('ProductInfo', () => {
  it('제품 이름과 급여 가능 종을 보여 준다', () => {
    const h = html(PRODUCTS.signature)
    expect(h).toContain('와구와구 Signature')
    expect(h).toContain('급여 가능 종')
    expect(h).toContain('크레스티드게코/가고일게코/리키에너스 등 도마뱀붙이류')
  })
  it('급여 방법이 비어 있으면 그 칸을 그리지 않는다', () => {
    expect(html(PRODUCTS.signature)).not.toContain('급여 방법')
  })
  it('급여 방법이 있으면 줄마다 보여 준다', () => {
    const h = html({ ...PRODUCTS.signature, guide: ['첫째 줄', '둘째 줄'] })
    expect(h).toContain('급여 방법')
    expect(h).toContain('첫째 줄')
    expect(h).toContain('둘째 줄')
  })
  it('보관·주의사항을 표기사항 문구 그대로 보여 준다', () => {
    const h = html(PRODUCTS.signature)
    expect(h).toContain('보관·주의사항')
    for (const c of PRODUCTS.signature.cautions) expect(h).toContain(c)
  })
  it('제품 화면에서는 보관·주의사항이 펼쳐져 있고, 환영 화면(compact)에서는 접혀 있다', () => {
    expect(html(PRODUCTS.signature)).toContain('<details open=""')
    expect(html(PRODUCTS.signature, true)).not.toContain('<details open=""')
    expect(html(PRODUCTS.signature, true)).toContain('<details')
  })
  it('표기사항이 없는 제품은 빈 칸 없이 이름만 보여 준다', () => {
    const h = html(PRODUCTS.standard)
    expect(h).toContain('와구와구 Standard')
    expect(h).not.toContain('급여 가능 종')
    expect(h).not.toContain('보관·주의사항')
    expect(h).not.toContain('<details')
  })
})
