import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AdoptAttach } from '../lib/adopt'
import { AdoptCard } from './AdoptCard'

const animal = {
  code: 'VE-ADOPT00001',
  name: '릴리',
  species: '크레스티드게코',
  sex: 'F',
  morph: '릴리화이트',
  hatch_date: '2026-03-01',
  photo_path: null,
}
const sale: AdoptAttach = {
  kind: 'adopt',
  mode: 'sale',
  status: 'open',
  price: '30만 원',
  region: '서울',
  seller: { type: 'person' },
  resume: 'ABCD2345EFGH6789',
  animal,
}
const html = (at: AdoptAttach, onResume?: () => void) =>
  renderToStaticMarkup(createElement(AdoptCard, { at, photoUrl: '', onResume }))

describe('AdoptCard', () => {
  it('분양 글: 상태·희망 분양가·지역을 보여 준다', () => {
    const h = html(sale)
    for (const t of ['분양 중', '희망 분양가', '30만 원', '서울']) expect(h).toContain(t)
  })
  it('분양가를 적지 않았으면 문의로 보여 준다', () => {
    expect(html({ ...sale, price: '' })).toContain('문의')
  })
  it('분양 상태에 따라 표시가 바뀐다', () => {
    expect(html({ ...sale, status: 'hold' })).toContain('예약 중')
    expect(html({ ...sale, status: 'done' })).toContain('분양 완료')
  })
  it('개체 카드: 서버가 채운 개체 정보를 보여 준다', () => {
    const h = html(sale)
    for (const t of ['릴리', 'VE-ADOPT00001', '크레스티드게코', '암컷', '릴리화이트', '26.03.01']) expect(h).toContain(t)
  })
  it('이력서가 있고 여는 방법이 있으면 이력서 보기 버튼이 있다', () => {
    expect(html(sale, () => undefined)).toContain('이력서 보기')
    expect(html(sale)).not.toContain('이력서 보기')
    expect(html({ ...sale, resume: null, animal: null }, () => undefined)).not.toContain('이력서 보기')
  })
  it('사업자 판매자는 상호·대표자·사업자등록번호·연락처를 보여 준다', () => {
    const h = html({
      ...sale,
      seller: { type: 'biz', name: '게코 가게', rep: '홍길동', brn: '101-01-01013', tel: '010-0000-0000', permit: '제2026-1호' },
    })
    for (const t of ['사업자', '게코 가게', '홍길동', '101-01-01013', '010-0000-0000', '제2026-1호']) expect(h).toContain(t)
  })
  it('영업허가번호를 적지 않은 사업자는 그 줄이 없다', () => {
    const h = html({ ...sale, seller: { type: 'biz', name: '게코 가게', rep: '홍길동', brn: '101-01-01013', tel: '010', permit: '' } })
    expect(h).not.toContain('영업허가')
  })
  it('개인 분양자는 사업자 정보가 없다', () => {
    const h = html(sale)
    expect(h).toContain('개인')
    expect(h).not.toContain('사업자등록번호')
  })
  it('홍보 글: 분양 상태와 분양가를 보여 주지 않는다', () => {
    const h = html({ ...sale, mode: 'show', status: null, price: '', animal: null, resume: null })
    expect(h).toContain('홍보')
    expect(h).not.toContain('분양 중')
    expect(h).not.toContain('희망 분양가')
  })
  it('당사자가 아니라는 고지가 항상 있다', () => {
    expect(html(sale)).toContain('VILLAIN ERA는 분양 거래의 당사자가 아니에요')
    expect(html({ ...sale, mode: 'show', status: null })).toContain('VILLAIN ERA는 분양 거래의 당사자가 아니에요')
  })
})
