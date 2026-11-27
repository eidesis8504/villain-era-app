import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Resume } from '../lib/resume'
import { ResumeView } from './ResumeView'

const T = '2026-11-27'
const base: Resume = {
  animal: {
    code: 'VE-ADOPT00001',
    name: '릴리',
    species: '크레스티드게코',
    sex: 'F',
    morph: '릴리화이트',
    hatch_date: '2026-03-01',
    photo_path: null,
    status: 'keeping',
  },
  owner: { nickname: '분양자', badge: null, since: '2026-10-08' },
  weights: [],
  feedings: [],
  sire: null,
  dam: null,
  shared_at: '2026-11-27T00:00:00Z',
}
const html = (over: Partial<Resume> = {}, photoUrl = '') =>
  renderToStaticMarkup(createElement(ResumeView, { r: { ...base, ...over }, today: T, photoUrl }))

describe('ResumeView', () => {
  it('개체 정보와 분양자를 보여 준다', () => {
    const h = html()
    for (const t of ['릴리', 'VE-ADOPT00001', '크레스티드게코', '암컷', '릴리화이트', '26.03.01', '분양자']) expect(h).toContain(t)
  })
  it('기록이 없는 이력서는 빈 상태 문구를 보여 준다', () => {
    const h = html()
    expect(h).toContain('체중 기록이 없어요')
    expect(h).toContain('급여 기록이 없어요')
    expect(h).toContain('부모 정보가 없어요')
  })
  it('체중 기록이 있으면 최근 값, 첫 측정 대비 변화, 측정 횟수', () => {
    const h = html({ weights: [{ d: '2026-10-01', g: 10 }, { d: '2026-11-20', g: 15 }] })
    expect(h).toContain('15.0 g')
    expect(h).toContain('+5.0 g')
    expect(h).toContain('측정 2회')
    expect(h).not.toContain('체중 기록이 없어요')
  })
  it('급여 기록이 있으면 먹이 이름과 먹음·거부 횟수', () => {
    const h = html({
      feedings: [
        { d: '2026-11-20', r: 'ate', f: '와구와구 Signature' },
        { d: '2026-11-22', r: 'partial', f: '와구와구 Signature' },
        { d: '2026-11-24', r: 'refused', f: '귀뚜라미' },
      ],
    })
    expect(h).toContain('와구와구 Signature')
    expect(h).toContain('먹음 2회')
    expect(h).toContain('거부 1회')
    expect(h).not.toContain('급여 기록이 없어요')
  })
  it('최근 30일에 급여 기록이 없으면 마지막 기록일을 알려 준다', () => {
    const h = html({ feedings: [{ d: '2026-09-01', r: 'ate', f: '귀뚜라미' }] })
    expect(h).toContain('최근 30일 기록이 없어요')
    expect(h).toContain('26.09.01')
  })
  it('부모 중 한쪽만 있으면 다른 쪽은 미상', () => {
    const h = html({ sire: { code: 'VE-SIRE000001', name: '아빠', morph: '할리퀸', species: '크레스티드게코' } })
    expect(h).toContain('아빠')
    expect(h).toContain('VE-SIRE000001')
    expect(h).toContain('미상')
    expect(h).not.toContain('부모 정보가 없어요')
  })
  it('당사자가 아니라는 고지와 신고 안내가 있다', () => {
    const h = html()
    expect(h).toContain('VILLAIN ERA는 분양 거래의 당사자가 아니에요')
    expect(h).toContain('다음 달 10일까지')
    expect(h).toContain('wims.mcee.go.kr')
  })
  it('분양된 개체에는 분양 완료 표시가 붙는다', () => {
    expect(html({ animal: { ...base.animal, status: 'sold' } })).toContain('분양 완료')
    expect(html()).not.toContain('분양 완료')
  })
  it('닉네임이 없는 분양자는 사육자로 보여 준다', () => {
    expect(html({ owner: { nickname: null, badge: null, since: '2026-10-08' } })).toContain('사육자')
  })
  it('분양자의 등급 점수가 있으면 등급 배지를 보여 준다', () => {
    const h = html({ owner: { nickname: '분양자', badge: null, since: '2026-10-08', hz: 210 } })
    expect(h).toContain('tier-core')
    expect(h).toContain('코어')
  })
  it('등급 점수가 없는 이력서(예전 응답)와 운영자에게는 등급 배지가 없다', () => {
    expect(html({ owner: { nickname: '분양자', badge: null, since: '2026-10-08' } })).not.toContain('tier-badge')
    expect(html({ owner: { nickname: '빌런', badge: '운영자', since: '2026-10-08', hz: 500 } })).not.toContain('tier-badge')
  })
  it('사진 주소가 있으면 사진을 넣는다', () => {
    expect(html({}, 'https://example.test/photo.jpg')).toContain('src="https://example.test/photo.jpg"')
    expect(html()).not.toContain('<img')
  })
})
