// 앱 오류 수집: 처리되지 않은 오류를 서버(client_errors)에 남긴다. 세션당 20건, 같은 메시지는 1번.
import { supabase } from './supabase'
import { APP_VERSION } from './version'

const IGNORE = /ResizeObserver loop|Script error\.?$/i
let count = 0
const seen = new Set<string>()

function report(message: string, stack: string) {
  if (!message || IGNORE.test(message) || count >= 20 || seen.has(message)) return
  seen.add(message)
  count++
  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) return
    supabase
      .rpc('log_client_error', {
        p_message: message.slice(0, 500),
        p_stack: stack.slice(0, 4000),
        p_path: location.pathname.slice(0, 200),
        p_version: APP_VERSION,
        p_ua: navigator.userAgent.slice(0, 300),
      })
      .then(() => undefined)
  })
}

export function installErrorReporter() {
  window.addEventListener('error', (e) => {
    report(String(e.error?.message ?? e.message ?? ''), String(e.error?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`))
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | string | undefined
    const msg = typeof r === 'string' ? r : (r?.message ?? '처리되지 않은 오류')
    report(String(msg), typeof r === 'object' && r ? String(r.stack ?? '') : '')
  })
}
