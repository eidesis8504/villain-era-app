// 웹 푸시 구독 (서버 예약 발송은 Supabase pg_cron + push-dispatch 함수가 담당)
import { supabase } from './supabase'

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export function pushSupport(): { ok: boolean; reason: string } {
  if (!('serviceWorker' in navigator)) return { ok: false, reason: '이 브라우저는 알림을 지원하지 않아요' }
  if (!('PushManager' in window) || !('Notification' in window)) {
    return {
      ok: false,
      reason: isIOS()
        ? 'iPhone은 공유 › 홈 화면에 추가한 뒤 그 앱에서 켤 수 있어요 (iOS 16.4 이상)'
        : '이 브라우저는 알림을 지원하지 않아요',
    }
  }
  if (Notification.permission === 'denied') return { ok: false, reason: '알림 권한이 차단됨 · 브라우저 설정에서 허용해 주세요' }
  return { ok: true, reason: '' }
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
}

function b64ToU8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function currentSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

export async function enablePush() {
  const sup = pushSupport()
  if (!sup.ok) throw new Error(sup.reason)
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('알림 권한이 허용되지 않았어요')
  const reg = (await registerSW()) ?? (await navigator.serviceWorker.ready)
  const { data: key, error } = await supabase.rpc('get_vapid_public_key')
  if (error || !key) throw new Error('알림 서버 키를 받지 못했어요 — 잠시 후 다시 시도해 주세요')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) })
  }
  const j = sub.toJSON()
  const { error: e2 } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: j.keys?.p256dh ?? '',
    p_auth: j.keys?.auth ?? '',
    p_ua: navigator.userAgent,
  })
  if (e2) throw new Error('알림 구독을 저장하지 못했어요')
  return sub
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe().catch(() => undefined)
}
