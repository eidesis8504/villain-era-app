import { describe, expect, it } from 'vitest'
import { kakaoExternalUrl, parseSource } from './source'

const SELF = 'villain-era-app.netlify.app'

describe('parseSource', () => {
  it('src 값을 소문자로', () => {
    expect(parseSource('?src=Instagram', '', SELF)).toBe('instagram')
  })
  it('src가 없으면 utm_source', () => {
    expect(parseSource('?utm_source=wagu-box&x=1', '', SELF)).toBe('wagu-box')
  })
  it('허용하지 않는 문자는 지운다', () => {
    expect(parseSource('?src=a b<script>', '', SELF)).toBe('abscript')
  })
  it('40자로 자른다', () => {
    expect(parseSource('?src=' + 'a'.repeat(60), '', SELF)).toBe('a'.repeat(40))
  })
  it('주소에 값이 없으면 들어온 사이트로 판단', () => {
    expect(parseSource('', 'https://l.instagram.com/?u=https%3A%2F%2Fx', SELF)).toBe('instagram')
    expect(parseSource('', 'https://search.naver.com/search.naver?query=x', SELF)).toBe('naver')
    expect(parseSource('', 'https://www.google.com/', SELF)).toBe('google')
    expect(parseSource('', 'https://t.co/abc', SELF)).toBe('x')
    expect(parseSource('', 'https://cafe.daum.net/abc', SELF)).toBe('kakao')
  })
  it('목록에 없는 외부 사이트는 도메인 이름', () => {
    expect(parseSource('', 'https://www.reptile-forum.co.kr/board/1', SELF)).toBe('reptile-forum')
  })
  it('자기 사이트나 빈 referrer는 direct', () => {
    expect(parseSource('', `https://${SELF}/animals`, SELF)).toBe('direct')
    expect(parseSource('', '', SELF)).toBe('direct')
    expect(parseSource('?src=', 'not a url', SELF)).toBe('direct')
  })
})

describe('kakaoExternalUrl', () => {
  it('카카오톡 외부 브라우저 열기 주소', () => {
    expect(kakaoExternalUrl('https://a.b/?src=x')).toBe('kakaotalk://web/openExternal?url=https%3A%2F%2Fa.b%2F%3Fsrc%3Dx')
  })
})
