import { describe, expect, it } from 'vitest'
import {
  adoptErrors,
  adoptPayload,
  EMPTY_ADOPT_FORM,
  formatBrn,
  isValidBrn,
  tradeGate,
  tradeGateText,
  type AdoptForm,
} from './adopt'

const form = (over: Partial<AdoptForm> = {}): AdoptForm => ({ ...EMPTY_ADOPT_FORM, agreed: true, ...over })
const biz = (over: Partial<AdoptForm> = {}) =>
  form({ biz: true, name: '게코 가게', rep: '홍길동', brn: '101-01-01013', tel: '010-0000-0000', ...over })

describe('사업자등록번호', () => {
  it('숫자 10자리는 NNN-NN-NNNNN으로 맞춘다', () => {
    expect(formatBrn('1010101013')).toBe('101-01-01013')
    expect(formatBrn('101 01 01013')).toBe('101-01-01013')
    expect(formatBrn('10101010139')).toBe('101-01-01013')
  })
  it('10자리가 안 되면 숫자만 남긴다', () => {
    expect(formatBrn('101-01')).toBe('10101')
    expect(formatBrn('abc')).toBe('')
  })
  it('검증식에 맞는 번호만 통과한다', () => {
    expect(isValidBrn('101-01-01013')).toBe(true)
    expect(isValidBrn('1010101013')).toBe(true)
    expect(isValidBrn('101-01-01014')).toBe(false)
    expect(isValidBrn('123')).toBe(false)
    expect(isValidBrn('')).toBe(false)
  })
})

describe('adoptErrors', () => {
  it('개인 판매자는 법 안내 확인만 필요하다', () => {
    expect(adoptErrors(form())).toEqual({})
    expect(Object.keys(adoptErrors(form({ agreed: false })))).toEqual(['agreed'])
  })
  it('사업자는 상호·대표자·번호·연락처가 모두 필요하다', () => {
    expect(Object.keys(adoptErrors(form({ biz: true }))).sort()).toEqual(['brn', 'name', 'rep', 'tel'])
  })
  it('공백만 넣은 칸은 빈 칸으로 본다', () => {
    expect(Object.keys(adoptErrors(biz({ name: '   ' })))).toEqual(['name'])
  })
  it('사업자등록번호가 검증식에 맞지 않으면 오류', () => {
    expect(Object.keys(adoptErrors(biz({ brn: '101-01-01014' })))).toEqual(['brn'])
  })
  it('다 채운 사업자는 오류가 없다', () => {
    expect(adoptErrors(biz())).toEqual({})
  })
})

describe('adoptPayload', () => {
  it('개인 판매자: 앞뒤 공백을 지우고 이력서 토큰을 붙인다', () => {
    expect(adoptPayload(form({ mode: 'sale', price: ' 30만 원 ', region: ' 서울 ' }), 'TOKEN')).toEqual({
      kind: 'adopt',
      mode: 'sale',
      price: '30만 원',
      region: '서울',
      seller: { type: 'person' },
      resume: 'TOKEN',
    })
  })
  it('사업자 정보는 다듬어 보낸다', () => {
    expect(adoptPayload(biz({ name: ' 게코 가게 ', brn: '1010101013', permit: ' 제1호 ' }), null).seller).toEqual({
      type: 'biz',
      name: '게코 가게',
      rep: '홍길동',
      brn: '101-01-01013',
      tel: '010-0000-0000',
      permit: '제1호',
    })
  })
  it('홍보 글은 분양가를 보내지 않는다', () => {
    expect(adoptPayload(form({ mode: 'show', price: '30만 원', region: '부산' }), null)).toMatchObject({ mode: 'show', price: '', region: '부산', resume: null })
  })
})

describe('tradeGate (새 계정 제한)', () => {
  const now = Date.parse('2026-11-27T12:00:00Z')
  it('24시간이 안 지났으면 남은 시간을 올림해 알려 준다', () => {
    expect(tradeGate('2026-11-26T13:00:00Z', 1, false, now)).toEqual({ ok: false, hoursLeft: 1, needAnimal: false })
    expect(tradeGate('2026-11-27T11:30:00Z', 1, false, now).hoursLeft).toBe(24)
  })
  it('24시간이 지났어도 개체가 없으면 안 된다', () => {
    expect(tradeGate('2026-11-20T00:00:00Z', 0, false, now)).toEqual({ ok: false, hoursLeft: 0, needAnimal: true })
  })
  it('정확히 24시간이 지났고 개체가 있으면 된다', () => {
    expect(tradeGate('2026-11-26T12:00:00Z', 1, false, now)).toEqual({ ok: true, hoursLeft: 0, needAnimal: false })
  })
  it('운영자는 항상 된다', () => {
    expect(tradeGate('2026-11-27T11:59:00Z', 0, true, now)).toEqual({ ok: true, hoursLeft: 0, needAnimal: false })
  })
})

describe('tradeGateText', () => {
  it('쓸 수 있으면 빈 문구', () => {
    expect(tradeGateText({ ok: true, hoursLeft: 0, needAnimal: false })).toBe('')
  })
  it('남은 시간과 개체 등록을 말해 준다', () => {
    const t = tradeGateText({ ok: false, hoursLeft: 5, needAnimal: true })
    expect(t).toContain('5시간')
    expect(t).toContain('개체를 먼저 등록')
  })
  it('시간만 남았으면 개체 이야기는 하지 않는다', () => {
    const t = tradeGateText({ ok: false, hoursLeft: 3, needAnimal: false })
    expect(t).toContain('3시간')
    expect(t).not.toContain('개체를 먼저 등록')
  })
  it('개체만 없으면 시간 이야기는 하지 않는다', () => {
    expect(tradeGateText({ ok: false, hoursLeft: 0, needAnimal: true })).not.toContain('시간 뒤')
  })
})
