// 하루 단위 사용 흔적 (외부 분석 도구 없이 우리 DB에만). 같은 날 같은 이름은 서버에서도 1행만 남는다.
import { today } from './date'
import { currentEnv, isBot } from './env'
import { parseSource } from './source'
import { supabase } from './supabase'

// 기록이 남지 않는 화면만 따로 센다 (기록을 쓰는 기능은 각 테이블의 작성 시각으로 센다)
const VIEWS: [RegExp, string][] = [
  [/^\/(animals\/[^/]+\/)?lineage\/?$/, 'view:lineage'],
  [/^\/scan\/?$/, 'view:scan'],
  [/^\/community(\/(?!new\/?$)[^/]+)?\/?$/, 'view:community'],
  [/^\/animals\/[^/]+\/consult\/?$/, 'view:consult'],
  [/^\/feedings\/?$/, 'view:feeding_bulk'],
]

export function viewName(pathname: string): string | null {
  for (const [re, name] of VIEWS) if (re.test(pathname)) return name
  return null
}

// 앱을 처음 연 주소 기준 유입 경로 (화면을 옮겨 다녀도 유지)
export const landingSource = () => LANDING_SOURCE
const LANDING_SOURCE = typeof location === 'undefined' ? 'direct' : parseSource(location.search, document.referrer, location.host)

const sent = new Set<string>()

function send(names: string[]) {
  const d = today()
  const fresh = names.filter((n) => !sent.has(d + n))
  if (!fresh.length) return
  fresh.forEach((n) => sent.add(d + n))
  supabase.rpc('track', { p_names: fresh }).then(({ error }) => {
    if (error) fresh.forEach((n) => sent.delete(d + n))
  })
}

export function trackOpen() {
  send(currentEnv().standalone ? ['open', 'open_pwa'] : ['open'])
}

export function trackView(pathname: string) {
  const v = viewName(pathname)
  if (v) send([v])
}

// 환영 화면 방문 (계정 없이, 브라우저당 하루 1번)
export function logLandingOnce() {
  if (isBot()) return
  const key = 've-landing-' + today()
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  } catch {
    /* 저장소를 쓸 수 없는 브라우저 */
  }
  const env = currentEnv()
  supabase.rpc('log_landing', { p_src: LANDING_SOURCE, p_platform: env.platform, p_inapp: env.inapp }).then(() => undefined)
}
