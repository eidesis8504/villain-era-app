import { describe, expect, it } from 'vitest'
import { detectEnv } from './env'

// 실제 기기에서 수집되는 형태의 User-Agent
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 385.0.0.25.86 (iPhone15,2; iOS 18_5; ko_KR; ko; scale=3.00; 1179x2556; 748291837; IABMV/1)'
const ANDROID_KAKAOTALK =
  'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Mobile Safari/537.36;KAKAOTALK 2511000'
const IPHONE_NAVER =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.13.2; 15PRO)'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1'
const MAC_SAFARI_OR_IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
const ANDROID_UNKNOWN_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 13; SM-A536N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36'
const IPHONE_FACEBOOK =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.30.106;FBBV/700000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBID/phone;FBLC/ko_KR;FBOP/5]'

describe('detectEnv', () => {
  it('아이폰 사파리는 iosSafari로 본다', () => {
    expect(detectEnv(IPHONE_SAFARI, false)).toEqual({ platform: 'ios', inapp: null, standalone: false, iosSafari: true })
  })
  it('홈 화면 앱으로 열면 iosSafari가 아니다', () => {
    expect(detectEnv(IPHONE_SAFARI, true)).toEqual({ platform: 'ios', inapp: null, standalone: true, iosSafari: false })
  })
  it('인스타그램 앱 안 브라우저를 구분한다', () => {
    expect(detectEnv(IPHONE_INSTAGRAM, false)).toMatchObject({ platform: 'ios', inapp: 'instagram', iosSafari: false })
  })
  it('안드로이드 카카오톡 앱 안 브라우저를 구분한다', () => {
    expect(detectEnv(ANDROID_KAKAOTALK, false)).toMatchObject({ platform: 'android', inapp: 'kakao' })
  })
  it('네이버 앱 안 브라우저를 구분한다', () => {
    expect(detectEnv(IPHONE_NAVER, false).inapp).toBe('naver')
  })
  it('페이스북 앱 안 브라우저를 구분한다', () => {
    expect(detectEnv(IPHONE_FACEBOOK, false).inapp).toBe('facebook')
  })
  it('아이폰 크롬은 앱 안 브라우저도 사파리도 아니다', () => {
    expect(detectEnv(IPHONE_CHROME, false)).toMatchObject({ platform: 'ios', inapp: null, iosSafari: false })
  })
  it('터치가 되는 맥 UA는 아이패드로 본다', () => {
    expect(detectEnv(MAC_SAFARI_OR_IPAD, false, true)).toMatchObject({ platform: 'ios', iosSafari: true })
    expect(detectEnv(MAC_SAFARI_OR_IPAD, false, false)).toMatchObject({ platform: 'desktop', iosSafari: false })
  })
  it('PC 크롬과 안드로이드 크롬', () => {
    expect(detectEnv(MAC_CHROME, false)).toEqual({ platform: 'desktop', inapp: null, standalone: false, iosSafari: false })
    expect(detectEnv(ANDROID_CHROME, false)).toEqual({ platform: 'android', inapp: null, standalone: false, iosSafari: false })
  })
  it('알 수 없는 앱의 웹뷰는 other로 본다', () => {
    expect(detectEnv(ANDROID_UNKNOWN_WEBVIEW, false).inapp).toBe('other')
  })
})
