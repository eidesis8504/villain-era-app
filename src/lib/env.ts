// 접속 환경 판별: 기기 종류, 앱 안 브라우저, 홈 화면 앱 여부
// 게스트 계정은 브라우저 저장소에 묶이므로, 기록이 끊기기 쉬운 환경(앱 안 브라우저·아이폰 사파리)을 안내하는 데 쓴다.
import { isStandalone } from './push'

export type Platform = 'ios' | 'android' | 'desktop' | 'other'
export type InApp = 'instagram' | 'kakao' | 'naver' | 'facebook' | 'line' | 'other' | null
export type Env = { platform: Platform; inapp: InApp; standalone: boolean; iosSafari: boolean }

function platformOf(ua: string, touch: boolean): Platform {
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  // iPadOS 사파리는 맥과 같은 UA를 보내므로 터치 지원으로 구분한다
  if (/Macintosh/.test(ua) && touch) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Windows|Macintosh|CrOS|Linux|X11/.test(ua)) return 'desktop'
  return 'other'
}

function inappOf(ua: string, platform: Platform): InApp {
  if (/Instagram/.test(ua)) return 'instagram'
  if (/KAKAOTALK/i.test(ua)) return 'kakao'
  if (/NAVER\(inapp|NAVER\//.test(ua)) return 'naver'
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'facebook'
  if (/ Line\//.test(ua)) return 'line'
  if (platform === 'android' && /; wv\)/.test(ua)) return 'other'
  // 아이폰 앱 안 웹뷰는 Safari/ 표시가 없다
  if (platform === 'ios' && !/Safari\//.test(ua)) return 'other'
  return null
}

export function detectEnv(ua: string, standalone: boolean, touch = false): Env {
  const platform = platformOf(ua, touch)
  const inapp = standalone ? null : inappOf(ua, platform)
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|Whale|YaBrowser|SamsungBrowser/.test(ua)
  return {
    platform,
    inapp,
    standalone,
    iosSafari: platform === 'ios' && !standalone && inapp === null && !otherBrowser,
  }
}

export function currentEnv(): Env {
  return detectEnv(navigator.userAgent, isStandalone(), (navigator.maxTouchPoints ?? 0) > 1)
}

// 검색엔진·링크 미리보기·자동화 브라우저 (방문 집계에서 뺀다)
const BOT_UA = /bot\b|crawl|spider|slurp|HeadlessChrome|Lighthouse|facebookexternalhit|kakaotalk-scrap|Yeti|Daumoa/i
export const isBot = () => BOT_UA.test(navigator.userAgent) || navigator.webdriver === true
